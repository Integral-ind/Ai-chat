import { supabase } from './supabaseClient';
import { notificationPreferencesService } from './notificationPreferencesService';

export interface EmailNotificationQueueItem {
  id: string;
  user_id: string;
  notification_id?: string;
  email_address: string;
  subject: string;
  body: string;
  template_name?: string;
  template_data?: Record<string, any>;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  attempts: number;
  max_attempts: number;
  scheduled_for: string;
  sent_at?: string;
  failed_at?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface EmailTemplate {
  name: string;
  subject: string;
  body: string;
  variables: string[];
}

class EmailNotificationService {
  // Email templates
  private emailTemplates: Record<string, EmailTemplate> = {
    task_assigned: {
      name: 'task_assigned',
      subject: 'New Task Assigned: {{task_title}}',
      body: `
        <h2>You have been assigned a new task</h2>
        <p>Hello {{user_name}},</p>
        <p><strong>{{assigner_name}}</strong> has assigned you a new task:</p>
        <div style="border-left: 4px solid #007bff; padding-left: 16px; margin: 16px 0;">
          <h3>{{task_title}}</h3>
          {{#if task_description}}
          <p>{{task_description}}</p>
          {{/if}}
          {{#if due_date}}
          <p><strong>Due:</strong> {{due_date}}</p>
          {{/if}}
        </div>
        <p>
          <a href="{{app_url}}/app/tasks" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
            View Task
          </a>
        </p>
        <p>Best regards,<br>Your Team</p>
      `,
      variables: ['user_name', 'assigner_name', 'task_title', 'task_description', 'due_date', 'app_url']
    },
    
    task_deadline_reminder: {
      name: 'task_deadline_reminder',
      subject: 'Task Deadline Reminder: {{task_title}}',
      body: `
        <h2>Task Deadline Reminder</h2>
        <p>Hello {{user_name}},</p>
        <p>This is a friendly reminder that your task is approaching its deadline:</p>
        <div style="border-left: 4px solid #ffc107; padding-left: 16px; margin: 16px 0;">
          <h3>{{task_title}}</h3>
          <p><strong>Due:</strong> {{due_date}}</p>
          <p><strong>Time remaining:</strong> {{time_remaining}}</p>
        </div>
        <p>
          <a href="{{app_url}}/app/tasks" style="background-color: #ffc107; color: black; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
            View Task
          </a>
        </p>
        <p>Best regards,<br>Your Team</p>
      `,
      variables: ['user_name', 'task_title', 'due_date', 'time_remaining', 'app_url']
    },
    
    team_member_added: {
      name: 'team_member_added',
      subject: 'Welcome to Team: {{team_name}}',
      body: `
        <h2>You've been added to a team!</h2>
        <p>Hello {{user_name}},</p>
        <p><strong>{{actor_name}}</strong> has added you to the team <strong>"{{team_name}}"</strong>.</p>
        <p>You can now collaborate with your team members, access shared projects, and stay updated on team activities.</p>
        <p>
          <a href="{{app_url}}/app/collaboration/teams/{{team_id}}" style="background-color: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
            View Team
          </a>
        </p>
        <p>Welcome to the team!<br>Your Team</p>
      `,
      variables: ['user_name', 'actor_name', 'team_name', 'team_id', 'app_url']
    },
    
    team_admin_added: {
      name: 'team_admin_added',
      subject: 'You are now an admin of Team: {{team_name}}',
      body: `
        <h2>Admin Role Assigned</h2>
        <p>Hello {{user_name}},</p>
        <p><strong>{{actor_name}}</strong> has promoted you to an admin role in the team <strong>"{{team_name}}"</strong>.</p>
        <p>As an admin, you now have additional permissions to:</p>
        <ul>
          <li>Manage team members</li>
          <li>Create and manage projects</li>
          <li>Access team settings</li>
          <li>Moderate team discussions</li>
        </ul>
        <p>
          <a href="{{app_url}}/app/collaboration/teams/{{team_id}}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
            Manage Team
          </a>
        </p>
        <p>Congratulations on your new role!<br>Your Team</p>
      `,
      variables: ['user_name', 'actor_name', 'team_name', 'team_id', 'app_url']
    },
    
    project_member_added: {
      name: 'project_member_added',
      subject: 'Added to Project: {{project_name}}',
      body: `
        <h2>You've been added to a project!</h2>
        <p>Hello {{user_name}},</p>
        <p><strong>{{actor_name}}</strong> has added you to the project <strong>"{{project_name}}"</strong>.</p>
        <p>You can now access project resources, view tasks, and collaborate with other project members.</p>
        <p>
          <a href="{{app_url}}/app/collaboration/projects/{{project_id}}" style="background-color: #17a2b8; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
            View Project
          </a>
        </p>
        <p>Happy collaborating!<br>Your Team</p>
      `,
      variables: ['user_name', 'actor_name', 'project_name', 'project_id', 'app_url']
    },
    
    system_update: {
      name: 'system_update',
      subject: 'System Update: {{update_title}}',
      body: `
        <h2>System Update Notification</h2>
        <p>Hello {{user_name}},</p>
        <p>We have an important system update to share with you:</p>
        <div style="border-left: 4px solid #6c757d; padding-left: 16px; margin: 16px 0;">
          <h3>{{update_title}}</h3>
          <p>{{update_message}}</p>
          {{#if update_date}}
          <p><strong>Date:</strong> {{update_date}}</p>
          {{/if}}
        </div>
        {{#if action_required}}
        <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 12px; border-radius: 4px; margin: 16px 0;">
          <strong>Action Required:</strong> {{action_required}}
        </div>
        {{/if}}
        <p>
          <a href="{{app_url}}/app/dashboard" style="background-color: #6c757d; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
            Go to Dashboard
          </a>
        </p>
        <p>Thank you for your attention,<br>Your Team</p>
      `,
      variables: ['user_name', 'update_title', 'update_message', 'update_date', 'action_required', 'app_url']
    }
  };

