import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { StreamChat, Channel } from 'stream-chat';
import { Chat } from 'stream-chat-react';
import { User as FrontendUser } from '../types';
import { supabase } from '../supabaseClient';

// Stream Chat configuration with fallback
const STREAM_API_KEY = process.env.REACT_APP_STREAM_API_KEY || import.meta.env.VITE_STREAM_API_KEY;

if (!STREAM_API_KEY) {
  console.error('🚨 Stream API Key Configuration Error:', {
    processEnv: !!process.env.REACT_APP_STREAM_API_KEY,
    importMeta: !!(import.meta.env?.VITE_STREAM_API_KEY),
    available: Object.keys(process.env).filter(key => key.includes('STREAM'))
  });
  throw new Error('Stream API key is not configured. Please set REACT_APP_STREAM_API_KEY in your environment variables.');
}

interface StreamUser {
  id: string;
  name: string;
  image?: string;
  email?: string;
}

interface StreamContextType {
  client: StreamChat | null;
  isLoading: boolean;
  error: string | null;
  isConnected: boolean;
  initializeClient: (user: FrontendUser) => Promise<StreamChat | null>;
  disconnectClient: () => Promise<void>;
  createOrGetChannel: (currentUserId: string, otherUserId: string) => Promise<any>;
  createOrGetChannelWithUsers: (user1: StreamUser, user2: StreamUser) => Promise<Channel | null>;
  retryConnection: () => void;
}

const StreamContext = createContext<StreamContextType | undefined>(undefined);

export const useStreamChat = () => {
  const context = useContext(StreamContext);
  if (!context) {
    throw new Error('useStreamChat must be used within a StreamProvider');
  }
  return context;
};

interface StreamProviderProps {
  children: React.ReactNode;
  currentUser: FrontendUser | null;
}

