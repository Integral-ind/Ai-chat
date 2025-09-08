import { supabase } from './supabaseClient';
import { UserPublicProfile, UserSearchResult, ConnectionStatus, ConnectionRequest, ConnectionRequestWithProfile, ConnectedUser, ChatMessage, GlobalSearchResultItem } from './types';
import { Database } from './types_db';
import { RealtimeChannel } from '@supabase/supabase-js';
import { UserCircleIcon } from './constants';
import { StreamChat } from 'stream-chat';

type DbConnectionRequest = Database['public']['Tables']['connection_requests']['Row'];
type DbConnection = Database['public']['Tables']['connections']['Row'];
type DbUserProfile = Database['public']['Tables']['user_profiles']['Row'];
type DbChatMessage = Database['public']['Tables']['messages']['Row'];

// Stream Chat configuration
const STREAM_API_KEY = process.env.REACT_APP_STREAM_API_KEY || ''; // Secure API key from environment
const STREAM_TOKEN_SERVER = process.env.REACT_APP_STREAM_TOKEN_SERVER || 'http://localhost:3001'; // Backend server URL

const getCurrentUserIdFromAuth = async (): Promise<string> => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    console.error("User not authenticated:", error);
    throw new Error("User not authenticated");
  }
  return user.id;
};

// Helper to get user profile data
const mapProfileToPublicProfile = (profile: DbUserProfile): UserPublicProfile => {
  return {
    id: profile.id,
    email: profile.email || '',
    full_name: profile.full_name || profile.email?.split('@')[0] || 'User',
    avatar_url: profile.avatar_url || null,
  };
};

const mapDbMessageToFrontend = (dbMessage: DbChatMessage, senderProfile?: UserPublicProfile): ChatMessage => {
  return {
    id: dbMessage.id,
    sender_id: dbMessage.sender_id,
    receiver_id: dbMessage.receiver_id,
    content: dbMessage.content,
    created_at: dbMessage.created_at,
    sender_profile: senderProfile,
  };
};