  // Queue an email notification
  async queueEmailNotification(
    userId: string,
    notificationId: string | null,
    emailAddress: string,
    templateName: string,
    templateData: Record<string, any>,
    scheduledFor?: Date
  ): Promise<EmailNotificationQueueItem | null> {
    try {
      // Check user preferences first
      const shouldSend = await notificationPreferencesService.shouldNotify(
        userId, 
        templateName.replace('_email', ''), 
        'email'
      );
      
      if (!shouldSend) {
        console.log(`Email notification skipped for user ${userId} due to preferences`);
        return null;
      }

      const template = this.emailTemplates[templateName];
      if (!template) {
        throw new Error(`Email template '${templateName}' not found`);
      }

      const subject = this.interpolateTemplate(template.subject, templateData);
      const body = this.interpolateTemplate(template.body, templateData);

      const { data, error } = await supabase
        .from('email_notifications_queue')
        .insert({
          user_id: userId,
          notification_id: notificationId,
          email_address: emailAddress,
          subject,
          body,
          template_name: templateName,
          template_data: templateData,
          scheduled_for: scheduledFor?.toISOString() || new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error queuing email notification:', error);
      return null;
    }
  }

  // Process pending email notifications
  async processPendingEmails(batchSize: number = 10): Promise<number> {
    try {
      // Get pending emails that are due to be sent
      const { data: pendingEmails, error } = await supabase
        .from('email_notifications_queue')
        .select('*')
        .eq('status', 'pending')
        .lte('scheduled_for', new Date().toISOString())
        .lt('attempts', 'max_attempts')
        .order('scheduled_for', { ascending: true })
        .limit(batchSize);

      if (error) throw error;
      if (!pendingEmails || pendingEmails.length === 0) return 0;

      let processedCount = 0;
      for (const email of pendingEmails) {
        try {
          await this.sendEmail(email);
          
          // Mark as sent
          await supabase
            .from('email_notifications_queue')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', email.id);
            
          processedCount++;
        } catch (emailError) {
          // Mark as failed and increment attempts
          await supabase
            .from('email_notifications_queue')
            .update({
              status: email.attempts + 1 >= email.max_attempts ? 'failed' : 'pending',
              attempts: email.attempts + 1,
              failed_at: new Date().toISOString(),
              error_message: emailError instanceof Error ? emailError.message : 'Unknown error',
              updated_at: new Date().toISOString()
            })
            .eq('id', email.id);
            
          console.error(`Failed to send email ${email.id}:`, emailError);
        }
      }

      return processedCount;
    } catch (error) {
      console.error('Error processing pending emails:', error);
      return 0;
    }
  }

  // Send email using your preferred email service
  private async sendEmail(emailItem: EmailNotificationQueueItem): Promise<void> {
    // This is a placeholder - implement with your email service (SendGrid, Mailgun, SES, etc.)
    // For now, we'll just log the email content
    
    console.log('Sending email:', {
      to: emailItem.email_address,
      subject: emailItem.subject,
      body: emailItem.body
    });

    // Example implementation with fetch to a webhook or email service:
    /*
    const response = await fetch(process.env.EMAIL_WEBHOOK_URL!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.EMAIL_API_KEY}`
      },
      body: JSON.stringify({
        to: emailItem.email_address,
        subject: emailItem.subject,
        html: emailItem.body,
        from: process.env.FROM_EMAIL
      })
    });

    if (!response.ok) {
      throw new Error(`Email service returned ${response.status}: ${response.statusText}`);
    }
    */

    // For demo purposes, simulate successful sending
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Simple template interpolation
  private interpolateTemplate(template: string, data: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] !== undefined ? String(data[key]) : match;
    });
  }