export const StreamProvider: React.FC<StreamProviderProps> = ({ children, currentUser }) => {
  const [client, setClient] = useState<StreamChat | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastInitAttempt, setLastInitAttempt] = useState<number>(0);
  const [retryCount, setRetryCount] = useState<number>(0);

  const initializeClient = useCallback(async (user: FrontendUser): Promise<StreamChat | null> => {

    if (!user || !user.id) {
      console.error('❌ STREAM INIT - No user or user ID provided');
      return null;
    }
    
    // Check if client is already connected for this user
    if (client && client.userID === user.id && client.user && isConnected) {

      setRetryCount(0); // Reset retry count on successful connection
      return client;
    }

    // Prevent multiple simultaneous initialization attempts
    if (isLoading) {

      return null;
    }

    // Rate limiting: prevent too frequent attempts
    const now = Date.now();
    const timeSinceLastAttempt = now - lastInitAttempt;
    const minInterval = Math.min(1000 * Math.pow(2, retryCount), 30000); // Exponential backoff, max 30s
    
    if (timeSinceLastAttempt < minInterval) {

      return null;
    }

    setLastInitAttempt(now);

    setIsLoading(true);
    setError(null);
    
    // Safely disconnect existing client
    try {
      if (client && client.userID && client.userID !== user.id) {

        await client.disconnectUser();
        setClient(null);
        setIsConnected(false);
      }
    } catch (disconnectError) {
      console.warn('⚠️ STREAM INIT - Error disconnecting previous user:', disconnectError);
    }

    let newClient = client;
    if (!newClient || newClient.userID !== user.id) {
      newClient = StreamChat.getInstance(STREAM_API_KEY);
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session for Stream token');

      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('stream-token', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (tokenError) throw tokenError;
      const token = tokenData.token;

      const streamUser = {
        id: user.id,
        name: user.full_name || user.email || 'Anonymous User',
        image: user.avatar_url,
        email: user.email,
      };

      // Check if already connected before attempting connection
      if (!newClient.user || newClient.userID !== user.id) {
        await newClient.connectUser(streamUser, token);
      }

      setClient(newClient);
      setIsConnected(true);
      setRetryCount(0); // Reset retry count on success
      return newClient;
    } catch (err: any) {
      console.error('❌ STREAM INIT - Connection failed:', err);
      setRetryCount(prev => prev + 1); // Increment retry count on failure
      setError(err.message || 'Failed to initialize Stream Chat');
      
      // Don't set client to null if it was already working
      if (!client || client.userID !== user.id) {
        setClient(null);
      }
      setIsConnected(false);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [client, isConnected, isLoading, lastInitAttempt, retryCount]);

  const disconnectClient = useCallback(async () => {
    if (client) {
      try {

        await client.disconnectUser();

      } catch (error) {
        console.warn('⚠️ STREAM - Error during disconnection:', error);
      } finally {
        setClient(null);
        setIsConnected(false);
        setRetryCount(0);
      }
    }
  }, [client]);

  const retryConnection = useCallback(() => {
    if (currentUser) {
      initializeClient(currentUser);
    }
  }, [currentUser, initializeClient]);
  
  const ensureUsersExistViaEdgeFunction = useCallback(async (user1: StreamUser, user2: StreamUser) => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('No active session for user sync');
        const userSync = (user: StreamUser) => supabase.functions.invoke('create-stream-user', {
            body: { userId: user.id, name: user.name, email: user.email, avatar: user.image },
            headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const [result1, result2] = await Promise.all([userSync(user1), userSync(user2)]);
        if (result1.error) console.warn(`⚠️ User 1 sync warning:`, result1.error.message);
        if (result2.error) console.warn(`⚠️ User 2 sync warning:`, result2.error.message);
    } catch (error) {
        console.warn('⚠️ Edge Function user sync failed:', error);
    }
  }, []);

  const createOrGetChannelWithUsers = useCallback(async (user1: StreamUser, user2: StreamUser): Promise<Channel | null> => {
    if (!client || !isConnected) {
      alert('Chat is not connected. Please wait.');
      return null;
    }
    try {
      await ensureUsersExistViaEdgeFunction(user1, user2);
      const channel = client.channel('messaging', { members: [user1.id, user2.id], created_by_id: user1.id });
      await channel.watch();
      return channel;
    } catch (err: any) {
      console.error('❌ STREAM - Error creating channel:', err);
      return null;
    }
  }, [client, isConnected, ensureUsersExistViaEdgeFunction]);

  const createOrGetChannel = useCallback(async (currentUserId: string, otherUserId: string) => {
    if (!client) throw new Error('Stream Chat client not initialized');
    try {
        let user1Data: StreamUser = { id: currentUserId, name: 'Me' };
        let user2Data: StreamUser = { id: otherUserId, name: 'User' };
        const { data: profiles } = await supabase.from('profiles').select('id, full_name, avatar_url, email').in('id', [currentUserId, otherUserId]);
        if (profiles) {
            const u1 = profiles.find(p => p.id === currentUserId);
            const u2 = profiles.find(p => p.id === otherUserId);
            if (u1) user1Data = { id: u1.id, name: u1.full_name || 'Me', image: u1.avatar_url, email: u1.email };
            if (u2) user2Data = { id: u2.id, name: u2.full_name || 'User', image: u2.avatar_url, email: u2.email };
        }
        return await createOrGetChannelWithUsers(user1Data, user2Data);
    } catch (err) {
        console.error('❌ STREAM (legacy) - Error:', err);
        throw err;
    }
  }, [client, createOrGetChannelWithUsers]);

  useEffect(() => {
    if (currentUser) {
      // Only initialize if we don't have a client or it's for a different user
      if (!client || client.userID !== currentUser.id || !isConnected) {
        initializeClient(currentUser);
      }
    } else if (!currentUser && client) {
      disconnectClient();
    }
  }, [currentUser, initializeClient, disconnectClient]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (client && client.user) {

        client.disconnectUser().catch(error => 
          console.warn('⚠️ STREAM - Cleanup error:', error)
        );
      }
    };
  }, []);

  const contextValue: StreamContextType = {
    client, isLoading, error, isConnected, initializeClient, disconnectClient,
    createOrGetChannel, createOrGetChannelWithUsers, retryConnection
  };

  return (
    <StreamContext.Provider value={contextValue}>
      {client && isConnected ? (<Chat client={client}>{children}</Chat>) : (children)}
    </StreamContext.Provider>
  );
};