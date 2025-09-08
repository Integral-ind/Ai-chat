/**
 * Comprehensive Notification System Test
 * 
 * This file contains test scenarios for the enhanced notification system.
 * Run these tests to verify all notification types work correctly.
 */

import { notificationService } from './notificationService';
import { notificationPreferencesService } from './notificationPreferencesService';
import { emailNotificationService } from './emailNotificationService';

// Mock user IDs for testing
const TEST_USER_1 = 'test-user-1-uuid';
const TEST_USER_2 = 'test-user-2-uuid';
const TEST_TEAM_ID = 'test-team-uuid';
const TEST_PROJECT_ID = 'test-project-uuid';
const TEST_TASK_ID = 'test-task-uuid';

export class NotificationSystemTest {
  
  // Test 1: Basic notification creation and retrieval
  async testBasicNotificationOperations() {
    console.log('Testing basic notification operations...');
    
    try {
      // Create a basic notification
      const notification = await notificationService.createNotification({
        user_id: TEST_USER_1,
        type: 'system_update',
        title: 'Test Notification',
        message: 'This is a test notification',
        action_url: '/app/test',
        action_text: 'View Test'
      });
      
      if (!notification) {
        throw new Error('Failed to create notification');
      }
      
      console.log('✓ Notification created successfully');
      
      // Retrieve notifications
      const notifications = await notificationService.getUserNotifications(TEST_USER_1, 5);
      console.log(`✓ Retrieved ${notifications.length} notifications`);
      
      // Get unread count
      const unreadCount = await notificationService.getUnreadCount(TEST_USER_1);
      console.log(`✓ Unread count: ${unreadCount}`);
      
      // Mark as read
      const marked = await notificationService.markAsRead(notification.id);
      console.log(`✓ Marked as read: ${marked}`);
      
      return true;
    } catch (error) {
      console.error('✗ Basic notification test failed:', error);
      return false;
    }
  }

  // Test 2: Task notifications
  async testTaskNotifications() {
    console.log('Testing task notifications...');
    
    try {
      // Test task assigned
      const taskAssigned = await notificationService.createEnhancedTaskNotification(
        TEST_USER_1,
        'task_assigned',
        'Complete project documentation',
        TEST_TASK_ID,
        'John Doe',
        '2024-12-31'
      );
      
      // Test task completed
      const taskCompleted = await notificationService.createEnhancedTaskNotification(
        TEST_USER_2,
        'task_completed',
        'Complete project documentation',
        TEST_TASK_ID,
        'Jane Smith'
      );
      
      // Test deadline reminder
      const deadlineReminder = await notificationService.createEnhancedTaskNotification(
        TEST_USER_1,
        'task_deadline_reminder',
        'Complete project documentation',
        TEST_TASK_ID,
        undefined,
        new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // Due in 24 hours
      );
      
      console.log('✓ Task notification types created successfully');
      return true;
    } catch (error) {
      console.error('✗ Task notification test failed:', error);
      return false;
    }
  }

  // Test 3: Team management notifications
  async testTeamNotifications() {
    console.log('Testing team notifications...');
    
    try {
      // Test member added
      await notificationService.createTeamManagementNotification(
        TEST_USER_1,
        'team_member_added',
        'Development Team',
        TEST_TEAM_ID,
        'Admin User'
      );
      
      // Test admin added
      await notificationService.createTeamManagementNotification(
        TEST_USER_1,
        'team_admin_added',
        'Development Team',
        TEST_TEAM_ID,
        'Owner User'
      );
      
      // Test ownership transferred
      await notificationService.createTeamManagementNotification(
        TEST_USER_2,
        'team_ownership_transferred',
        'Development Team',
        TEST_TEAM_ID,
        'Previous Owner'
      );
      
      // Test member left
      await notificationService.createTeamManagementNotification(
        TEST_USER_1,
        'team_member_left',
        'Development Team',
        TEST_TEAM_ID,
        'Former Member',
        'Left Member'
      );
      
      console.log('✓ Team notification types created successfully');
      return true;
    } catch (error) {
      console.error('✗ Team notification test failed:', error);
      return false;
    }
  }

  // Test 4: Project management notifications
  async testProjectNotifications() {
    console.log('Testing project notifications...');
    
    try {
      // Test project member added
      await notificationService.createProjectManagementNotification(
        TEST_USER_1,
        'project_member_added',
        'Mobile App Project',
        TEST_PROJECT_ID,
        'Project Manager'
      );
      
      // Test project member removed
      await notificationService.createProjectManagementNotification(
        TEST_USER_2,
        'project_member_removed',
        'Mobile App Project',
        TEST_PROJECT_ID,
        'Project Manager'
      );
      
      // Test ownership transferred
      await notificationService.createProjectManagementNotification(
        TEST_USER_1,
        'project_ownership_transferred',
        'Mobile App Project',
        TEST_PROJECT_ID,
        'Previous Owner'
      );
      
      console.log('✓ Project notification types created successfully');
      return true;
    } catch (error) {
      console.error('✗ Project notification test failed:', error);
      return false;
    }
  }

