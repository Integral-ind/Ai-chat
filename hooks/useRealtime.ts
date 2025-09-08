import { useEffect, useRef, useState } from 'react';
import { realtimeService, OptimisticUpdates } from '../realtimeService';
import { TeamType, Project, TeamMember } from '../types';

// 🚀 TEAM REALTIME HOOK
export const useTeamRealtime = (
  teamId: string | null,
  onDataChange?: () => Promise<void>
) => {
  const subscriptionRef = useRef<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!teamId) return;

    const subscribe = async () => {
      try {
        const subscriptionId = await realtimeService.subscribeToTeamChanges(teamId, {
          onTeamUpdate: async (payload) => {

            if (onDataChange) await onDataChange();
            setIsConnected(true);
          },
          onMemberChange: async (payload) => {

            if (onDataChange) await onDataChange();
          },
          onProjectChange: async (payload) => {

            if (onDataChange) await onDataChange();
          }
        });
        
        subscriptionRef.current = subscriptionId;
      } catch (error) {
        console.error('Failed to subscribe to team realtime:', error);
        setIsConnected(false);
      }
    };

    subscribe();

    return () => {
      if (subscriptionRef.current) {
        realtimeService.unsubscribe(subscriptionRef.current);
        subscriptionRef.current = null;
        setIsConnected(false);
      }
    };
  }, [teamId, onDataChange]);

  return { isConnected };
};

// 🚀 PROJECT REALTIME HOOK
export const useProjectRealtime = (
  projectId: string | null,
  onDataChange?: () => Promise<void>
) => {
  const subscriptionRef = useRef<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!projectId) return;

    const subscribe = async () => {
      try {
        const subscriptionId = await realtimeService.subscribeToProjectChanges(projectId, {
          onProjectUpdate: async (payload) => {

            if (onDataChange) await onDataChange();
            setIsConnected(true);
          },
          onTaskChange: async (payload) => {

            if (onDataChange) await onDataChange();
          },
          onResourceChange: async (payload) => {

            if (onDataChange) await onDataChange();
          }
        });
        
        subscriptionRef.current = subscriptionId;
      } catch (error) {
        console.error('Failed to subscribe to project realtime:', error);
        setIsConnected(false);
      }
    };

    subscribe();

    return () => {
      if (subscriptionRef.current) {
        realtimeService.unsubscribe(subscriptionRef.current);
        subscriptionRef.current = null;
        setIsConnected(false);
      }
    };
  }, [projectId, onDataChange]);

  return { isConnected };
};

// 🚀 USER TEAMS REALTIME HOOK (for dashboard)
export const useUserTeamsRealtime = (
  userId: string | null,
  onDataChange?: () => Promise<void>
) => {
  const subscriptionRef = useRef<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!userId) return;

    const subscribe = async () => {
      try {
        const subscriptionId = await realtimeService.subscribeToUserTeams(userId, async (payload) => {

          if (onDataChange) await onDataChange();
          setIsConnected(true);
        });
        
        subscriptionRef.current = subscriptionId;
      } catch (error) {
        console.error('Failed to subscribe to user teams realtime:', error);
        setIsConnected(false);
      }
    };

    subscribe();

    return () => {
      if (subscriptionRef.current) {
        realtimeService.unsubscribe(subscriptionRef.current);
        subscriptionRef.current = null;
        setIsConnected(false);
      }
    };
  }, [userId, onDataChange]);

  return { isConnected };
};

// 🚀 OPTIMISTIC UPDATE HOOKS
export const useOptimisticProjectLink = () => {
  const [linkingProjects, setLinkingProjects] = useState<Set<string>>(new Set());

  const linkProject = async (projectId: string, teamId: string) => {
    setLinkingProjects(prev => new Set(prev).add(projectId));

    await OptimisticUpdates.linkProjectToTeam(
      projectId,
      teamId,
      (project) => {
        // Handle optimistic update callback

      },
      (error) => {
        console.error('Project link error:', error);
        setLinkingProjects(prev => {
          const newSet = new Set(prev);
          newSet.delete(projectId);
          return newSet;
        });
      }
    );

    setLinkingProjects(prev => {
      const newSet = new Set(prev);
      newSet.delete(projectId);
      return newSet;
    });
  };

  return {
    linkingProjects,
    linkProject,
    isLinking: (projectId: string) => linkingProjects.has(projectId)
  };
};

export const useOptimisticMemberAdd = () => {
  const [addingMembers, setAddingMembers] = useState<Set<string>>(new Set());

  const addMember = async (teamId: string, userId: string, role: string) => {
    setAddingMembers(prev => new Set(prev).add(userId));

    await OptimisticUpdates.addTeamMember(
      teamId,
      userId,
      role,
      (member) => {

      },
      (error) => {
        console.error('Member add error:', error);
        setAddingMembers(prev => {
          const newSet = new Set(prev);
          newSet.delete(userId);
          return newSet;
        });
      }
    );

    setAddingMembers(prev => {
      const newSet = new Set(prev);
      newSet.delete(userId);
      return newSet;
    });
  };

  return {
    addingMembers,
    addMember,
    isAdding: (userId: string) => addingMembers.has(userId)
  };
};