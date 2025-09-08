import { supabase } from './supabaseClient';
import { RealtimeChannel } from '@supabase/supabase-js';
import { teamService } from './teamService';
import { projectService } from './projectService';

interface RealtimeSubscription {
  channel: RealtimeChannel;
  cleanup: () => void;
}

class RealtimeService {
  private subscriptions = new Map<string, RealtimeSubscription>();

  // 🚀 TEAM REALTIME SUBSCRIPTIONS
  async subscribeToTeamChanges(
    teamId: string, 
    callbacks: {
      onTeamUpdate?: (team: any) => void;
      onMemberChange?: (member: any) => void;
      onProjectChange?: (project: any) => void;
    }
  ): Promise<string> {
    const subscriptionId = `team-${teamId}`;
    
    if (this.subscriptions.has(subscriptionId)) {
      this.unsubscribe(subscriptionId);
    }

    const channel = supabase
      .channel(`team-realtime-${teamId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'teams',
        filter: `id=eq.${teamId}`
      }, callbacks.onTeamUpdate || (() => {}))
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'team_members',
        filter: `team_id=eq.${teamId}`
      }, callbacks.onMemberChange || (() => {}))
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'projects',
        filter: `team_id=eq.${teamId}`
      }, callbacks.onProjectChange || (() => {}))
      .subscribe();

    const cleanup = () => {
      supabase.removeChannel(channel);
    };

    this.subscriptions.set(subscriptionId, { channel, cleanup });
    return subscriptionId;
  }

  // 🚀 PROJECT REALTIME SUBSCRIPTIONS
  async subscribeToProjectChanges(
    projectId: string,
    callbacks: {
      onProjectUpdate?: (project: any) => void;
      onTaskChange?: (task: any) => void;
      onResourceChange?: (resource: any) => void;
    }
  ): Promise<string> {
    const subscriptionId = `project-${projectId}`;
    
    if (this.subscriptions.has(subscriptionId)) {
      this.unsubscribe(subscriptionId);
    }

    const channel = supabase
      .channel(`project-realtime-${projectId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'projects',
        filter: `id=eq.${projectId}`
      }, callbacks.onProjectUpdate || (() => {}))
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tasks',
        filter: `project_id=eq.${projectId}`
      }, callbacks.onTaskChange || (() => {}))
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'project_resources',
        filter: `project_id=eq.${projectId}`
      }, callbacks.onResourceChange || (() => {}))
      .subscribe();

    const cleanup = () => {
      supabase.removeChannel(channel);
    };

    this.subscriptions.set(subscriptionId, { channel, cleanup });
    return subscriptionId;
  }

  // 🚀 USER'S TEAMS REALTIME (for dashboard)
  async subscribeToUserTeams(
    userId: string,
    callback: (change: any) => void
  ): Promise<string> {
    const subscriptionId = `user-teams-${userId}`;
    
    if (this.subscriptions.has(subscriptionId)) {
      this.unsubscribe(subscriptionId);
    }

    const channel = supabase
      .channel(`user-teams-${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'team_members',
        filter: `user_id=eq.${userId}`
      }, callback)
      .subscribe();

    const cleanup = () => {
      supabase.removeChannel(channel);
    };

    this.subscriptions.set(subscriptionId, { channel, cleanup });
    return subscriptionId;
  }

  // 🚀 CLEANUP SUBSCRIPTIONS
  unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      subscription.cleanup();
      this.subscriptions.delete(subscriptionId);
    }
  }

  unsubscribeAll(): void {
    this.subscriptions.forEach((subscription, id) => {
      subscription.cleanup();
    });
    this.subscriptions.clear();
  }
}

// 🚀 OPTIMISTIC UPDATE HELPERS
export class OptimisticUpdates {
  static async linkProjectToTeam(
    projectId: string, 
    teamId: string, 
    optimisticCallback: (project: any) => void,
    errorCallback: (error: string) => void
  ): Promise<void> {
    // 1. IMMEDIATELY update UI optimistically
    const optimisticProject = { id: projectId, teamId, status: 'linking...' };
    optimisticCallback(optimisticProject);

    try {
      // 2. Make actual API call
      const result = await projectService.linkProjectToTeam(projectId, teamId);
      
      // 3. Update UI with real data
      if (result) {
        optimisticCallback(result);
      }
    } catch (error: any) {
      // 4. Revert optimistic update on error
      const revertedProject = { id: projectId, teamId: null, status: 'error' };
      optimisticCallback(revertedProject);
      errorCallback(error.message);
    }
  }

  static async addTeamMember(
    teamId: string,
    userId: string,
    role: string,
    optimisticCallback: (member: any) => void,
    errorCallback: (error: string) => void
  ): Promise<void> {
    // 1. IMMEDIATELY show new member
    const optimisticMember = { 
      id: userId, 
      teamId, 
      role, 
      status: 'adding...',
      full_name: 'Adding member...'
    };
    optimisticCallback(optimisticMember);

    try {
      // 2. Make actual API call
      const result = await teamService.addTeamMember(teamId, userId, role as any);
      
      // 3. Update with real data
      if (result) {
        optimisticCallback(result);
      }
    } catch (error: any) {
      // 4. Remove optimistic member on error
      optimisticCallback(null);
      errorCallback(error.message);
    }
  }
}

export const realtimeService = new RealtimeService();