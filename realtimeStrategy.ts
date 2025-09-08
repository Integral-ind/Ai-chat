// Comprehensive Realtime Strategy for Integral App
// This file outlines which tables need realtime and why

export const REALTIME_STRATEGY = {
  // 🔥 HIGH PRIORITY - Enable realtime on these tables
  CRITICAL_TABLES: [
    'team_members',      // When someone joins/leaves team
    'teams',             // Team name/settings changes
    'projects',          // Project linking/unlinking, status changes
    'tasks',             // Task status updates, assignments
    'team_updates',      // Team activity feed
    'team_chat_messages' // Chat messages
  ],

  // 🟡 MEDIUM PRIORITY - Consider enabling if needed
  MODERATE_TABLES: [
    'departments',       // Department creation/deletion
    'department_members', // Department member changes
    'resources',         // File uploads/deletions
    'calendar_events'    // Event scheduling
  ],

  // ❌ LOW PRIORITY - Use manual refresh instead
  AVOID_REALTIME: [
    'user_profiles',     // Infrequent changes
    'notes',             // Personal data, less collaborative
    'analytics_data',    // Background data, not user-facing
    'connection_requests' // Already handled by connectService
  ]
};

// Optimistic Update Patterns
export const OPTIMISTIC_UPDATES = {
  // Update UI immediately, revert if server fails
  IMMEDIATE_UI_UPDATES: [
    'project_linking',    // Show project as linked immediately
    'task_status_change', // Update task status instantly
    'team_member_add',    // Show new member immediately
    'resource_upload'     // Show uploaded file instantly
  ],
  
  // Show loading states
  LOADING_STATES: [
    'team_creation',      // Show creating... state
    'department_creation', // Show creating... state
    'project_creation'    // Show creating... state
  ]
};