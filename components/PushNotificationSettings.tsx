import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { pushSubscriptionService } from '../pushSubscriptionService';
import { notificationPreferencesService } from '../notificationPreferencesService';
import { User as FrontendUser } from '../types';
import { BellIcon, CheckIcon, XMarkIcon, ExclamationTriangleIcon } from '../constants';

interface PushNotificationSettingsProps {
  currentUser: FrontendUser | null;
}

interface SubscriptionInfo {
  isSupported: boolean;
  hasPermission: boolean;
  hasActiveSubscription: boolean;
  subscriptions: any[];
  browserInfo: string;
}

export const PushNotificationSettings: React.FC<PushNotificationSettingsProps> = ({ currentUser }) => {
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo>({
    isSupported: false,
    hasPermission: false,
    hasActiveSubscription: false,
    subscriptions: [],
    browserInfo: ''
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<any>(null);

  // Load subscription info and preferences
  const loadSubscriptionInfo = useCallback(async () => {
    if (!currentUser) return;

    try {
      setIsLoading(true);
      setError(null);

      // Check browser support
      const isSupported = pushSubscriptionService.isPushSupported();
      const hasPermission = pushSubscriptionService.getNotificationPermission() === 'granted';
      
      // Get active subscriptions
      const subscriptions = await pushSubscriptionService.getUserSubscriptions(currentUser.id);
      const hasActiveSubscription = await pushSubscriptionService.hasActiveSubscription(currentUser.id);
      
      // Get user preferences
      const userPreferences = await notificationPreferencesService.getUserPreferences(currentUser.id);
      
      setSubscriptionInfo({
        isSupported,
        hasPermission,
        hasActiveSubscription,
        subscriptions,
        browserInfo: navigator.userAgent
      });
      
      setPreferences(userPreferences);

      // Show permission prompt if supported but no permission
      if (isSupported && !hasPermission && !hasActiveSubscription) {
        setShowPermissionPrompt(true);
      }
    } catch (error) {
      console.error('Error loading subscription info:', error);
      setError('Failed to load notification settings');
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    loadSubscriptionInfo();
  }, [loadSubscriptionInfo]);

  // Handle subscription to push notifications
  const handleSubscribe = async () => {
    if (!currentUser) return;

    setIsSubscribing(true);
    setError(null);

    try {
      const subscription = await pushSubscriptionService.subscribeToPush(currentUser.id);
      
      if (subscription) {
        // Update preferences to enable push notifications
        await notificationPreferencesService.updatePreferences(currentUser.id, {
          push_notifications: true
        });
        
        await loadSubscriptionInfo();
        setShowPermissionPrompt(false);
        
        // Show success message
        setError(null);
      } else {
        setError('Failed to subscribe to push notifications. Please check your browser settings.');
      }
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      setError(error instanceof Error ? error.message : 'Failed to subscribe to push notifications');
    } finally {
      setIsSubscribing(false);
    }
  };

  // Handle unsubscribe from push notifications
  const handleUnsubscribe = async () => {
    setIsSubscribing(true);
    setError(null);

    try {
      const success = await pushSubscriptionService.unsubscribeFromPush();
      
      if (success) {
        // Update preferences to disable push notifications
        if (currentUser) {
          await notificationPreferencesService.updatePreferences(currentUser.id, {
            push_notifications: false
          });
        }
        
        await loadSubscriptionInfo();
      } else {
        setError('Failed to unsubscribe from push notifications');
      }
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      setError('Failed to unsubscribe from push notifications');
    } finally {
      setIsSubscribing(false);
    }
  };

  // Handle preference updates
  const handlePreferenceChange = async (key: string, value: boolean) => {
    if (!currentUser || !preferences) return;

    try {
      const updatedPreferences = await notificationPreferencesService.updatePreferences(
        currentUser.id,
        { [key]: value }
      );
      
      if (updatedPreferences) {
        setPreferences(updatedPreferences);
      }
    } catch (error) {
      console.error('Error updating preference:', error);
      setError('Failed to update notification preference');
    }
  };

  // Handle test notification
  const handleTestNotification = async () => {
    try {
      await pushSubscriptionService.testPushNotification();
    } catch (error) {
      console.error('Error sending test notification:', error);
      setError('Failed to send test notification');
    }
  };

  // Render permission prompt
  const renderPermissionPrompt = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-primary/10 border border-primary/20 rounded-lg p-6 mb-6"
    >
      <div className="flex items-start space-x-4">
        <div className="flex-shrink-0">
          <BellIcon className="w-8 h-8 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-text dark:text-text-dark mb-2">
            Enable Push Notifications
          </h3>
          <p className="text-muted dark:text-muted-dark mb-4">
            Stay up-to-date with important updates even when the app is closed. 
            You'll receive notifications for tasks, messages, calls, and more.
          </p>
          <div className="flex space-x-3">
            <button
              onClick={handleSubscribe}
              disabled={isSubscribing}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isSubscribing && <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />}
              <span>Enable Notifications</span>
            </button>
            <button
              onClick={() => setShowPermissionPrompt(false)}
              className="px-4 py-2 text-muted dark:text-muted-dark hover:text-text dark:hover:text-text-dark"
            >
              Not now
            </button>
          </div>
        </div>
        <button
          onClick={() => setShowPermissionPrompt(false)}
          className="flex-shrink-0 p-1 text-muted dark:text-muted-dark hover:text-text dark:hover:text-text-dark"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>
    </motion.div>
  );

  // Render subscription status
  const renderSubscriptionStatus = () => {
    if (!subscriptionInfo.isSupported) {
      return (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4 mb-6">
          <div className="flex items-center space-x-3">
            <ExclamationTriangleIcon className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
            <div>
              <h3 className="font-medium text-yellow-800 dark:text-yellow-200">
                Push Notifications Not Supported
              </h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                Your browser doesn't support push notifications.
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (!subscriptionInfo.hasPermission) {
      return (
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <BellIcon className="w-6 h-6 text-gray-500" />
              <div>
                <h3 className="font-medium text-text dark:text-text-dark">
                  Push Notifications Disabled
                </h3>
                <p className="text-sm text-muted dark:text-muted-dark">
                  Enable notifications to stay updated
                </p>
              </div>
            </div>
            <button
              onClick={handleSubscribe}
              disabled={isSubscribing}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isSubscribing && <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />}
              <span>Enable</span>
            </button>
          </div>
        </div>
      );
    }

    if (subscriptionInfo.hasActiveSubscription) {
      return (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <CheckIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
              <div>
                <h3 className="font-medium text-green-800 dark:text-green-200">
                  Push Notifications Enabled
                </h3>
                <p className="text-sm text-green-700 dark:text-green-300">
                  You'll receive notifications on this device ({subscriptionInfo.subscriptions.length} active)
                </p>
              </div>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={handleTestNotification}
                className="px-3 py-1 text-sm text-primary hover:text-primary/80 border border-primary rounded"
              >
                Test
              </button>
              <button
                onClick={handleUnsubscribe}
                disabled={isSubscribing}
                className="px-3 py-1 text-sm text-red-600 hover:text-red-700 border border-red-600 rounded disabled:opacity-50"
              >
                Disable
              </button>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  // Render notification preferences
  const renderNotificationPreferences = () => {
    if (!preferences || !subscriptionInfo.hasActiveSubscription) return null;

    const categories = [
      {
        key: 'tasks',
        label: 'Tasks',
        description: 'Task assignments, deadlines, and completions',
        settings: [
          { key: 'task_assigned_push', label: 'Task assigned to me' },
          { key: 'task_due_soon_push', label: 'Task due soon' },
          { key: 'task_deadline_reminder_push', label: 'Deadline reminders' },
          { key: 'task_completed_push', label: 'Task completed' }
        ]
      },
      {
        key: 'teams',
        label: 'Teams & Projects',
        description: 'Team invitations, member changes, and project updates',
        settings: [
          { key: 'team_member_added_push', label: 'Added to team' },
          { key: 'team_admin_added_push', label: 'Promoted to admin' },
          { key: 'project_member_added_push', label: 'Added to project' }
        ]
      },
      {
        key: 'chat',
        label: 'Messages',
        description: 'Direct messages and mentions',
        settings: [
          { key: 'message_received_push', label: 'Direct messages' },
          { key: 'chat_mention_push', label: 'When mentioned' }
        ]
      },
      {
        key: 'calls',
        label: 'Calls',
        description: 'Voice and video call notifications',
        settings: [
          { key: 'call_incoming_push', label: 'Incoming calls' },
          { key: 'call_missed_push', label: 'Missed calls' }
        ]
      },
      {
        key: 'system',
        label: 'System',
        description: 'System updates and reminders',
        settings: [
          { key: 'system_update_push', label: 'System updates' },
          { key: 'reminder_push', label: 'Reminders' }
        ]
      }
    ];

    return (
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-text dark:text-text-dark">
          Notification Preferences
        </h3>
        
        {categories.map((category) => (
          <div key={category.key} className="bg-surface dark:bg-surface-dark rounded-lg p-4">
            <div className="mb-3">
              <h4 className="font-medium text-text dark:text-text-dark">
                {category.label}
              </h4>
              <p className="text-sm text-muted dark:text-muted-dark">
                {category.description}
              </p>
            </div>
            
            <div className="space-y-2">
              {category.settings.map((setting) => (
                <label key={setting.key} className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-text dark:text-text-dark">
                    {setting.label}
                  </span>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={preferences[setting.key] || false}
                      onChange={(e) => handlePreferenceChange(setting.key, e.target.checked)}
                      className="sr-only"
                    />
                    <div
                      className={`w-11 h-6 rounded-full transition-colors ${
                        preferences[setting.key]
                          ? 'bg-primary'
                          : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                          preferences[setting.key] ? 'translate-x-5' : 'translate-x-0.5'
                        } mt-0.5`}
                      />
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-text dark:text-text-dark mb-2">
          Push Notifications
        </h2>
        <p className="text-muted dark:text-muted-dark">
          Manage your push notification settings and preferences.
        </p>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4"
          >
            <div className="flex items-center space-x-3">
              <ExclamationTriangleIcon className="w-5 h-5 text-red-600 dark:text-red-400" />
              <p className="text-red-800 dark:text-red-200">{error}</p>
              <button
                onClick={() => setError(null)}
                className="ml-auto text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPermissionPrompt && renderPermissionPrompt()}
      </AnimatePresence>

      {renderSubscriptionStatus()}
      {renderNotificationPreferences()}

      {subscriptionInfo.subscriptions.length > 0 && (
        <div className="bg-surface dark:bg-surface-dark rounded-lg p-4">
          <h4 className="font-medium text-text dark:text-text-dark mb-3">
            Active Devices ({subscriptionInfo.subscriptions.length})
          </h4>
          <div className="space-y-2">
            {subscriptionInfo.subscriptions.map((subscription, index) => (
              <div key={subscription.id || index} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-text dark:text-text-dark">
                    {subscription.device_name || 'Unknown Device'}
                  </p>
                  <p className="text-xs text-muted dark:text-muted-dark">
                    Last used: {new Date(subscription.last_used_at).toLocaleDateString()}
                  </p>
                </div>
                {subscriptionInfo.subscriptions.length > 1 && (
                  <button
                    onClick={() => pushSubscriptionService.deleteSubscription(subscription.id)}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};