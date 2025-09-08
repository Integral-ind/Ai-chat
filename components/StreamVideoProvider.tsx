import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { StreamVideoClient, User as StreamVideoUser } from '@stream-io/video-client';
import { StreamVideo } from '@stream-io/video-react-sdk';
import { User as FrontendUser } from '../types';
import { supabase } from '../supabaseClient';

// Stream Video configuration
const STREAM_API_KEY = process.env.REACT_APP_STREAM_API_KEY || ''; // Secure API key from environment

interface StreamVideoContextType {
  client: StreamVideoClient | null;
  isLoading: boolean;
  error: string | null;
  isConnected: boolean;
  initializeClient: (user: FrontendUser) => Promise<StreamVideoClient | null>;
  disconnectClient: () => Promise<void>;
  createCall: (callId: string, type?: string) => any;
  retryConnection: () => void;
}

const StreamVideoContext = createContext<StreamVideoContextType | undefined>(undefined);

export const useStreamVideo = () => {
  const context = useContext(StreamVideoContext);
  if (!context) {
    throw new Error('useStreamVideo must be used within a StreamVideoProvider');
  }
  return context;
};

interface StreamVideoProviderProps {
  children: React.ReactNode;
  currentUser: FrontendUser | null;
}

export const StreamVideoProvider: React.FC<StreamVideoProviderProps> = ({ children, currentUser }) => {
  const [client, setClient] = useState<StreamVideoClient | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastInitAttempt, setLastInitAttempt] = useState<number>(0);
  const [retryCount, setRetryCount] = useState<number>(0);

  const initializeClient = useCallback(async (user: FrontendUser): Promise<StreamVideoClient | null> => {
    console.log('🎥 STREAM VIDEO INIT - Starting initialization for user:', user.id);

    if (!user || !user.id) {
      console.error('❌ STREAM VIDEO INIT - No user or user ID provided');
      return null;
    }
    
    // Check if we already have a working client for this user
    if (client && client.user?.id === user.id && isConnected) {
      console.log('✅ STREAM VIDEO INIT - Using existing client for user:', user.id);
      setRetryCount(0);
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
      if (client && client.user?.id && client.user.id !== user.id) {

        await client.disconnectUser();
        setClient(null);
        setIsConnected(false);
      }
    } catch (disconnectError) {
      console.warn('⚠️ STREAM VIDEO INIT - Error disconnecting previous user:', disconnectError);
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session for Stream video token');

      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('stream-token', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (tokenError) throw tokenError;
      const token = tokenData.token;

      const streamUser: StreamVideoUser = {
        id: user.id,
        name: user.full_name || user.email || 'Anonymous User',
        image: user.avatar_url,
      };

      // Create new client directly to avoid getOrCreateInstance issues
      console.log('🔄 STREAM VIDEO INIT - Creating new client for user:', user.id);
      const newClient = new StreamVideoClient({
        apiKey: STREAM_API_KEY,
        user: streamUser,
        token: token,
      });

      setClient(newClient);
      setIsConnected(true);
      setRetryCount(0); // Reset retry count on success
      return newClient;
    } catch (err: any) {
      console.error('❌ STREAM VIDEO INIT - Connection failed:', err);
      setRetryCount(prev => prev + 1); // Increment retry count on failure
      setError(err.message || 'Failed to initialize Stream Video');
      
      // Don't set client to null if it was already working
      if (!client || client.user?.id !== user.id) {
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
        console.warn('⚠️ STREAM VIDEO - Error during disconnection:', error);
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

  const createCall = useCallback((callId: string, type: string = 'default') => {
    if (!client || !isConnected) {
      console.error('Stream Video client not connected');
      return null;
    }
    return client.call(type, callId);
  }, [client, isConnected]);

  useEffect(() => {
    if (currentUser) {
      // Only initialize if we don't have a client or it's for a different user
      if (!client || client.user?.id !== currentUser.id || !isConnected) {
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
          console.warn('⚠️ STREAM VIDEO - Cleanup error:', error)
        );
      }
    };
  }, []);

  const contextValue: StreamVideoContextType = {
    client,
    isLoading,
    error,
    isConnected,
    initializeClient,
    disconnectClient,
    createCall,
    retryConnection
  };

  return (
    <StreamVideoContext.Provider value={contextValue}>
      {client && isConnected ? (
        <StreamVideo client={client}>
          {children}
        </StreamVideo>
      ) : (
        children
      )}
    </StreamVideoContext.Provider>
  );
};