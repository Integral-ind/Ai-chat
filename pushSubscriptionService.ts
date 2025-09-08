import { supabase } from './supabaseClient';

export interface PushSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh_key: string;
  auth_key: string;
  user_agent?: string;
  device_name?: string;
  browser_name?: string;
  os_name?: string;
  is_active: boolean;
  last_used_at: string;
  created_at: string;
  updated_at: string;
}

export interface CreatePushSubscriptionData {
  user_id: string;
  endpoint: string;
  p256dh_key: string;
  auth_key: string;
  user_agent?: string;
  device_name?: string;
  browser_name?: string;
  os_name?: string;
}

class PushSubscriptionService {
  private vapidPublicKey: string;

  constructor() {
    this.vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';
    if (!this.vapidPublicKey) {
      console.warn('VAPID public key not found in environment variables');
    }
  }

  // Convert URL-safe base64 to Uint8Array
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Get device information
  private getDeviceInfo(): { userAgent: string; deviceName: string; browserName: string; osName: string } {
    const userAgent = navigator.userAgent;
    
    // Detect browser
    let browserName = 'Unknown';
    if (userAgent.includes('Chrome')) browserName = 'Chrome';
    else if (userAgent.includes('Firefox')) browserName = 'Firefox';
    else if (userAgent.includes('Safari')) browserName = 'Safari';
    else if (userAgent.includes('Edge')) browserName = 'Edge';
    else if (userAgent.includes('Opera')) browserName = 'Opera';

    // Detect OS
    let osName = 'Unknown';
    if (userAgent.includes('Windows')) osName = 'Windows';
    else if (userAgent.includes('Mac')) osName = 'macOS';
    else if (userAgent.includes('Linux')) osName = 'Linux';
    else if (userAgent.includes('Android')) osName = 'Android';
    else if (userAgent.includes('iOS')) osName = 'iOS';

    // Create device name
    const deviceName = `${browserName} on ${osName}`;

    return { userAgent, deviceName, browserName, osName };
  }

  // Check if push notifications are supported
  isPushSupported(): boolean {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  // Get current notification permission status
  getNotificationPermission(): NotificationPermission {
    return Notification.permission;
  }

  // Request notification permission
  async requestNotificationPermission(): Promise<NotificationPermission> {
    if (!this.isPushSupported()) {
      throw new Error('Push notifications are not supported in this browser');
    }

    if (Notification.permission === 'granted') {
      return 'granted';
    }

    if (Notification.permission === 'denied') {
      return 'denied';
    }

    const permission = await Notification.requestPermission();
    return permission;
  }

  // Get service worker registration
  private async getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
    if (!('serviceWorker' in navigator)) {
      throw new Error('Service Worker is not supported');
    }

    let registration = await navigator.serviceWorker.getRegistration('/sw.js');
    
    if (!registration) {
      // Try to register the service worker if not found
      registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });
      
