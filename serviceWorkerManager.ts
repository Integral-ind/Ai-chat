// Service Worker Manager for handling registration and lifecycle
class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;
  private isSupported: boolean = false;

  constructor() {
    this.isSupported = 'serviceWorker' in navigator;
  }

  // Check if service workers are supported
  isServiceWorkerSupported(): boolean {
    return this.isSupported;
  }

  // Register the service worker
  async registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (!this.isSupported) {
      console.warn('Service Workers are not supported in this browser');
      return null;
    }

    try {
      // Register the service worker
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      console.log('Service Worker registered successfully:', this.registration);

      // Set up event listeners
      this.setupEventListeners();

      // Wait for the service worker to be ready
      await navigator.serviceWorker.ready;
      
      return this.registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return null;
    }
  }

  // Get the current service worker registration
  async getRegistration(): Promise<ServiceWorkerRegistration | null> {
    if (this.registration) {
      return this.registration;
    }

    if (!this.isSupported) {
      return null;
    }

    try {
      this.registration = await navigator.serviceWorker.getRegistration('/sw.js');
      return this.registration;
    } catch (error) {
      console.error('Error getting service worker registration:', error);
      return null;
    }
  }

  // Set up event listeners for service worker lifecycle events
  private setupEventListeners(): void {
    if (!this.registration) return;

    // Handle service worker updates
    this.registration.addEventListener('updatefound', () => {
      const newWorker = this.registration!.installing;
      if (newWorker) {
        console.log('New service worker installing...');
        
        newWorker.addEventListener('statechange', () => {
          switch (newWorker.state) {
            case 'installed':
              if (navigator.serviceWorker.controller) {
                console.log('New service worker installed, update available');
                this.handleServiceWorkerUpdate();
              } else {
                console.log('Service worker installed for the first time');
              }
              break;
            case 'activated':
              console.log('New service worker activated');
              break;
          }
        });
      }
    });

    // Handle messages from service worker
    navigator.serviceWorker.addEventListener('message', (event) => {
      console.log('Message from service worker:', event.data);
      this.handleServiceWorkerMessage(event.data);
    });

    // Handle controller change (new service worker takes control)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('Service worker controller changed');
      // Optionally reload the page to ensure consistency
      // window.location.reload();
    });
  }

  // Handle service worker updates
  private handleServiceWorkerUpdate(): void {
    // You can show a notification to the user about the update
    console.log('Service worker update available');
    
    // Option 1: Show a banner/notification to the user
    this.showUpdateNotification();
    
    // Option 2: Auto-update (less user-friendly but simpler)
    // this.updateServiceWorker();
  }

  // Show update notification to user
  private showUpdateNotification(): void {
    // Create a simple notification banner
    const banner = document.createElement('div');
    banner.id = 'sw-update-banner';
    banner.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: #007bff;
      color: white;
      padding: 12px;
      text-align: center;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    banner.innerHTML = `
      <div>
        A new version is available!
        <button id="sw-update-btn" style="margin-left: 10px; background: white; color: #007bff; border: none; padding: 4px 12px; border-radius: 4px; cursor: pointer;">
          Update
        </button>
        <button id="sw-dismiss-btn" style="margin-left: 8px; background: transparent; color: white; border: 1px solid white; padding: 4px 12px; border-radius: 4px; cursor: pointer;">
          Later
        </button>
      </div>
    `;

    // Add event listeners
    const updateBtn = banner.querySelector('#sw-update-btn');
    const dismissBtn = banner.querySelector('#sw-dismiss-btn');

    updateBtn?.addEventListener('click', () => {
      this.updateServiceWorker();
      banner.remove();
    });

    dismissBtn?.addEventListener('click', () => {
      banner.remove();
    });

    // Remove existing banner if present
    const existingBanner = document.getElementById('sw-update-banner');
    if (existingBanner) {
      existingBanner.remove();
    }

    document.body.appendChild(banner);

    // Auto-dismiss after 30 seconds
    setTimeout(() => {
      if (document.getElementById('sw-update-banner')) {
        banner.remove();
      }
    }, 30000);
  }

  // Update the service worker
  async updateServiceWorker(): Promise<void> {
    if (!this.registration || !this.registration.waiting) {
      console.log('No waiting service worker found');
      return;
    }

    // Send skip waiting message to the service worker
    this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });

    // The page will be refreshed by the controllerchange event
    // or you can manually reload here
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  }

  // Handle messages from service worker
  private handleServiceWorkerMessage(data: any): void {
    switch (data.type) {
      case 'SW_UPDATED':
        console.log('Service worker updated successfully');
        break;
      case 'CACHE_UPDATED':
        console.log('Cache updated');
        break;
      case 'PUSH_RECEIVED':
        console.log('Push notification received in main thread');
        break;
      default:
        console.log('Unknown message from service worker:', data);
    }
  }

  // Send message to service worker
  async sendMessageToServiceWorker(message: any): Promise<any> {
    const registration = await this.getRegistration();
    
    if (!registration || !registration.active) {
      console.warn('No active service worker to send message to');
      return null;
    }

    return new Promise((resolve) => {
      const channel = new MessageChannel();
      
      channel.port1.onmessage = (event) => {
        resolve(event.data);
      };
      
      registration.active.postMessage(message, [channel.port2]);
    });
  }

  // Get service worker version
  async getServiceWorkerVersion(): Promise<string | null> {
    try {
      const response = await this.sendMessageToServiceWorker({ type: 'GET_VERSION' });
      return response?.version || null;
    } catch (error) {
      console.error('Error getting service worker version:', error);
      return null;
    }
  }

  // Clear service worker cache
  async clearServiceWorkerCache(): Promise<boolean> {
    try {
      const response = await this.sendMessageToServiceWorker({ type: 'CLEAR_CACHE' });
      return response?.success || false;
    } catch (error) {
      console.error('Error clearing service worker cache:', error);
      return false;
    }
  }

  // Unregister service worker (use with caution)
  async unregisterServiceWorker(): Promise<boolean> {
    const registration = await this.getRegistration();
    
    if (!registration) {
      console.log('No service worker registration found');
      return false;
    }

    try {
      const result = await registration.unregister();
      console.log('Service worker unregistered:', result);
      this.registration = null;
      return result;
    } catch (error) {
      console.error('Error unregistering service worker:', error);
      return false;
    }
  }

  // Check if service worker is active and controlling the page
  isServiceWorkerActive(): boolean {
    return !!navigator.serviceWorker.controller;
  }

  // Get service worker state
  getServiceWorkerState(): string {
    if (!this.isSupported) return 'not_supported';
    if (!navigator.serviceWorker.controller) return 'not_controlling';
    if (!this.registration) return 'not_registered';
    
    const sw = this.registration.active;
    if (!sw) return 'no_active_worker';
    
    return sw.state;
  }
}

export const serviceWorkerManager = new ServiceWorkerManager();