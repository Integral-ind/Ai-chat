import { supabase } from './supabaseClient';
import { NotificationType } from './notificationService';
import { notificationPreferencesService } from './notificationPreferencesService';

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string;
  requireInteraction?: boolean;
  silent?: boolean;
  timestamp?: number;
  data?: {
    type?: NotificationType;
    action_url?: string;
    action_text?: string;
    call_id?: string;
    call_type?: 'voice' | 'video';
    [key: string]: any;
  };
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

export interface PushDeliveryResult {
  success: boolean;
  endpoint: string;
  error?: string;
  statusCode?: number;
}

class PushNotificationService {
  private readonly defaultIcon = '/android-chrome-192x192.png';
  private readonly defaultBadge = '/favicon.ico';

  // Create push notification payload based on notification type
  createNotificationPayload(
    type: NotificationType,
    title: string,
    message: string,
    actionUrl?: string,
    actionText?: string,
    metadata?: Record<string, any>
  ): PushNotificationPayload {
    const payload: PushNotificationPayload = {
      title,
      body: message,
      icon: this.defaultIcon,
      badge: this.defaultBadge,
      tag: type,
      timestamp: Date.now(),
      data: {
        type,
        action_url: actionUrl,
        action_text: actionText,
        ...metadata
      }
    };

    // Customize payload based on notification type
    switch (type) {
      case 'call_incoming':
        payload.requireInteraction = true;
        payload.tag = `call_${metadata?.call_id}`;
        payload.actions = [
          { action: 'answer', title: 'Answer' },
          { action: 'decline', title: 'Decline' }
        ];
        payload.data = {
          ...payload.data,
          call_id: metadata?.call_id,
          call_type: metadata?.call_type || 'voice'
        };
        break;

      case 'call_missed':
      case 'call_ended':
      case 'call_answered':
      case 'call_started':
      case 'call_declined':
        payload.tag = `call_${metadata?.call_id}`;
        payload.actions = actionUrl ? [{ action: 'view', title: actionText || 'View' }] : undefined;
        break;

      case 'task_assigned':
      case 'task_due_soon':
      case 'task_deadline_reminder':
        payload.tag = `task_${metadata?.task_id}`;
        payload.actions = actionUrl ? [{ action: 'view', title: actionText || 'View Task' }] : undefined;
        break;

      case 'message_received':
      case 'chat_mention':
        payload.tag = `chat_${metadata?.chat_id}`;
        payload.actions = actionUrl ? [{ action: 'reply', title: 'Reply' }] : undefined;
        break;

      case 'team_invitation':
      case 'project_invitation':
        payload.requireInteraction = true;
        payload.actions = [
          { action: 'accept', title: 'Accept' },
          { action: 'decline', title: 'Decline' },
          { action: 'view', title: 'View Details' }
        ];
        break;

      default:
        payload.actions = actionUrl ? [{ action: 'view', title: actionText || 'View' }] : undefined;
        break;
    }

    return payload;
  }