      // Wait for the service worker to be ready
      await navigator.serviceWorker.ready;
    }

    return registration;
  }

  // Subscribe to push notifications
  async subscribeToPush(userId: string): Promise<PushSubscription | null> {
    try {
      // Check permission
      const permission = await this.requestNotificationPermission();
      if (permission !== 'granted') {
        throw new Error('Notification permission not granted');
      }

      // Get service worker registration
      const registration = await this.getServiceWorkerRegistration();

      // Check for existing subscription
      let subscription = await registration.pushManager.getSubscription();

      // Create new subscription if none exists
      if (!subscription) {
        if (!this.vapidPublicKey) {
          throw new Error('VAPID public key is required');
        }

        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey)
        });
      }

      // Extract subscription details
      const endpoint = subscription.endpoint;
      const keys = subscription.getKey ? {
        p256dh: subscription.getKey('p256dh'),
        auth: subscription.getKey('auth')
      } : null;

      if (!keys || !keys.p256dh || !keys.auth) {
        throw new Error('Failed to get subscription keys');
      }

      // Convert keys to base64
      const p256dhKey = btoa(String.fromCharCode(...new Uint8Array(keys.p256dh)));
      const authKey = btoa(String.fromCharCode(...new Uint8Array(keys.auth)));

      // Get device info
      const deviceInfo = this.getDeviceInfo();

      // Save subscription to database
      const { data, error } = await supabase.rpc('upsert_push_subscription', {
        p_user_id: userId,
        p_endpoint: endpoint,
        p_p256dh_key: p256dhKey,
        p_auth_key: authKey,
        p_user_agent: deviceInfo.userAgent,
        p_device_name: deviceInfo.deviceName,
        p_browser_name: deviceInfo.browserName,
        p_os_name: deviceInfo.osName
      });

      if (error) throw error;

      console.log('Push subscription saved successfully');
      return data;
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      return null;
    }
  }

  // Unsubscribe from push notifications
  async unsubscribeFromPush(): Promise<boolean> {
    try {
      const registration = await this.getServiceWorkerRegistration();
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Unsubscribe from browser
        await subscription.unsubscribe();

        // Mark as inactive in database
        const { error } = await supabase
          .from('push_subscriptions')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('endpoint', subscription.endpoint);

        if (error) {
          console.error('Error updating subscription status:', error);
        }
      }

      return true;
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      return false;
    }
  }

  // Get user's push subscriptions
  async getUserSubscriptions(userId: string): Promise<PushSubscription[]> {
    try {
      const { data, error } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('last_used_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching push subscriptions:', error);
      return [];
    }
  }

  // Check if user has active push subscription
  async hasActiveSubscription(userId: string): Promise<boolean> {
    try {
      // Check browser subscription
      const registration = await this.getServiceWorkerRegistration();
      const browserSubscription = await registration.pushManager.getSubscription();

      if (!browserSubscription) {
        return false;
      }

      // Check database subscription
      const { data, error } = await supabase
        .from('push_subscriptions')
        .select('id')
        .eq('user_id', userId)
        .eq('endpoint', browserSubscription.endpoint)
        .eq('is_active', true)
        .single();

      return !error && !!data;
    } catch (error) {
      console.error('Error checking subscription status:', error);
      return false;
    }
  }

  // Delete a specific push subscription
  async deleteSubscription(subscriptionId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('id', subscriptionId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting push subscription:', error);
      return false;
    }
  }

  // Test push notification (for development/testing)
  async testPushNotification(): Promise<void> {
    try {
      const registration = await this.getServiceWorkerRegistration();
      
      // Send a test message to the service worker
      if (registration.active) {
        registration.active.postMessage({
          type: 'TEST_NOTIFICATION',
          data: {
            title: 'Test Push Notification',
            body: 'This is a test notification from your app!',
            icon: '/android-chrome-192x192.png',
            badge: '/favicon.ico',
            tag: 'test',
            data: { action_url: '/app/dashboard' }
          }
        });
      }
    } catch (error) {
      console.error('Error sending test notification:', error);
    }
  }

  // Update subscription usage (for analytics)
  async updateSubscriptionUsage(endpoint: string): Promise<void> {
    try {
      await supabase.rpc('mark_push_subscription_used', {
        p_endpoint: endpoint
      });
    } catch (error) {
      console.error('Error updating subscription usage:', error);
    }
  }

  // Get subscription statistics
  async getSubscriptionStats(userId: string): Promise<{
    total_subscriptions: number;
    active_subscriptions: number;
    recent_subscriptions: number;
    last_activity: string | null;
  } | null> {
    try {
      const { data, error } = await supabase
        .from('push_subscription_stats')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    } catch (error) {
      console.error('Error fetching subscription stats:', error);
      return null;
    }
  }

  // Get VAPID public key for client-side use
  getVapidPublicKey(): string {
    return this.vapidPublicKey;
  }
}

export const pushSubscriptionService = new PushSubscriptionService();