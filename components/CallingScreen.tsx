import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PhoneIcon, VideoCameraIcon } from '../constants';
import { Button } from '../components';
import { notificationService } from '../notificationService';

interface CallingScreenProps {
  callerName: string;
  callerAvatar?: string;
  callType: 'voice' | 'video';
  callId: string;
  onEndCall: () => void;
  onCallConnected?: () => void;
  recipientId: string;
  currentUserId?: string;
}

export const CallingScreen: React.FC<CallingScreenProps> = ({
  callerName,
  callerAvatar,
  callType,
  callId,
  onEndCall,
  onCallConnected,
  recipientId,
  currentUserId
}) => {
  const [callDuration, setCallDuration] = useState(0);
  const [callStatus, setCallStatus] = useState<'calling' | 'ringing' | 'connected' | 'ended'>('calling');
  const navigate = useNavigate();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Auto-timeout after 30 seconds
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (callStatus === 'calling' || callStatus === 'ringing') {
        setCallStatus('ended');
        onEndCall();
      }
    }, 30000);

    return () => clearTimeout(timeout);
  }, [callStatus, onEndCall]);

  // Call duration timer when connected
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (callStatus === 'connected') {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [callStatus]);

  // Handle ringing sound and call states progression
  useEffect(() => {
    const progressCall = async () => {
      // Start with calling
      setCallStatus('calling');
      
      // After 2 seconds, show ringing and start playing ring sound
      setTimeout(() => {
        if (callStatus !== 'ended') {
          setCallStatus('ringing');
          
          // Create ringing sound using Web Audio API for better control
          try {
            const audioContext = new AudioContext();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4 note
            oscillator.type = 'sine';
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            
            // Create a pulsing ring tone
            let isRinging = true;
            const pulseRing = () => {
              if (!isRinging) return;
              
              gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
              gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
              
              setTimeout(() => {
                if (isRinging) {
                  gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
                  setTimeout(pulseRing, 1000);
                }
              }, 1000);
            };
            
            oscillator.start();
            pulseRing();
            
            // Store cleanup function
            audioRef.current = {
              pause: () => {
                isRinging = false;
                try {
                  oscillator.stop();
                  audioContext.close();
                } catch (e) {
                  console.warn('Error stopping audio context:', e);
                }
              }
            } as HTMLAudioElement;
            
          } catch (e) {
            console.warn('Could not create calling sound:', e);
            // Fallback to simple beep sound
            const audio = new Audio('data:audio/wav;base64,UklGRlYEAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDOiUaELvx8fHx8fHx8fGjM9v2o/fQ9nH2tLv3x/fx8fHx8fG78fHx8fHx8fGj9/Hx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx');
            audio.loop = true;
            audio.volume = 0.2;
            audio.play().catch(e => console.warn('Could not play fallback sound:', e));
            audioRef.current = audio;
          }
        }
      }, 2000);

      // Check for call acceptance (this would normally come from Stream events)
      // For now, we'll simulate this - in real implementation, this would be handled
      // by Stream Video events when the other person joins the call
    };

    progressCall();
  }, []);

  // Enhanced audio cleanup
  useEffect(() => {
    return () => {
      // Cleanup audio on unmount or status change
      if (audioRef.current) {

        try {
          if (audioRef.current.pause && typeof audioRef.current.pause === 'function') {
            // HTML Audio Element cleanup
            audioRef.current.pause();
            if (audioRef.current.currentTime !== undefined) {
              audioRef.current.currentTime = 0;
            }
            if (audioRef.current.src !== undefined) {
              audioRef.current.src = '';
            }
            if (audioRef.current.load && typeof audioRef.current.load === 'function') {
              audioRef.current.load();
            }
          } else if (audioRef.current.stop) {
            // Web Audio API cleanup  
            audioRef.current.stop();
          }
        } catch (e) {
          console.warn('Error cleaning up audio:', e);
        }
        audioRef.current = null;
      }
    };
  }, [callStatus]);

  // Additional cleanup on component unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {

        try {
          if (audioRef.current.pause && typeof audioRef.current.pause === 'function') {
            // HTML Audio Element cleanup
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current.src = '';
            audioRef.current.load();
          } else if (audioRef.current.stop) {
            // Web Audio API cleanup
            audioRef.current.stop();
          }
        } catch (e) {
          console.warn('Error in final audio cleanup:', e);
        }
        audioRef.current = null;
      }
    };
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEndCall = () => {
    // Stop audio immediately with enhanced cleanup
    if (audioRef.current) {

      try {
        if (audioRef.current.pause && typeof audioRef.current.pause === 'function') {
          // HTML Audio Element cleanup
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          audioRef.current.src = '';
          audioRef.current.load();
        } else if (audioRef.current.stop) {
          // Web Audio API cleanup
          audioRef.current.stop();
        }
      } catch (e) {
        console.warn('Error stopping audio on end call:', e);
      }
      audioRef.current = null;
    }
    
    // Create call ended notification if we have user info
    if (currentUserId && recipientId && callStatus === 'connected') {
      notificationService.createCallNotification(
        recipientId,
        'call_ended',
        callerName,
        callId,
        callType
      ).catch(error => console.error('Failed to create call ended notification:', error));
    }
    
    setCallStatus('ended');
    onEndCall();
  };

  const getStatusText = () => {
    switch (callStatus) {
      case 'calling':
        return 'Calling...';
      case 'ringing':
        return 'Ringing...';
      case 'connected':
        return formatDuration(callDuration);
      case 'ended':
        return 'Call ended';
      default:
        return 'Connecting...';
    }
  };

  const getBackgroundClass = () => {
    if (callType === 'voice') {
      return 'bg-gradient-to-br from-blue-900 to-purple-900';
    }
    return 'bg-gradient-to-br from-green-900 to-blue-900';
  };

  return (
    <div className={`h-screen w-screen flex flex-col items-center justify-center text-white relative overflow-hidden ${getBackgroundClass()}`}>
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-white/5 rounded-full animate-pulse" style={{ animationDelay: '0s', animationDuration: '4s' }}></div>
        <div className="absolute bottom-1/3 right-1/4 w-48 h-48 bg-white/5 rounded-full animate-pulse" style={{ animationDelay: '2s', animationDuration: '6s' }}></div>
        <div className="absolute top-1/2 right-1/3 w-32 h-32 bg-white/5 rounded-full animate-pulse" style={{ animationDelay: '1s', animationDuration: '5s' }}></div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Recipient Avatar with Enhanced Animation */}
        <div className="text-center mb-8">
          <div className="relative mb-6">
            {/* Multiple pulse rings for more dynamic effect */}
            {(callStatus === 'calling' || callStatus === 'ringing') && (
              <>
                <div className="absolute inset-0 rounded-full animate-ping bg-white/20" style={{ animationDelay: '0s' }}></div>
                <div className="absolute inset-0 rounded-full animate-ping bg-white/15" style={{ animationDelay: '0.5s' }}></div>
                <div className="absolute inset-0 rounded-full animate-ping bg-white/10" style={{ animationDelay: '1s' }}></div>
              </>
            )}
            
            {/* Main Avatar with Glow Effect */}
            <div className="w-40 h-40 mx-auto rounded-full overflow-hidden bg-white/20 flex items-center justify-center relative shadow-2xl">
              {/* Glow effect */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-white/30 to-white/10 animate-pulse"></div>
              
              {callerAvatar ? (
                <img 
                  src={callerAvatar} 
                  alt={callerName}
                  className="w-full h-full object-cover relative z-10"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-white/40 to-white/20 rounded-full flex items-center justify-center relative z-10">
                  <span className="text-5xl font-bold text-white drop-shadow-lg">
                    {callerName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Enhanced Typography with Animation */}
          <div className="space-y-2">
            <h2 className="text-4xl font-bold mb-3 drop-shadow-lg animate-fade-in">{callerName}</h2>
            <div className="flex items-center justify-center space-x-2 mb-2">
              {callType === 'voice' ? (
                <PhoneIcon className="w-5 h-5 text-white/80" />
              ) : (
                <VideoCameraIcon className="w-5 h-5 text-white/80" />
              )}
              <p className="text-xl text-white/80 font-medium">
                {callType === 'voice' ? 'Voice call' : 'Video call'}
              </p>
            </div>
            <div className="flex items-center justify-center space-x-2">
              {(callStatus === 'calling' || callStatus === 'ringing') && (
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              )}
              <p className="text-lg text-white/70 font-medium">
                {getStatusText()}
              </p>
            </div>
          </div>
        </div>

        {/* Enhanced Call Controls */}
        <div className="flex items-center justify-center space-x-6 mb-8">
          {callStatus === 'connected' && (
            <>
              {/* Mute Button with Modern Design */}
              <button className="group w-16 h-16 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 backdrop-blur-sm border border-white/20">
                <svg className="w-7 h-7 text-white group-hover:scale-110 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                </svg>
              </button>

              {callType === 'video' && (
                /* Camera Toggle Button with Modern Design */
                <button className="group w-16 h-16 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 backdrop-blur-sm border border-white/20">
                  <VideoCameraIcon className="w-7 h-7 text-white group-hover:scale-110 transition-transform duration-200" />
                </button>
              )}
            </>
          )}

          {/* Enhanced End Call Button */}
          <button
            onClick={handleEndCall}
            className="group w-20 h-20 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 shadow-2xl backdrop-blur-sm border-2 border-red-400/50 relative"
          >
            {/* Pulsing glow effect for end call button */}
            <div className="absolute inset-0 rounded-full bg-red-500/30 animate-ping"></div>
            <PhoneIcon className="w-9 h-9 text-white transform rotate-135 relative z-10 group-hover:scale-110 transition-transform duration-200" />
          </button>
        </div>

        {/* Enhanced Status Indicators with Icons */}
        <div className="text-center max-w-md mx-auto">
          {callStatus === 'calling' && (
            <div className="flex items-center justify-center space-x-3 p-4 bg-white/10 rounded-full backdrop-blur-sm">
              <div className="w-4 h-4 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
              <div className="w-4 h-4 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-4 h-4 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              <p className="text-white/80 text-sm font-medium ml-2">
                Connecting to {callerName}...
              </p>
            </div>
          )}
          
          {callStatus === 'ringing' && (
            <div className="flex items-center justify-center space-x-3 p-4 bg-white/10 rounded-full backdrop-blur-sm animate-pulse">
              <div className="w-3 h-3 bg-green-400 rounded-full animate-ping"></div>
              <p className="text-white/80 text-sm font-medium">
                Waiting for {callerName} to answer...
              </p>
            </div>
          )}
          
          {callStatus === 'ended' && (
            <div className="flex items-center justify-center space-x-3 p-4 bg-white/10 rounded-full backdrop-blur-sm">
              <div className="w-3 h-3 bg-red-400 rounded-full"></div>
              <p className="text-white/80 text-sm font-medium">
                Call ended
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Custom CSS for fade-in animation */}
      <style>{`
        @keyframes fade-in {
          0% {
            opacity: 0;
            transform: translateY(10px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.8s ease-out forwards;
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};