// Notification System Test Script
// Run this in your browser console after logging in to test all notification features

class NotificationTester {
  constructor() {
    this.currentUser = null;
    this.testResults = [];
  }

  async init() {
    // Get current user from your app
    const userElement = document.querySelector('[data-testid="user-info"]') || 
                       document.querySelector('.user-name') ||
                       document.querySelector('[class*="user"]');
    
    if (!userElement && window.currentUser) {
      this.currentUser = window.currentUser;
    } else if (!this.currentUser) {
      console.warn('⚠️ Could not find current user. Please set window.currentUser or pass user ID manually');
      return false;
    }

    console.log('🎯 Notification Tester initialized for user:', this.currentUser?.id || 'unknown');
    return true;
  }

  async testPushSubscriptionService() {
    console.log('\n🔔 Testing Push Subscription Service...');
    
    try {
      const { pushSubscriptionService } = await import('./pushSubscriptionService.js');
      
      // Test 1: Check if push is supported
      const isSupported = pushSubscriptionService.isPushSupported();
      this.log(`Push notifications supported: ${isSupported ? '✅' : '❌'}`, isSupported);
      
      if (!isSupported) return false;
      
      // Test 2: Check current permission
      const permission = pushSubscriptionService.getNotificationPermission();
      this.log(`Current permission: ${permission}`, permission === 'granted');
      
      // Test 3: Try to get VAPID key
      const vapidKey = pushSubscriptionService.getVapidPublicKey();
      this.log(`VAPID key configured: ${vapidKey ? '✅' : '❌'}`, !!vapidKey);
      
      // Test 4: Check for active subscription
      if (this.currentUser?.id) {
        const hasActive = await pushSubscriptionService.hasActiveSubscription(this.currentUser.id);
        this.log(`Has active subscription: ${hasActive ? '✅' : '❌'}`, hasActive);
        
        // Test 5: Try to subscribe (if permission granted)
        if (permission === 'granted' && !hasActive) {
          console.log('📱 Attempting to create push subscription...');
          const subscription = await pushSubscriptionService.subscribeToPush(this.currentUser.id);
          this.log(`Push subscription created: ${subscription ? '✅' : '❌'}`, !!subscription);
        }
      }
      
      return true;
    } catch (error) {
      console.error('❌ Push subscription test failed:', error);
      return false;
    }
  }

  async testNotificationService() {
    console.log('\n📬 Testing Notification Service...');
    
    try {
      const { notificationService } = await import('./notificationService.js');
      
      if (!this.currentUser?.id) {
        console.warn('⚠️ User ID required for notification tests');
        return false;
      }

      // Test 1: Get existing notifications
      const notifications = await notificationService.getUserNotifications(this.currentUser.id, 5);
      this.log(`Retrieved ${notifications.length} notifications`, true);
      
      // Test 2: Get unread count
      const unreadCount = await notificationService.getUnreadCount(this.currentUser.id);
      this.log(`Unread notifications: ${unreadCount}`, true);
      
      // Test 3: Create a test notification
      console.log('🧪 Creating test notification...');
      const testNotification = await notificationService.createNotification({
        user_id: this.currentUser.id,
        type: 'system_update',
        title: '🧪 Test Notification',
        message: 'This is a test notification from the notification tester!',
        action_url: '/app/dashboard',
        action_text: 'View Dashboard',
        metadata: { test: true, timestamp: Date.now() }
      });
      
      this.log(`Test notification created: ${testNotification ? '✅' : '❌'}`, !!testNotification);
      
      if (testNotification) {
        // Test 4: Mark as read
        setTimeout(async () => {
          const marked = await notificationService.markAsRead(testNotification.id);
          this.log(`Notification marked as read: ${marked ? '✅' : '❌'}`, marked);
        }, 2000);
      }
      
      return true;
    } catch (error) {
      console.error('❌ Notification service test failed:', error);
      return false;
    }
  }

  async testBrowserNotifications() {
    console.log('\n🌐 Testing Browser Notifications...');
    
    try {
      if (!('Notification' in window)) {
        this.log('Browser notifications not supported', false);
        return false;
      }
      
      const permission = Notification.permission;
      this.log(`Browser notification permission: ${permission}`, permission === 'granted');
      
      if (permission === 'granted') {
        console.log('🔔 Showing test browser notification...');
        const notification = new Notification('🧪 Test Browser Notification', {
          body: 'This is a test browser notification!',
          icon: '/android-chrome-192x192.png',
          badge: '/favicon.ico',
          tag: 'test-notification'
        });
        
        notification.onclick = () => {
          console.log('✅ Browser notification clicked!');
          notification.close();
        };
        
        setTimeout(() => notification.close(), 5000);
        this.log('Browser notification shown', true);
      }
      
      return true;
    } catch (error) {
      console.error('❌ Browser notification test failed:', error);
      return false;
    }
  }