  // Get email notification statistics
  async getEmailStats(userId?: string, days: number = 7): Promise<{
    total_queued: number;
    total_sent: number;
    total_failed: number;
    pending: number;
  }> {
    try {
      let query = supabase.from('email_notifications_queue').select('status');
      
      if (userId) {
        query = query.eq('user_id', userId);
      }
      
      query = query.gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());
      
      const { data, error } = await query;
      if (error) throw error;

      const stats = data?.reduce((acc, item) => {
        acc.total_queued++;
        if (item.status === 'sent') acc.total_sent++;
        if (item.status === 'failed') acc.total_failed++;
        if (item.status === 'pending') acc.pending++;
        return acc;
      }, {
        total_queued: 0,
        total_sent: 0,
        total_failed: 0,
        pending: 0
      }) || {
        total_queued: 0,
        total_sent: 0,
        total_failed: 0,
        pending: 0
      };

      return stats;
    } catch (error) {
      console.error('Error getting email stats:', error);
      return {
        total_queued: 0,
        total_sent: 0,
        total_failed: 0,
        pending: 0
      };
    }
  }

  // Clean up old email queue items
  async cleanupOldEmails(daysOld: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString();
      
      const { error, count } = await supabase
        .from('email_notifications_queue')
        .delete()
        .or(`status.eq.sent,status.eq.failed`)
        .lt('created_at', cutoffDate);

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error('Error cleaning up old emails:', error);
      return 0;
    }
  }

  // Cancel pending email
  async cancelEmail(emailId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('email_notifications_queue')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', emailId)
        .eq('status', 'pending');

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error cancelling email:', error);
      return false;
    }
  }

  // Add custom email template
  addEmailTemplate(template: EmailTemplate): void {
    this.emailTemplates[template.name] = template;
  }

  // Get available email templates
  getAvailableTemplates(): string[] {
    return Object.keys(this.emailTemplates);
  }
}

export const emailNotificationService = new EmailNotificationService();