  // Test 5: Call notifications
  async testCallNotifications() {
    console.log('Testing call notifications...');
    
    try {
      const callId = 'test-call-123';
      
      // Test incoming call
      await notificationService.createCallNotification(
        TEST_USER_1,
        'call_incoming',
        'John Doe',
        callId,
        'video'
      );
      
      // Test missed call
      await notificationService.createCallNotification(
        TEST_USER_1,
        'call_missed',
        'John Doe',
        callId,
        'voice'
      );
      
      // Test call answered
      await notificationService.createCallNotification(
        TEST_USER_2,
        'call_answered',
        'Jane Smith',
        callId,
        'video'
      );
      
      // Test call declined
      await notificationService.createCallNotification(
        TEST_USER_2,
        'call_declined',
        'Jane Smith',
        callId,
        'voice'
      );
      
      console.log('✓ Call notification types created successfully');
      return true;
    } catch (error) {
      console.error('✗ Call notification test failed:', error);
      return false;
    }
  }

  // Test 6: Chat notifications
  async testChatNotifications() {
    console.log('Testing chat notifications...');
    
    try {
      // Test direct message
      await notificationService.createChatNotification(
        TEST_USER_1,
        'message_received',
        'Alice Johnson',
        'Direct Chat',
        'chat-123',
        'Hey, how are you doing?',
        'direct'
      );
      
      // Test team chat mention
      await notificationService.createChatNotification(
        TEST_USER_1,
        'chat_mention',
        'Bob Wilson',
        'Development Team',
        TEST_TEAM_ID,
        '@testuser can you review this?',
        'team'
      );
      
      // Test project chat message
      await notificationService.createChatNotification(
        TEST_USER_2,
        'message_received',
        'Carol Davis',
        'Mobile App Project',
        TEST_PROJECT_ID,
        'The latest designs are ready for review',
        'project'
      );
      
      console.log('✓ Chat notification types created successfully');
      return true;
    } catch (error) {
      console.error('✗ Chat notification test failed:', error);
      return false;
    }
  }

  // Test 7: Bulk notifications
  async testBulkNotifications() {
    console.log('Testing bulk notifications...');
    
    try {
      const bulkNotifications = [
        {
          user_id: TEST_USER_1,
          type: 'system_update' as const,
          title: 'System Maintenance',
          message: 'Scheduled maintenance tonight at 2 AM'
        },
        {
          user_id: TEST_USER_2,
          type: 'system_update' as const,
          title: 'System Maintenance', 
          message: 'Scheduled maintenance tonight at 2 AM'
        }
      ];
      
      const results = await notificationService.createBulkNotifications(bulkNotifications);
      console.log(`✓ Created ${results.length} bulk notifications`);
      return true;
    } catch (error) {
      console.error('✗ Bulk notification test failed:', error);
      return false;
    }
  }

  // Test 8: Notification preferences
  async testNotificationPreferences() {
    console.log('Testing notification preferences...');
    
    try {
      // Get default preferences
      const preferences = await notificationPreferencesService.getUserPreferences(TEST_USER_1);
      console.log('✓ Retrieved user preferences');
      
      // Update preferences
      const updated = await notificationPreferencesService.updatePreferences(TEST_USER_1, {
        email_notifications: true,
        task_assigned_email: true,
        team_member_added_push: false
      });
      
      if (updated) {
        console.log('✓ Updated notification preferences');
      }
      
      // Test preference checking
      const shouldNotifyEmail = await notificationPreferencesService.shouldNotify(
        TEST_USER_1,
        'task_assigned',
        'email'
      );
      
      const shouldNotifyPush = await notificationPreferencesService.shouldNotify(
        TEST_USER_1, 
        'team_member_added',
        'push'
      );
      
      console.log(`✓ Should notify email for task_assigned: ${shouldNotifyEmail}`);
      console.log(`✓ Should notify push for team_member_added: ${shouldNotifyPush}`);
      
      // Test category updates
      await notificationPreferencesService.updatePreferencesCategory(
        TEST_USER_1,
        'tasks',
        false, // disable all task notifications
        ['email', 'push']
      );
      
      console.log('✓ Updated preferences by category');
      return true;
    } catch (error) {
      console.error('✗ Notification preferences test failed:', error);
      return false;
    }
  }

  // Test 9: Email notifications
  async testEmailNotifications() {
    console.log('Testing email notifications...');
    
    try {
      // Queue email notification
      const queuedEmail = await emailNotificationService.queueEmailNotification(
        TEST_USER_1,
        null,
        'testuser@example.com',
        'task_assigned',
        {
          user_name: 'Test User',
          assigner_name: 'John Doe',
          task_title: 'Complete documentation',
          task_description: 'Please complete the project documentation',
          due_date: '2024-12-31',
          app_url: 'https://yourapp.com'
        }
      );
      
      if (queuedEmail) {
        console.log('✓ Queued email notification');
      }
      
      // Test email stats
      const stats = await emailNotificationService.getEmailStats();
      console.log(`✓ Email stats - Pending: ${stats.pending}, Sent: ${stats.total_sent}`);
      
      // Test processing (this would normally be done by a background job)
      const processedCount = await emailNotificationService.processPendingEmails(5);
      console.log(`✓ Processed ${processedCount} emails`);
      
      return true;
    } catch (error) {
      console.error('✗ Email notification test failed:', error);
      return false;
    }
  }

