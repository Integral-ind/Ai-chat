import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BellIcon, XMarkIcon, CheckIcon } from '../constants';
import { notificationService, Notification } from '../notificationService';
import { pushSubscriptionService } from '../pushSubscriptionService';
import { User as FrontendUser } from '../types';

interface NotificationCenterProps {
  currentUser: FrontendUser | null;
  onNotificationCountChange?: (count: number) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ 
  currentUser,
  onNotificationCountChange 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const subscriptionRef = useRef<any>(null);

  const fetchNotifications = useCallback(async () => {
    if (!currentUser) return;
    
    setIsLoading(true);
    try {
      const [userNotifications, count] = await Promise.all([
        notificationService.getUserNotifications(currentUser.id, 10),
        notificationService.getUnreadCount(currentUser.id)
      ]);
      
      setNotifications(userNotifications);
      setUnreadCount(count);
      onNotificationCountChange?.(count);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, onNotificationCountChange]);

  // Subscribe to real-time notifications
  useEffect(() => {
    if (!currentUser) return;

    // Request notification permission on component mount
    notificationService.requestNotificationPermission();

    // Initialize push notifications if supported and not already set up
    const initializePushNotifications = async () => {
      try {
        if (pushSubscriptionService.isPushSupported()) {
          const hasActiveSubscription = await pushSubscriptionService.hasActiveSubscription(currentUser.id);
          
          // If user granted permission but doesn't have an active subscription, set it up
          if (pushSubscriptionService.getNotificationPermission() === 'granted' && !hasActiveSubscription) {
            await pushSubscriptionService.subscribeToPush(currentUser.id);
          }
        }
      } catch (error) {
        console.warn('Failed to initialize push notifications:', error);
      }
    };

    initializePushNotifications();

    // Initial fetch
    fetchNotifications();

    // Subscribe to real-time updates
    subscriptionRef.current = notificationService.subscribeToNotifications(
      currentUser.id,
      (newNotification: Notification) => {
        setNotifications(prev => [newNotification, ...prev.slice(0, 9)]);
        setUnreadCount(prev => prev + 1);
        onNotificationCountChange?.(unreadCount + 1);
        
        // Show browser notification
        notificationService.showBrowserNotification(newNotification);
      }
    );

    return () => {
      if (subscriptionRef.current) {
        notificationService.unsubscribeFromNotifications(subscriptionRef.current);
      }
    };
  }, [currentUser, fetchNotifications, onNotificationCountChange, unreadCount]);

  // Handle clicks outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAsRead = async (notificationId: string) => {
    const success = await notificationService.markAsRead(notificationId);
    if (success) {
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
      onNotificationCountChange?.(Math.max(0, unreadCount - 1));
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!currentUser) return;
    
    const success = await notificationService.markAllAsRead(currentUser.id);
    if (success) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
      onNotificationCountChange?.(0);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      handleMarkAsRead(notification.id);
    }
    
    if (notification.action_url) {
      window.location.hash = notification.action_url;
      setIsOpen(false);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'call_incoming':
      case 'call_missed':
      case 'call_ended':
      case 'call_answered':
      case 'call_started':
      case 'call_declined':
        return '📞';
      case 'task_assigned':
      case 'task_completed':
      case 'task_due_soon':
      case 'task_deadline_reminder':
        return '✅';
      case 'team_invitation':
      case 'project_invitation':
        return '👥';
      case 'team_member_added':
      case 'team_admin_added':
      case 'team_ownership_transferred':
        return '🎉';
      case 'team_member_left':
      case 'team_member_removed':
      case 'team_admin_removed':
        return '👋';
      case 'department_member_added':
      case 'department_admin_changed':
        return '🏢';
      case 'department_member_left':
        return '🚪';
      case 'project_member_added':
      case 'project_ownership_transferred':
        return '📁';
      case 'project_member_removed':
        return '📂';
      case 'message_received':
        return '💬';
      case 'chat_mention':
        return '💬';
      case 'system_update':
        return '🔧';
      case 'achievement_unlocked':
        return '🏆';
      case 'reminder':
        return '⏰';
      case 'welcome_notification':
        return '👋';
      default:
        return '📋';
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-muted dark:text-muted-dark hover:text-text dark:hover:text-text-dark rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <BellIcon className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 -mt-1 -mr-1 px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full min-w-[20px] text-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 mt-2 w-96 bg-card dark:bg-card-dark rounded-lg shadow-xl border border-border dark:border-border-dark z-50 max-h-[500px] overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 border-b border-border dark:border-border-dark">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-text dark:text-text-dark">
                  Notifications
                </h3>
                <div className="flex items-center space-x-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllAsRead}
                      className="text-sm text-primary hover:text-primary/80 font-medium"
                    >
                      Mark all read
                    </button>
                  )}
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1 text-muted dark:text-muted-dark hover:text-text dark:hover:text-text-dark rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Notifications List */}
            <div className="max-h-[400px] overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-8 text-muted dark:text-muted-dark">
                  <BellIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No notifications yet</p>
                </div>
              ) : (
                <div className="divide-y divide-border dark:divide-border-dark">
                  {notifications.map((notification) => (
                    <motion.div
                      key={notification.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={`p-4 hover:bg-surface dark:hover:bg-surface-dark cursor-pointer transition-colors ${
                        !notification.is_read ? 'bg-primary/5 dark:bg-primary/10' : ''
                      }`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-start space-x-3">
                        <div className="text-2xl flex-shrink-0 mt-0.5">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className={`text-sm font-medium ${
                              !notification.is_read 
                                ? 'text-text dark:text-text-dark' 
                                : 'text-muted dark:text-muted-dark'
                            }`}>
                              {notification.title}
                            </h4>
                            {!notification.is_read && (
                              <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0"></div>
                            )}
                          </div>
                          <p className="text-sm text-muted dark:text-muted-dark mt-1 line-clamp-2">
                            {notification.message}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-muted dark:text-muted-dark">
                              {formatTimeAgo(notification.created_at)}
                            </span>
                            {notification.action_text && (
                              <span className="text-xs text-primary font-medium">
                                {notification.action_text}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-3 border-t border-border dark:border-border-dark bg-surface dark:bg-surface-dark">
                <button
                  onClick={() => {
                    window.location.hash = '/app/notifications';
                    setIsOpen(false);
                  }}
                  className="w-full text-center text-sm text-primary hover:text-primary/80 font-medium"
                >
                  View all notifications
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};