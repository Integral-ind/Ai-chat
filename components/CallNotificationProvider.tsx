import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStreamChat } from './StreamProvider';
import { User as FrontendUser } from '../types';
import { IncomingCallScreen } from './IncomingCallScreen';
import { VideoCameraIcon, PhoneIcon, XMarkIcon } from '../constants';
import { notificationService } from '../notificationService';

interface IncomingCall {
  callId: string;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  callType: 'video' | 'voice';
  timestamp: number;
}

interface CallNotificationContextType {
  incomingCall: IncomingCall | null;
  acceptCall: () => void;
  rejectCall: () => void;
}

const CallNotificationContext = createContext<CallNotificationContextType | undefined>(undefined);

export const useCallNotifications = () => {
  const context = useContext(CallNotificationContext);
  if (!context) {
    throw new Error('useCallNotifications must be used within a CallNotificationProvider');
  }
  return context;
};

interface CallNotificationProviderProps {
  children: React.ReactNode;
  currentUser: FrontendUser | null;
}

// This component is now replaced by IncomingCallScreen

export const CallNotificationProvider: React.FC<CallNotificationProviderProps> = ({ 
  children, 
  currentUser 
}) => {
  const navigate = useNavigate();
  const { client } = useStreamChat();
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);

  // Listen for incoming call messages
  useEffect(() => {
    if (!client || !currentUser) return;

    const handleNewMessage = (event: any) => {
      const message = event.message;
      
      // Check if it's a video or voice call invitation
      if ((message.custom_type === 'video_call_invitation' || message.custom_type === 'voice_call_invitation') && 
          message.caller_id !== currentUser.id) {

        const callType = message.call_type || (message.custom_type === 'voice_call_invitation' ? 'voice' : 'video');
        const callerName = message.caller_name || 'Someone';
        
        setIncomingCall({
          callId: message.call_id,
          callerId: message.caller_id,
          callerName: callerName,
          callerAvatar: message.caller_avatar,
          callType: callType,
          timestamp: Date.now()
        });

        // Create notification for incoming call
        notificationService.createCallNotification(
          currentUser.id,
          'call_incoming',
          callerName,
          message.call_id,
          callType
        ).catch(error => console.error('Failed to create call notification:', error));

        // Note: Ring sound is now handled by IncomingCallScreen component
      }
    };

    client.on('message.new', handleNewMessage);

    return () => {
      client.off('message.new', handleNewMessage);
    };
  }, [client, currentUser]);

  const acceptCall = useCallback(() => {
    if (incomingCall && currentUser) {

      // Create notification for answered call
      notificationService.createCallNotification(
        incomingCall.callerId,
        'call_answered',
        currentUser.name || 'Someone',
        incomingCall.callId,
        incomingCall.callType
      ).catch(error => console.error('Failed to create call answered notification:', error));
      
      if (incomingCall.callType === 'voice') {
        navigate(`/app/voice/${incomingCall.callId}`);
      } else {
        navigate(`/app/call/${incomingCall.callId}`);
      }
      
      setIncomingCall(null);
    }
  }, [incomingCall, navigate, currentUser]);

  const rejectCall = useCallback(() => {
    if (incomingCall && currentUser) {

      // Create missed call notification for the caller
      notificationService.createCallNotification(
        incomingCall.callerId,
        'call_missed',
        currentUser.name || 'Someone',
        incomingCall.callId,
        incomingCall.callType
      ).catch(error => console.error('Failed to create missed call notification:', error));
      
      setIncomingCall(null);
    }
  }, [incomingCall, currentUser]);

  const contextValue: CallNotificationContextType = {
    incomingCall,
    acceptCall,
    rejectCall
  };

  return (
    <CallNotificationContext.Provider value={contextValue}>
      {children}
      {incomingCall && (
        <IncomingCallScreen 
          callerName={incomingCall.callerName}
          callerAvatar={incomingCall.callerAvatar}
          callType={incomingCall.callType}
          callId={incomingCall.callId}
          onAccept={acceptCall}
          onDecline={rejectCall}
          autoDeclineAfter={30}
        />
      )}
    </CallNotificationContext.Provider>
  );
};