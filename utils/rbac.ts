// Role-Based Access Control (RBAC) System
import React from 'react';
import { UserRole, TeamPermission } from '../types';

export interface Permission {
  resource: string;
  action: string;
}

export interface RolePermissions {
  [key: string]: Permission[];
}

// Define permissions for each role
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.OWNER]: [
    { resource: '*', action: '*' }, // Full access
  ],
  [UserRole.ADMIN]: [
    { resource: 'teams', action: 'read' },
    { resource: 'teams', action: 'write' },
    { resource: 'projects', action: 'read' },
    { resource: 'projects', action: 'write' },
    { resource: 'tasks', action: 'read' },
    { resource: 'tasks', action: 'write' },
    { resource: 'users', action: 'read' },
    { resource: 'departments', action: 'read' },
    { resource: 'departments', action: 'write' },
    { resource: 'analytics', action: 'read' },
    { resource: 'settings', action: 'read' },
    { resource: 'settings', action: 'write' },
  ],
  [UserRole.MEMBER]: [
    { resource: 'teams', action: 'read' },
    { resource: 'projects', action: 'read' },
    { resource: 'projects', action: 'write' }, // Can create/edit assigned projects
    { resource: 'tasks', action: 'read' },
    { resource: 'tasks', action: 'write' }, // Can create/edit assigned tasks
    { resource: 'notes', action: 'read' },
    { resource: 'notes', action: 'write' },
    { resource: 'calendar', action: 'read' },
    { resource: 'calendar', action: 'write' },
    { resource: 'resources', action: 'read' },
    { resource: 'chat', action: 'read' },
    { resource: 'chat', action: 'write' },
  ],
  [UserRole.VIEWER]: [
    { resource: 'teams', action: 'read' },
    { resource: 'projects', action: 'read' },
    { resource: 'tasks', action: 'read' },
    { resource: 'notes', action: 'read' },
    { resource: 'calendar', action: 'read' },
    { resource: 'resources', action: 'read' },
    { resource: 'chat', action: 'read' },
  ],
};

// Security context for resource access
export interface SecurityContext {
  userId: string;
  role: UserRole;
  teamId?: string;
  departmentId?: string;
  permissions?: TeamPermission[];
}

export class RBACService {
  /**
   * Check if user has permission to perform action on resource
   */
  static hasPermission(
    context: SecurityContext,
    resource: string,
    action: string,
    resourceOwnerId?: string
  ): boolean {
    const permissions = ROLE_PERMISSIONS[context.role];
    
    // Owner role has full access
    if (context.role === UserRole.OWNER) {
      return true;
    }
    
    // Check if user owns the resource
    if (resourceOwnerId && resourceOwnerId === context.userId) {
      return true;
    }
    
    // Check permissions
    return permissions.some(permission => {
      const resourceMatch = permission.resource === '*' || permission.resource === resource;
      const actionMatch = permission.action === '*' || permission.action === action;
      return resourceMatch && actionMatch;
    });
  }

  /**
   * Check team-specific permissions
   */
  static hasTeamPermission(
    context: SecurityContext,
    permission: TeamPermission
  ): boolean {
    if (context.role === UserRole.OWNER) {
      return true;
    }
    
    if (context.role === UserRole.ADMIN) {
      return [
        TeamPermission.CAN_ADD_MEMBERS,
        TeamPermission.CAN_MANAGE_ROLES,
        TeamPermission.CAN_EDIT_TEAM_DETAILS,
        TeamPermission.CAN_MANAGE_DEPARTMENTS,
        TeamPermission.CAN_MANAGE_PROJECTS,
      ].includes(permission);
    }
    
    return context.permissions?.includes(permission) || false;
  }

  /**
   * Filter resources based on user permissions
   */
  static filterResourcesByPermission<T extends { id: string; ownerId?: string }>(
    context: SecurityContext,
    resources: T[],
    action: string = 'read'
  ): T[] {
    return resources.filter(resource => 
      this.hasPermission(context, 'projects', action, resource.ownerId)
    );
  }

  /**
   * Validate access to sensitive operations
   */
  static validateSensitiveOperation(
    context: SecurityContext,
    operation: 'delete_team' | 'manage_billing' | 'export_data'
  ): boolean {
    switch (operation) {
      case 'delete_team':
        return context.role === UserRole.OWNER;
      case 'manage_billing':
        return [UserRole.OWNER, UserRole.ADMIN].includes(context.role);
      case 'export_data':
        return [UserRole.OWNER, UserRole.ADMIN].includes(context.role);
      default:
        return false;
    }
  }

  /**
   * Get allowed routes for user role
   */
  static getAllowedRoutes(role: UserRole): string[] {
    const baseRoutes = ['/dashboard', '/profile', '/settings'];
    
    switch (role) {
      case UserRole.OWNER:
        return [...baseRoutes, '/admin', '/billing', '/team-management', '/analytics', '/audit-logs'];
      case UserRole.ADMIN:
        return [...baseRoutes, '/team-management', '/analytics', '/user-management'];
      case UserRole.MEMBER:
        return [...baseRoutes, '/projects', '/tasks', '/calendar', '/chat', '/resources'];
      case UserRole.VIEWER:
        return [...baseRoutes, '/projects', '/tasks', '/calendar'];
      default:
        return baseRoutes;
    }
  }
}

// React Hook for RBAC
export function useRBAC(context: SecurityContext) {
  return {
    hasPermission: (resource: string, action: string, resourceOwnerId?: string) =>
      RBACService.hasPermission(context, resource, action, resourceOwnerId),
    hasTeamPermission: (permission: TeamPermission) =>
      RBACService.hasTeamPermission(context, permission),
    canAccess: (route: string) =>
      RBACService.getAllowedRoutes(context.role).includes(route),
    validateSensitiveOperation: (operation: 'delete_team' | 'manage_billing' | 'export_data') =>
      RBACService.validateSensitiveOperation(context, operation),
  };
}

// Higher-order component for route protection
export function withRBAC<T extends object>(
  Component: React.ComponentType<T>,
  requiredPermission: { resource: string; action: string }
) {
  return function ProtectedComponent(props: T) {
    // This would typically get context from React Context or props
    // Implementation depends on your auth system
    const context = useSecurityContext(); // You'd implement this
    
    if (!RBACService.hasPermission(context, requiredPermission.resource, requiredPermission.action)) {
      return React.createElement('div', null, 'Access Denied');
    }
    
    return React.createElement(Component, props);
  };
}

// Placeholder for security context hook - implement based on your auth system
function useSecurityContext(): SecurityContext {
  // This should return the current user's security context
  throw new Error('Implement useSecurityContext hook');
}