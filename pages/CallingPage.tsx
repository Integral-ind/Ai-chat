import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { CallingScreen } from '../components/CallingScreen';
import { useStreamVideo } from '../components/StreamVideoProvider';

export const CallingPage: React.FC = () => {
  const { callId } = useParams<{ callId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { createCall, isConnected } = useStreamVideo();
  
  const callType = (searchParams.get('type') as 'voice' | 'video') || 'video';
  const recipientId = searchParams.get('recipient') || '';
  const recipientName = decodeURIComponent(searchParams.get('name') || 'User');
  const recipientAvatar = searchParams.get('avatar') || undefined;

  const [callState, setCallState] = useState<'calling' | 'ringing' | 'connected' | 'ended'>('calling');

  useEffect(() => {
    // Simplified initialization - don't require Stream Video connection
    const initializeCall = async () => {
      try {
        // Start with calling state
        setCallState('calling');
        
        // Transition to ringing after 2 seconds
        setTimeout(() => {
          setCallState('ringing');
        }, 2000);

        // For demo purposes, simulate call connection after some time
        // In a real app, this would be triggered by Stream Video events
        setTimeout(() => {
          // Uncomment below to simulate auto-connection for testing
          // setCallState('connected');
          // setTimeout(() => {
          //   if (callType === 'voice') {
          //     navigate(`/app/voice/${callId}`, { replace: true });
          //   } else {
          //     navigate(`/app/call/${callId}`, { replace: true });
          //   }
          // }, 1000);
        }, 10000); // Auto-connect after 10 seconds for demo
        
      } catch (error) {
        console.error('Failed to initialize calling state:', error);
        setCallState('ended');
      }
    };

    if (callId) {
      initializeCall();
    }
  }, [callId, navigate, callType]);

  const handleEndCall = () => {
    setCallState('ended');
    navigate(-1); // Go back to where they came from
  };

  const handleCallConnected = () => {
    setCallState('connected');
    // Navigate to the actual call page
    setTimeout(() => {
      if (callType === 'voice') {
        navigate(`/app/voice/${callId}`, { replace: true });
      } else {
        navigate(`/app/call/${callId}`, { replace: true });
      }
    }, 1000);
  };

  if (!callId || !recipientId) {
    navigate(-1);
    return null;
  }

  return (
    <CallingScreen
      callerName={recipientName}
      callerAvatar={recipientAvatar}
      callType={callType}
      callId={callId}
      recipientId={recipientId}
      onEndCall={handleEndCall}
      onCallConnected={handleCallConnected}
    />
  );
};