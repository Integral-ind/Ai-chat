import { supabase } from './supabaseClient';

const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    console.error("Error getting current user for presence service:", error.message);
    throw new Error(`Authentication error: ${error.message}`);
  }
  if (!user) {
    throw new Error("User not authenticated for presence operations.");
  }
  return user;
};

class PresenceService {
  private presenceChannel: any = null;
  private isInitialized = false;
  private onlineUsersCallback: ((userIds: string[]) => void) | null = null;
  private currentUserId: string | null = null;

  async initialize(onOnlineUsersUpdate: (userIds: string[]) => void) {
    if (this.isInitialized) {

      return;
    }

    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        console.warn('📡 Cannot initialize presence - no current user');
        return;
      }

      this.currentUserId = currentUser.id;
      this.onlineUsersCallback = onOnlineUsersUpdate;

      // Create a global presence channel that all users join
      this.presenceChannel = supabase.channel('global_presence', {
        config: {
          presence: {
            key: currentUser.id,
          },
        },
      });

      // Listen for presence events
      this.presenceChannel
        .on('presence', { event: 'sync' }, () => {

          this.updateOnlineUsers();
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }: any) => {

          this.updateOnlineUsers();
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }: any) => {

          this.updateOnlineUsers();
        });

      // Subscribe to the channel
      await this.presenceChannel.subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {

          // Track this user as present
          await this.presenceChannel.track({
            user_id: currentUser.id,
            full_name: currentUser.full_name || 'Unknown',
            online_at: new Date().toISOString(),
          });
          
          // Initial update
          this.updateOnlineUsers();
        }
      });

      // Handle page unload to untrack presence
      const handleBeforeUnload = () => {
        if (this.presenceChannel) {
          this.presenceChannel.untrack();
        }
      };
      
      window.addEventListener('beforeunload', handleBeforeUnload);
      window.addEventListener('pagehide', handleBeforeUnload);

      this.isInitialized = true;

    } catch (error) {
      console.error('📡 Failed to initialize presence service:', error);
    }
  }

  private updateOnlineUsers() {
    if (!this.presenceChannel || !this.onlineUsersCallback) return;

    try {
      const presenceState = this.presenceChannel.presenceState();
      const onlineUserIds = Object.keys(presenceState);

      this.onlineUsersCallback(onlineUserIds);
    } catch (error) {
      console.warn('📡 Error updating online users:', error);
    }
  }

  async getOnlineUsers(userIds: string[]): Promise<string[]> {
    // For initial load, we'll return empty array and rely on real-time updates
    // This prevents showing everyone as offline initially
    return [];
  }

  cleanup() {

    if (this.presenceChannel) {
      // Untrack presence before unsubscribing
      this.presenceChannel.untrack();
      this.presenceChannel.unsubscribe();
      this.presenceChannel = null;
    }

    this.isInitialized = false;
    this.onlineUsersCallback = null;
    this.currentUserId = null;
  }
}

export const presenceService = new PresenceService();