  async testServiceWorker() {
    console.log('\n⚙️ Testing Service Worker...');
    
    try {
      if (!('serviceWorker' in navigator)) {
        this.log('Service Worker not supported', false);
        return false;
      }
      
      const registration = await navigator.serviceWorker.getRegistration('/sw.js');
      this.log(`Service Worker registered: ${registration ? '✅' : '❌'}`, !!registration);
      
      if (registration) {
        this.log(`Service Worker state: ${registration.active?.state || 'unknown'}`, 
                 registration.active?.state === 'activated');
        
        // Test message passing
        if (registration.active) {
          console.log('📤 Testing service worker messaging...');
          registration.active.postMessage({
            type: 'TEST_NOTIFICATION',
            data: {
              title: '🧪 SW Test Notification',
              body: 'Testing service worker notification display!',
              tag: 'sw-test'
            }
          });
          this.log('Service worker message sent', true);
        }
      }
      
      return true;
    } catch (error) {
      console.error('❌ Service worker test failed:', error);
      return false;
    }
  }

  async testRealTimeSubscription() {
    console.log('\n🔄 Testing Real-time Subscriptions...');
    
    try {
      const { notificationService } = await import('./notificationService.js');
      
      if (!this.currentUser?.id) {
        console.warn('⚠️ User ID required for real-time tests');
        return false;
      }

      let subscriptionReceived = false;
      
      // Subscribe to real-time notifications
      const subscription = notificationService.subscribeToNotifications(
        this.currentUser.id,
        (notification) => {
          console.log('🔄 Real-time notification received:', notification);
          subscriptionReceived = true;
        }
      );
      
      this.log('Real-time subscription created', true);
      
      // Create a test notification to trigger real-time update
      setTimeout(async () => {
        await notificationService.createNotification({
          user_id: this.currentUser.id,
          type: 'reminder',
          title: '🔄 Real-time Test',
          message: 'Testing real-time notification delivery!',
          metadata: { realtime_test: true }
        });
        
        // Check if we received it
        setTimeout(() => {
          this.log(`Real-time notification received: ${subscriptionReceived ? '✅' : '❌'}`, subscriptionReceived);
          
          // Clean up subscription
          notificationService.unsubscribeFromNotifications(subscription);
          console.log('🧹 Real-time subscription cleaned up');
        }, 2000);
      }, 1000);
      
      return true;
    } catch (error) {
      console.error('❌ Real-time subscription test failed:', error);
      return false;
    }
  }

  async runAllTests(userId = null) {
    console.log('🚀 Starting Comprehensive Notification System Test...\n');
    
    if (userId) {
      this.currentUser = { id: userId };
    }
    
    const initialized = await this.init();
    if (!initialized) return;
    
    this.testResults = [];
    
    // Run all tests
    await this.testServiceWorker();
    await this.testBrowserNotifications();
    await this.testPushSubscriptionService();
    await this.testNotificationService();
    await this.testRealTimeSubscription();
    
    // Show results
    this.showResults();
  }

  log(message, success) {
    const icon = success ? '✅' : '❌';
    console.log(`${icon} ${message}`);
    this.testResults.push({ message, success });
  }

  showResults() {
    console.log('\n📊 TEST RESULTS SUMMARY:');
    console.log('='.repeat(50));
    
    const passed = this.testResults.filter(r => r.success).length;
    const total = this.testResults.length;
    const percentage = Math.round((passed / total) * 100);
    
    console.log(`✅ Passed: ${passed}/${total} (${percentage}%)`);
    console.log(`❌ Failed: ${total - passed}/${total}`);
    
    if (percentage === 100) {
      console.log('\n🎉 ALL TESTS PASSED! Your notification system is working perfectly!');
    } else if (percentage >= 80) {
      console.log('\n🎯 Most tests passed! Minor issues to address.');
    } else {
      console.log('\n⚠️ Several issues found. Check the logs above for details.');
    }
    
    console.log('\n📋 Failed tests:');
    this.testResults.filter(r => !r.success).forEach(r => {
      console.log(`❌ ${r.message}`);
    });
  }
}

// Create global tester instance
window.notificationTester = new NotificationTester();

// Auto-run if current user is available
if (typeof window !== 'undefined') {
  console.log('🧪 Notification Tester loaded!');
  console.log('📝 Usage:');
  console.log('  notificationTester.runAllTests() - Run all tests');
  console.log('  notificationTester.runAllTests("user-id") - Run with specific user ID');
  console.log('  notificationTester.testPushSubscriptionService() - Test push only');
  console.log('  notificationTester.testNotificationService() - Test notifications only');
  
  // Try to auto-run if we detect user is logged in
  setTimeout(() => {
    if (window.currentUser || window.user || 
        document.querySelector('[data-testid="user-info"]')) {
      console.log('🎯 Auto-running notification tests...');
      window.notificationTester.runAllTests();
    }
  }, 2000);
}

export default NotificationTester;