  // Send push notification to specific user
  async sendPushNotification(
    userId: string,
    payload: PushNotificationPayload
  ): Promise<PushDeliveryResult[]> {
    try {
      // Check if user wants push notifications for this type
      if (payload.data?.type) {
        const shouldNotify = await notificationPreferencesService.shouldNotify(
          userId,
          payload.data.type,
          'push'
        );

        if (!shouldNotify) {
          console.log(`Push notifications disabled for user ${userId} and type ${payload.data.type}`);
          return [];
        }
      }

      // Get user's active push subscriptions
      const { data: subscriptions, error } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (error) {
        console.error('Error fetching push subscriptions:', error);
        return [];
      }

      if (!subscriptions || subscriptions.length === 0) {
        console.log(`No active push subscriptions found for user ${userId}`);
        return [];
      }

      // Send push notification via Supabase Edge Function
      const results: PushDeliveryResult[] = [];
      
      for (const subscription of subscriptions) {
        try {
          const { data, error } = await supabase.functions.invoke('send-push-notification', {
            body: {
              subscription: {
                endpoint: subscription.endpoint,
                keys: {
                  p256dh: subscription.p256dh_key,
                  auth: subscription.auth_key
                }
              },
              payload
            }
          });

          if (error) {
            results.push({
              success: false,
              endpoint: subscription.endpoint,
              error: error.message
            });
          } else {
            results.push({
              success: true,
              endpoint: subscription.endpoint,
              statusCode: data?.statusCode
            });

            // Update subscription usage
            await this.updateSubscriptionUsage(subscription.endpoint);
          }
        } catch (error) {
          console.error(`Error sending push to ${subscription.endpoint}:`, error);
          results.push({
            success: false,
            endpoint: subscription.endpoint,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      return results;
    } catch (error) {
      console.error('Error in sendPushNotification:', error);
      return [];
    }
  }

  // Send push notification to multiple users
  async sendBulkPushNotifications(
    userIds: string[],
    payload: PushNotificationPayload
  ): Promise<Record<string, PushDeliveryResult[]>> {
    const results: Record<string, PushDeliveryResult[]> = {};
    
    // Process users in batches to avoid overwhelming the system
    const batchSize = 10;
    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);
      const batchPromises = batch.map(async (userId) => {
        const result = await this.sendPushNotification(userId, payload);
        return { userId, result };
      });

      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(({ userId, result }) => {
        results[userId] = result;
      });
    }

    return results;
  }

  // Send push notification for specific notification types
  async sendTaskNotification(
    userId: string,
    type: 'task_assigned' | 'task_completed' | 'task_due_soon' | 'task_deadline_reminder',
    taskTitle: string,
    taskId: string,
    assignerName?: string,
    dueDate?: string
  ): Promise<PushDeliveryResult[]> {
    let title = '';
    let message = '';

    switch (type) {
      case 'task_assigned':
        title = 'New Task Assigned';
        message = `${assignerName || 'Someone'} assigned you "${taskTitle}"`;
        break;
      case 'task_completed':
        title = 'Task Completed';
        message = `Task "${taskTitle}" has been completed`;
        break;
      case 'task_due_soon':
        title = 'Task Due Soon';
        message = `Task "${taskTitle}" is due soon`;
        break;
      case 'task_deadline_reminder':
        title = 'Task Deadline Reminder';
        message = `Reminder: Task "${taskTitle}" is approaching its deadline`;
        break;
    }

    const payload = this.createNotificationPayload(
      type,
      title,
      message,
      '/app/tasks',
      'View Task',
      { task_id: taskId, task_title: taskTitle, assigner_name: assignerName, due_date: dueDate }
    );

    return this.sendPushNotification(userId, payload);
  }

  // Send push notification for call events
  async sendCallNotification(
    userId: string,
    type: 'call_incoming' | 'call_missed' | 'call_ended' | 'call_answered' | 'call_started' | 'call_declined',
    callerName: string,
    callId: string,
    callType: 'voice' | 'video' = 'voice'
  ): Promise<PushDeliveryResult[]> {
    let title = '';
    let message = '';
    let actionUrl = '';

    switch (type) {
      case 'call_incoming':
        title = `Incoming ${callType} call`;
        message = `${callerName} is calling you`;
        actionUrl = callType === 'video' ? `/app/call/${callId}` : `/app/voice/${callId}`;
        break;
      case 'call_missed':
        title = 'Missed call';
        message = `You missed a ${callType} call from ${callerName}`;
        actionUrl = '/app/connect';
        break;
      case 'call_ended':
        title = 'Call ended';
        message = `${callType === 'video' ? 'Video' : 'Voice'} call with ${callerName} has ended`;
        break;
      case 'call_answered':
        title = 'Call answered';
        message = `${callerName} answered your call`;
        break;
      case 'call_started':
        title = 'Call started';
        message = `${callType === 'video' ? 'Video' : 'Voice'} call with ${callerName} has started`;
        break;
      case 'call_declined':
        title = 'Call declined';
        message = `${callerName} declined your ${callType} call`;
        actionUrl = '/app/connect';
        break;
    }

    const payload = this.createNotificationPayload(
      type,
      title,
      message,
      actionUrl,
      actionUrl ? 'View' : undefined,
      { call_id: callId, caller_name: callerName, call_type: callType }
    );

    return this.sendPushNotification(userId, payload);
  }

  // Send push notification for team/project events
  async sendTeamNotification(
    userId: string,
    type: 'team_invitation' | 'project_invitation' | 'team_member_added' | 'team_admin_added',
    entityName: string,
    actorName: string,
    entityId?: string
  ): Promise<PushDeliveryResult[]> {
    let title = '';
    let message = '';
    let actionUrl = '';

    const isTeam = type.includes('team');
    const entityType = isTeam ? 'team' : 'project';

    switch (type) {
      case 'team_invitation':
      case 'project_invitation':
        title = `${isTeam ? 'Team' : 'Project'} Invitation`;
        message = `${actorName} invited you to join ${entityType} "${entityName}"`;
        actionUrl = isTeam ? '/app/collaboration/teams' : '/app/collaboration/projects';
        break;
      case 'team_member_added':
        title = 'Added to Team';
        message = `${actorName} added you to team "${entityName}"`;
        actionUrl = entityId ? `/app/collaboration/teams/${entityId}` : '/app/collaboration/teams';
        break;
      case 'team_admin_added':
        title = 'Promoted to Admin';
        message = `${actorName} made you an admin of team "${entityName}"`;
        actionUrl = entityId ? `/app/collaboration/teams/${entityId}` : '/app/collaboration/teams';
        break;
    }

    const payload = this.createNotificationPayload(
      type,
      title,
      message,
      actionUrl,
      'View',
      { entity_name: entityName, actor_name: actorName, entity_id: entityId }
    );

    return this.sendPushNotification(userId, payload);
  }

  // Send push notification for chat events
  async sendChatNotification(
    userId: string,
    type: 'message_received' | 'chat_mention',
    senderName: string,
    chatName: string,
    chatId: string,
    messagePreview: string,
    chatType: 'team' | 'project' | 'direct' = 'direct'
  ): Promise<PushDeliveryResult[]> {
    let title = '';
    let message = '';
    let actionUrl = '';

    switch (chatType) {
      case 'team':
        actionUrl = `/app/collaboration/teams/${chatId}/chat`;
        break;
      case 'project':
        actionUrl = `/app/collaboration/projects/${chatId}/chat`;
        break;
      case 'direct':
        actionUrl = `/app/chat/${chatId}`;
        break;
    }

    switch (type) {
      case 'message_received':
        title = `New message from ${senderName}`;
        message = chatType === 'direct' ? messagePreview : `In ${chatName}: ${messagePreview}`;
        break;
      case 'chat_mention':
        title = `You were mentioned by ${senderName}`;
        message = chatType === 'direct' ? messagePreview : `In ${chatName}: ${messagePreview}`;
        break;
    }

    const payload = this.createNotificationPayload(
      type,
      title,
      message,
      actionUrl,
      'Reply',
      {
        chat_id: chatId,
        chat_name: chatName,
        chat_type: chatType,
        sender_name: senderName,
        message_preview: messagePreview
      }
    );

    return this.sendPushNotification(userId, payload);
  }

  // Send system notification
  async sendSystemNotification(
    userId: string,
    title: string,
    message: string,
    actionUrl?: string,
    actionText?: string
  ): Promise<PushDeliveryResult[]> {
    const payload = this.createNotificationPayload(
      'system_update',
      title,
      message,
      actionUrl,
      actionText
    );

    return this.sendPushNotification(userId, payload);
  }

  // Update subscription usage tracking
  private async updateSubscriptionUsage(endpoint: string): Promise<void> {
    try {
      await supabase.rpc('mark_push_subscription_used', {
        p_endpoint: endpoint
      });
    } catch (error) {
      console.error('Error updating subscription usage:', error);
    }
  }

  // Handle failed push deliveries (mark subscriptions as inactive)
  async handleFailedDelivery(endpoint: string, error: string): Promise<void> {
    try {
      // Common errors that indicate the subscription should be deactivated
      const deactivationErrors = [
        'gone',
        'invalid',
        'unsubscribed',
        'expired',
        'not_found'
      ];

      const shouldDeactivate = deactivationErrors.some(errorType => 
        error.toLowerCase().includes(errorType)
      );

      if (shouldDeactivate) {
        await supabase
          .from('push_subscriptions')
          .update({ 
            is_active: false, 
            updated_at: new Date().toISOString() 
          })
          .eq('endpoint', endpoint);

        console.log(`Deactivated push subscription for endpoint: ${endpoint}`);
      }
    } catch (error) {
      console.error('Error handling failed delivery:', error);
    }
  }

  // Get push delivery statistics
  async getDeliveryStats(userId?: string): Promise<{
    total_sent: number;
    successful_deliveries: number;
    failed_deliveries: number;
    active_subscriptions: number;
  }> {
    try {
      // This would require additional tables to track delivery statistics
      // For now, return basic subscription stats
      const { data, error } = await supabase
        .from('push_subscription_stats')
        .select('*')
        .eq(userId ? 'user_id' : 'user_id', userId || 'all');

      if (error) throw error;

      // Return mock stats for now
      return {
        total_sent: 0,
        successful_deliveries: 0,
        failed_deliveries: 0,
        active_subscriptions: data?.reduce((sum, stat) => sum + stat.active_subscriptions, 0) || 0
      };
    } catch (error) {
      console.error('Error fetching delivery stats:', error);
      return {
        total_sent: 0,
        successful_deliveries: 0,
        failed_deliveries: 0,
        active_subscriptions: 0
      };
    }
  }
}

export const pushNotificationService = new PushNotificationService();