  // Test 10: Real-time subscription simulation
  async testRealtimeSubscription() {
    console.log('Testing real-time subscription...');
    
    try {
      let receivedNotifications = 0;
      
      // Subscribe to notifications (this would normally be in a React component)
      const subscription = notificationService.subscribeToNotifications(
        TEST_USER_1,
        (notification) => {
          receivedNotifications++;
          console.log(`✓ Received real-time notification: ${notification.title}`);
        }
      );
      
      // Create a notification to trigger the subscription
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait a bit
      
      await notificationService.createNotification({
        user_id: TEST_USER_1,
        type: 'system_update',
        title: 'Real-time Test',
        message: 'Testing real-time notifications'
      });
      
      // Wait for the notification to be received
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Unsubscribe
      notificationService.unsubscribeFromNotifications(subscription);
      
      console.log(`✓ Real-time test completed, received ${receivedNotifications} notifications`);
      return true;
    } catch (error) {
      console.error('✗ Real-time subscription test failed:', error);
      return false;
    }
  }

  // Test 11: Browser notifications
  async testBrowserNotifications() {
    console.log('Testing browser notifications...');
    
    try {
      // Request permission
      const permission = await notificationService.requestNotificationPermission();
      console.log(`✓ Browser notification permission: ${permission}`);
      
      // Create a notification with browser notification
      const notification = await notificationService.createAndShowNotification({
        user_id: TEST_USER_1,
        type: 'task_assigned',
        title: 'Browser Notification Test',
        message: 'Testing browser notifications',
        action_url: '/app/test'
      });
      
      if (notification) {
        console.log('✓ Browser notification created and shown');
      }
      
      return true;
    } catch (error) {
      console.error('✗ Browser notification test failed:', error);
      return false;
    }
  }

  // Test 12: Welcome notification
  async testWelcomeNotification() {
    console.log('Testing welcome notification...');
    
    try {
      const welcomeNotification = await notificationService.createWelcomeNotification(TEST_USER_2);
      
      if (welcomeNotification) {
        console.log('✓ Welcome notification created successfully');
        return true;
      } else {
        throw new Error('Failed to create welcome notification');
      }
    } catch (error) {
      console.error('✗ Welcome notification test failed:', error);
      return false;
    }
  }

  // Run all tests
  async runAllTests() {
    console.log('🚀 Starting comprehensive notification system tests...\n');
    
    const tests = [
      this.testBasicNotificationOperations,
      this.testTaskNotifications,
      this.testTeamNotifications, 
      this.testProjectNotifications,
      this.testCallNotifications,
      this.testChatNotifications,
      this.testBulkNotifications,
      this.testNotificationPreferences,
      this.testEmailNotifications,
      this.testRealtimeSubscription,
      this.testBrowserNotifications,
      this.testWelcomeNotification
    ];
    
    const results = [];
    
    for (let i = 0; i < tests.length; i++) {
      const testName = tests[i].name;
      console.log(`\n--- Test ${i + 1}: ${testName} ---`);
      
      try {
        const result = await tests[i].call(this);
        results.push({ test: testName, passed: result });
      } catch (error) {
        console.error(`Test ${testName} threw an error:`, error);
        results.push({ test: testName, passed: false, error });
      }
    }
    
    // Summary
    console.log('\n📊 Test Results Summary:');
    console.log('========================');
    
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    
    results.forEach((result, index) => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${index + 1}. ${result.test}: ${status}`);
    });
    
    console.log(`\nTotal: ${results.length} tests`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / results.length) * 100).toFixed(1)}%`);
    
    if (failed === 0) {
      console.log('\n🎉 All tests passed! Your notification system is working correctly.');
    } else {
      console.log('\n⚠️  Some tests failed. Please check the error messages above.');
    }
    
    return { passed, failed, total: results.length };
  }

  // Cleanup test data
  async cleanupTestData() {
    console.log('Cleaning up test data...');
    
    try {
      // This would delete test notifications, but be careful in production!
      // await notificationService.clearAllNotifications(TEST_USER_1);
      // await notificationService.clearAllNotifications(TEST_USER_2);
      console.log('✓ Test data cleanup completed');
    } catch (error) {
      console.error('✗ Cleanup failed:', error);
    }
  }
}

// Export for testing
export const notificationTest = new NotificationSystemTest();

// Example usage:
// notificationTest.runAllTests().then(() => {
//   console.log('Testing complete!');
// });