export const connectService = {
  // Stream Chat methods
  async initializeStreamChat(currentUser: any): Promise<StreamChat | null> {
    try {
      const client = StreamChat.getInstance(STREAM_API_KEY);
      
      // Get token from your backend
      const response = await fetch(`${STREAM_TOKEN_SERVER}/stream-token?user_id=${currentUser.id}`);
      const { token } = await response.json();
      
      // Create/update user in Stream
      await fetch(`${STREAM_TOKEN_SERVER}/create-stream-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          name: currentUser.name || currentUser.email?.split('@')[0] || 'User'
        })
      });
      
      // Connect user
      await client.connectUser(
        {
          id: currentUser.id,
          name: currentUser.name || currentUser.email?.split('@')[0] || 'User',
          image: currentUser.avatar
        },
        token
      );
      
      return client;
    } catch (error) {
      console.error('Error initializing Stream Chat:', error);
      return null;
    }
  },

  async createOrGetStreamChannel(streamClient: StreamChat, currentUserId: string, otherUserId: string): Promise<any> {
    try {
      // Create a consistent channel ID based on user IDs
      const channelId = [currentUserId, otherUserId].sort().join('-');
      const channel = streamClient.channel('messaging', channelId, {
        members: [currentUserId, otherUserId],
        created_by_id: currentUserId,
      });
      
      await channel.create();
      return channel;
    } catch (error) {
      console.error('Error creating/getting Stream channel:', error);
      throw error;
    }
  },

  // Existing connection methods (unchanged)
  async searchUsersLegacy(query: string): Promise<UserSearchResult[]> {
    const currentUserId = await getCurrentUserIdFromAuth();
    
    if (!query.trim()) {
      return [];
    }
    
    const { data: users, error: usersError } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, avatar_url, updated_at') 
        .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
        .neq('id', currentUserId)
        .limit(50);

    if (usersError) {
      console.error('Error fetching user profiles for search:', usersError);
      throw new Error(`Search failed: ${usersError.message}`);
    }

    if (!users || users.length === 0) {
      return [];
    }
    
    const filteredUsers = users.map(mapProfileToPublicProfile);
    const userIds = filteredUsers.map(u => u.id);

    const { data: connections, error: connError } = await supabase
      .from('connections')
      .select('*')
      .or(`and(user_a_id.eq.${currentUserId},user_b_id.in.(${userIds.join(',')})),and(user_b_id.eq.${currentUserId},user_a_id.in.(${userIds.join(',')}))`);

    if (connError) console.error("Error fetching connections:", connError);

    const { data: requests, error: reqError } = await supabase
      .from('connection_requests')
      .select('*')
      .or(`and(sender_id.eq.${currentUserId},receiver_id.in.(${userIds.join(',')})),and(receiver_id.eq.${currentUserId},sender_id.in.(${userIds.join(',')}))`);
      
    if (reqError) console.error("Error fetching requests:", reqError);

    return filteredUsers.map(user => {
      let status: ConnectionStatus = 'none';
      let requestId: string | undefined;
      const existingConnection = connections?.find(
        c => (c.user_a_id === currentUserId && c.user_b_id === user.id) || 
             (c.user_a_id === user.id && c.user_b_id === currentUserId)
      );
      if (existingConnection) status = 'connected';
      else {
        const relevantRequest = requests?.find(r => 
            (r.sender_id === currentUserId && r.receiver_id === user.id) ||
            (r.receiver_id === currentUserId && r.sender_id === user.id)
        );
        if (relevantRequest && relevantRequest.status === 'pending') {
          status = relevantRequest.sender_id === currentUserId ? 'pending_sent' : 'pending_received';
          requestId = relevantRequest.id;
        }
      }
      return { ...user, connection_status: status, request_id: requestId };
    });
  },

  async search(query: string, currentUserId?: string): Promise<GlobalSearchResultItem[]> {
    if (!query.trim()) return [];
    const userIdToQuery = currentUserId || (await getCurrentUserIdFromAuth());

    const { data: users, error: usersError } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, avatar_url, updated_at') 
        .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
        .neq('id', userIdToQuery) 
        .limit(10); 

    if (usersError) {
      console.error('Error searching users:', usersError);
      return [];
    }
    if (!users || users.length === 0) return [];

    return users.map(user => {
      const profile = mapProfileToPublicProfile(user);
      return {
        id: profile.id,
        title: profile.full_name || profile.email,
        type: 'user',
        description: profile.email,
        icon: UserCircleIcon,
        path: '/app/connect',
        state: { viewUserProfileId: profile.id, fromSearch: true },
        timestamp: user.updated_at || undefined,
      };
    });
  },

  async sendConnectionRequest(receiverId: string): Promise<DbConnectionRequest> {
    const senderId = await getCurrentUserIdFromAuth();
    
    if (senderId === receiverId) {
      throw new Error("Cannot send connection request to yourself");
    }

    // Check if already connected
    const { data: existingConnection } = await supabase
      .from('connections')
      .select('id')
      .or(`and(user_a_id.eq.${senderId},user_b_id.eq.${receiverId}),and(user_a_id.eq.${receiverId},user_b_id.eq.${senderId})`)
      .single();

    if (existingConnection) {
      throw new Error("Already connected with this user");
    }

    // Check for existing pending request
    const { data: existingRequest } = await supabase
      .from('connection_requests')
      .select('id, status, sender_id')
      .or(`and(sender_id.eq.${senderId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${senderId})`)
      .eq('status', 'pending')
      .single();

    if (existingRequest) {
      if (existingRequest.sender_id === senderId) {
        throw new Error("Connection request already sent");
      } else {
        throw new Error("This user has already sent you a connection request");
      }
    }

    // Clean up any old rejected/cancelled requests
    const { error: cleanupError } = await supabase
      .from('connection_requests')
      .delete()
      .or(`and(sender_id.eq.${senderId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${senderId})`)
      .in('status', ['cancelled', 'rejected', 'declined']);

    if (cleanupError) {
      console.warn("Error cleaning up old requests:", cleanupError);
    }

    // Create new request
    const { data, error } = await supabase
      .from('connection_requests')
      .insert({ 
        sender_id: senderId, 
        receiver_id: receiverId, 
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) {
      console.error("Error sending connection request:", error);
      throw new Error(`Failed to send connection request: ${error.message}`);
    }
    
    return data;
  },

  async acceptConnectionRequest(requestId: string): Promise<DbConnection> {
    const currentUserId = await getCurrentUserIdFromAuth();
    
    // Get the request first to validate it
    const { data: request, error: getRequestError } = await supabase
      .from('connection_requests')
      .select('*')
      .eq('id', requestId)
      .eq('receiver_id', currentUserId)
      .eq('status', 'pending')
      .single();

    if (getRequestError || !request) {
      console.error("Error fetching request:", getRequestError);
      throw new Error("Connection request not found or already processed");
    }

    // Update request status
    const { error: updateError } = await supabase
      .from('connection_requests')
      .update({ 
        status: 'accepted', 
        updated_at: new Date().toISOString() 
      })
      .eq('id', requestId);

    if (updateError) {
      console.error("Error updating request status:", updateError);
      throw new Error(`Failed to accept request: ${updateError.message}`);
    }

    // Create connection (ensure consistent ordering)
    const user_a_id = request.sender_id < request.receiver_id ? request.sender_id : request.receiver_id;
    const user_b_id = request.sender_id < request.receiver_id ? request.receiver_id : request.sender_id;

    const { data: connection, error: connectionError } = await supabase
      .from('connections')
      .insert({ 
        user_a_id, 
        user_b_id,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (connectionError) {
      console.error("Error creating connection:", connectionError);
      // Try to rollback the request status
      await supabase
        .from('connection_requests')
        .update({ status: 'pending' })
        .eq('id', requestId);
      
      throw new Error(`Failed to create connection: ${connectionError.message}`);
    }
    
    return connection;
  },

  async rejectConnectionRequest(requestId: string): Promise<DbConnectionRequest> {
    const currentUserId = await getCurrentUserIdFromAuth();
    
    const { data, error } = await supabase
      .from('connection_requests')
      .update({ 
        status: 'rejected', 
        updated_at: new Date().toISOString() 
      })
      .eq('id', requestId)
      .eq('receiver_id', currentUserId)
      .eq('status', 'pending')
      .select()
      .single();
      
    if (error) {
      console.error("Error rejecting request:", error);
      throw new Error(`Failed to reject request: ${error.message}`);
    }
    
    if (!data) {
      throw new Error("Connection request not found or already processed");
    }
    
    return data;
  },

  async cancelConnectionRequest(requestId: string): Promise<DbConnectionRequest> {
    const currentUserId = await getCurrentUserIdFromAuth();
    
    const { data, error } = await supabase
      .from('connection_requests')
      .update({ 
        status: 'cancelled', 
        updated_at: new Date().toISOString() 
      })
      .eq('id', requestId)
      .eq('sender_id', currentUserId)
      .eq('status', 'pending')
      .select()
      .single();
      
    if (error) {
      console.error("Error cancelling request:", error);
      throw new Error(`Failed to cancel request: ${error.message}`);
    }
    
    if (!data) {
      throw new Error("Connection request not found or already processed");
    }
    
    return data;
  },

  async getConnections(currentUserId: string): Promise<ConnectedUser[]> {
    if (!currentUserId) {
      throw new Error("currentUserId is required for getConnections");
    }
    
    const { data: connections, error } = await supabase
      .from('connections')
      .select('id, user_a_id, user_b_id, created_at')
      .or(`user_a_id.eq.${currentUserId},user_b_id.eq.${currentUserId}`)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error("Error fetching connections:", error);
      throw new Error(`Failed to fetch connections: ${error.message}`);
    }
    
    if (!connections || connections.length === 0) {
      return [];
    }

    // Get the IDs of connected users
    const connectedUserIds = connections.map(conn => 
      conn.user_a_id === currentUserId ? conn.user_b_id : conn.user_a_id
    );
    
    if (connectedUserIds.length === 0) {
      return [];
    }

    // Fetch profiles for connected users
    const { data: profiles, error: profileError } = await supabase
      .from('user_profiles') 
      .select('id, full_name, email, avatar_url, updated_at') 
      .in('id', connectedUserIds);

    if (profileError) {
      console.error("Error fetching connection profiles:", profileError);
      throw new Error(`Failed to fetch connection profiles: ${profileError.message}`);
    }
    
    if (!profiles) {
      return [];
    }

    // Map profiles with connection data
    return profiles.map(profile => {
      const connection = connections.find(c => 
        c.user_a_id === profile.id || c.user_b_id === profile.id
      );
      return {
        ...mapProfileToPublicProfile(profile),
        connection_id: connection!.id,
      };
    });
  },

  async getPendingRequests(currentUserId: string): Promise<ConnectionRequestWithProfile[]> {
    if (!currentUserId) {
      throw new Error("currentUserId is required for getPendingRequests");
    }
    
    const { data: requestsData, error: requestsError } = await supabase
        .from('connection_requests')
        .select('*')
        .eq('receiver_id', currentUserId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

    if (requestsError) {
        console.error("Error fetching pending requests:", requestsError);
        throw new Error(`Failed to fetch pending requests: ${requestsError.message}`);
    }
    
    if (!requestsData || requestsData.length === 0) {
      return [];
    }

    const senderIds = requestsData.map(req => req.sender_id).filter(Boolean) as string[];
    if (senderIds.length === 0) {
      return [];
    }

    const { data: senderProfiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, avatar_url, updated_at') 
        .in('id', senderIds);

    if (profilesError) {
        console.error("Error fetching sender profiles:", profilesError);
        throw new Error(`Failed to fetch sender profiles: ${profilesError.message}`);
    }
    
    if (!senderProfiles) {
      return [];
    }

    return requestsData.map(req => {
        const profile = senderProfiles.find(p => p.id === req.sender_id);
        return {
            ...req,
            status: req.status as ConnectionStatus,
            sender_profile: profile ? mapProfileToPublicProfile(profile) : undefined
        };
    }).filter(req => req.sender_profile);
  },

  async getSentRequests(currentUserId: string): Promise<ConnectionRequestWithProfile[]> {
    if (!currentUserId) {
      throw new Error("currentUserId is required for getSentRequests");
    }
    
    const { data: requestsData, error: requestsError } = await supabase
        .from('connection_requests')
        .select('*')
        .eq('sender_id', currentUserId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

    if (requestsError) {
        console.error("Error fetching sent requests:", requestsError);
        throw new Error(`Failed to fetch sent requests: ${requestsError.message}`);
    }
    
    if (!requestsData || requestsData.length === 0) {
      return [];
    }

    const receiverIds = requestsData.map(req => req.receiver_id).filter(Boolean) as string[];
    if (receiverIds.length === 0) {
      return [];
    }

    const { data: receiverProfiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, avatar_url, updated_at') 
        .in('id', receiverIds);

    if (profilesError) {
        console.error("Error fetching receiver profiles:", profilesError);
        throw new Error(`Failed to fetch receiver profiles: ${profilesError.message}`);
    }
    
    if (!receiverProfiles) {
      return [];
    }

    return requestsData.map(req => {
        const profile = receiverProfiles.find(p => p.id === req.receiver_id);
        return {
            ...req,
            status: req.status as ConnectionStatus,
            receiver_profile: profile ? mapProfileToPublicProfile(profile) : undefined
        };
    }).filter(req => req.receiver_profile);
  },
  
  async removeConnection(connectionId: string): Promise<boolean> {
    const currentUserId = await getCurrentUserIdFromAuth();
    
    // Verify the connection exists and user is authorized
    const { data: connection, error: getError } = await supabase
      .from('connections')
      .select('*')
      .eq('id', connectionId)
      .or(`user_a_id.eq.${currentUserId},user_b_id.eq.${currentUserId}`)
      .single();

    if (getError || !connection) {
      console.error('Error fetching connection for removal:', getError);
      throw new Error("Connection not found or unauthorized");
    }

    // Delete the connection
    const { error: deleteError } = await supabase
      .from('connections')
      .delete()
      .eq('id', connectionId);

    if (deleteError) {
      console.error('Error deleting connection:', deleteError);
      throw new Error(`Failed to remove connection: ${deleteError.message}`);
    }

    // Optionally clean up related accepted connection requests
    const otherUserId = connection.user_a_id === currentUserId ? connection.user_b_id : connection.user_a_id;
    
    const { error: cleanupError } = await supabase
      .from('connection_requests')
      .delete()
      .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUserId})`)
      .eq('status', 'accepted');

    if (cleanupError) {
      console.warn('Error cleaning up connection requests:', cleanupError);
    }
    
    return true;
  },

  async getConnectionCounts(currentUserId: string): Promise<{
    connections: number;
    pendingRequests: number;
    sentRequests: number;
  }> {
    if (!currentUserId) {
      throw new Error("currentUserId is required for getConnectionCounts");
    }

    try {
      const [connectionsResult, pendingResult, sentResult] = await Promise.all([
        supabase.from('connections').select('id', { count: 'exact' }).or(`user_a_id.eq.${currentUserId},user_b_id.eq.${currentUserId}`),
        supabase.from('connection_requests').select('id', { count: 'exact' }).eq('receiver_id', currentUserId).eq('status', 'pending'),
        supabase.from('connection_requests').select('id', { count: 'exact' }).eq('sender_id', currentUserId).eq('status', 'pending')
      ]);

      return {
        connections: connectionsResult.count || 0,
        pendingRequests: pendingResult.count || 0,
        sentRequests: sentResult.count || 0
      };
    } catch (error) {
      console.error('Error fetching connection counts:', error);
      return { connections: 0, pendingRequests: 0, sentRequests: 0 };
    }
  },

  async getUserConnectionStatus(currentUserId: string, targetUserId: string): Promise<{
    status: ConnectionStatus;
    requestId?: string;
    connectionId?: string;
  }> {
    if (!currentUserId || !targetUserId) {
      throw new Error("Both currentUserId and targetUserId are required");
    }

    if (currentUserId === targetUserId) {
      return { status: 'none' };
    }

    // Check for existing connection
    const { data: connection } = await supabase
      .from('connections')
      .select('id')
      .or(`and(user_a_id.eq.${currentUserId},user_b_id.eq.${targetUserId}),and(user_a_id.eq.${targetUserId},user_b_id.eq.${currentUserId})`)
      .single();

    if (connection) {
      return { status: 'connected', connectionId: connection.id };
    }

    // Check for pending requests
    const { data: request } = await supabase
      .from('connection_requests')
      .select('id, sender_id, receiver_id')
      .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${targetUserId}),and(sender_id.eq.${targetUserId},receiver_id.eq.${currentUserId})`)
      .eq('status', 'pending')
      .single();

    if (request) {
      const status = request.sender_id === currentUserId ? 'pending_sent' : 'pending_received';
      return { status, requestId: request.id };
    }

    return { status: 'none' };
  },

  // Legacy chat methods (keeping for backward compatibility)
  async getMessages(userId1: string, userId2: string): Promise<ChatMessage[]> {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${userId1},receiver_id.eq.${userId2}),and(sender_id.eq.${userId2},receiver_id.eq.${userId1})`)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      throw new Error(`Failed to fetch messages: ${error.message}`);
    }
    return data.map(msg => mapDbMessageToFrontend(msg));
  },

  async sendMessage(senderId: string, receiverId: string, content: string): Promise<ChatMessage> {
    if (!content.trim()) {
      throw new Error("Message content cannot be empty.");
    }
    const { data, error } = await supabase
      .from('messages')
      .insert({ sender_id: senderId, receiver_id: receiverId, content: content.trim() })
      .select()
      .single();

    if (error) {
      console.error('Error sending message:', error);
      throw new Error(`Failed to send message: ${error.message}`);
    }
    return mapDbMessageToFrontend(data);
  },
  
  subscribeToMessages(
    currentUserAuthId: string,
    onNewMessage: (message: ChatMessage) => void
  ): RealtimeChannel | null {
    if (!currentUserAuthId) {
      console.error("Cannot subscribe to messages: Current User ID is missing.");
      return null;
    }
  
    const channelName = `messages-for-${currentUserAuthId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${currentUserAuthId}`,
        },
        async (payload) => {
          try {
            const newMessage = payload.new as DbChatMessage;
            const { data: senderProfile } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('id', newMessage.sender_id)
                .single();

            onNewMessage(mapDbMessageToFrontend(newMessage, senderProfile ? mapProfileToPublicProfile(senderProfile) : undefined));
          } catch (processingError) {
            console.error("Error processing incoming message payload:", processingError);
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {

        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error(`❌ Direct message subscription ERROR for ${currentUserAuthId}: ${status}`, err);
        }
      });
  
    return channel;
  }
};