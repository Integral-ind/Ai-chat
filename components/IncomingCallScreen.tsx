import React, { useState, useEffect, useRef } from 'react';
import { PhoneIcon, VideoCameraIcon, XMarkIcon } from '../constants';

interface IncomingCallScreenProps {
  callerName: string;
  callerAvatar?: string;
  callType: 'voice' | 'video';
  callId: string;
  onAccept: () => void;
  onDecline: () => void;
  autoDeclineAfter?: number; // seconds, default 30
}

export const IncomingCallScreen: React.FC<IncomingCallScreenProps> = ({
  callerName,
  callerAvatar,
  callType,
  callId,
  onAccept,
  onDecline,
  autoDeclineAfter = 30
}) => {
  const [timeLeft, setTimeLeft] = useState(autoDeclineAfter);
  const [isRinging, setIsRinging] = useState(true);
  const audioRef = useRef<any>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Enhanced global audio cleanup function
  const stopAllAudio = () => {

    // Stop our audio with enhanced cleanup
    if (audioRef.current) {
      try {
        if (audioRef.current.oscillator) {
          // Web Audio API cleanup
          audioRef.current.oscillator.stop();
          if (audioRef.current.gainNode) {
            audioRef.current.gainNode.disconnect();
          }
          if (audioRef.current.audioContext) {
            audioRef.current.audioContext.close();
          }
          // Clear audio-specific interval
          if (audioRef.current.ringInterval) {
            clearInterval(audioRef.current.ringInterval);
          }
        } else if (audioRef.current.pause) {
          // HTML Audio cleanup
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          audioRef.current.src = '';
          audioRef.current.load();
        }
        audioRef.current = null;
      } catch (error) {
        console.warn('Error force stopping audio:', error);
        audioRef.current = null;
      }
    }
    
    // Clear interval with enhanced cleanup
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    // Stop all audio elements on the page
    document.querySelectorAll('audio').forEach(audio => {
      try {
        audio.pause();
        audio.currentTime = 0;
        audio.src = '';
        audio.load();
      } catch (e) {
        console.warn('Error stopping page audio:', e);
      }
    });
    
    // Clear global references
    (window as any).currentRingAudio = null;
    
    // Additional WebAudio context cleanup
    try {
      if ((window as any).audioContext) {
        (window as any).audioContext.close();
        (window as any).audioContext = null;
      }
    } catch (e) {
      console.warn('Error cleaning up global audio context:', e);
    }
  };

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          stopAllAudio();
          onDecline(); // Auto-decline when timer reaches 0
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onDecline]);

  // Better ringing sound effect 
  useEffect(() => {
    if (isRinging) {
      const playRing = () => {
        try {
          // Simple, pleasant ring sound using Web Audio API
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime); // E5 note
          oscillator.type = 'sine';
          
          // Create ring pattern: 2 short beeps, pause, repeat
          let beepCount = 0;
          const playBeep = () => {
            gainNode.gain.setValueAtTime(0.05, audioContext.currentTime);
            setTimeout(() => {
              gainNode.gain.setValueAtTime(0, audioContext.currentTime);
            }, 200); // 200ms beep
          };
          
          const ringPattern = () => {
            playBeep();
            setTimeout(() => {
              playBeep();
            }, 300);
          };
          
          oscillator.start();
          gainNode.gain.setValueAtTime(0, audioContext.currentTime);
          
          // Start ringing pattern
          ringPattern();
          const ringInterval = setInterval(ringPattern, 2000); // Every 2 seconds
          intervalRef.current = ringInterval;
          
          // Store references for cleanup with enhanced structure
          const audioData = { 
            oscillator, 
            gainNode, 
            audioContext,
            ringInterval 
          };
          audioRef.current = audioData;
          (window as any).currentRingAudio = audioData;
          
        } catch (e) {
          console.warn('Could not create ring sound, using fallback:', e);
          // Fallback to simple beep
          try {
            const audio = new Audio();
            // Create a simple tone
            const context = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = context.createOscillator();
            const dest = context.createMediaStreamDestination();
            oscillator.connect(dest);
            oscillator.frequency.value = 800;
            oscillator.start();
            audio.srcObject = dest.stream;
            audio.loop = true;
            audio.volume = 0.1;
            audio.play().catch(e => console.warn('Could not play fallback sound:', e));
            audioRef.current = audio;
            (window as any).currentRingAudio = audio;
          } catch (fallbackError) {
            console.warn('Fallback audio also failed:', fallbackError);
          }
        }
      };

      playRing();
    }

    return () => {
      stopAllAudio();
    };
  }, [isRinging]);

  const handleAccept = () => {

    setIsRinging(false);
    stopAllAudio();
    onAccept();
  };

  const handleDecline = () => {

    setIsRinging(false);
    stopAllAudio();
    onDecline();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAllAudio();
    };
  }, []);

  const getBackgroundClass = () => {
    if (callType === 'voice') {
      return 'bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900';
    }
    return 'bg-gradient-to-br from-green-900 via-blue-900 to-purple-900';
  };

  return (
    <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center text-white relative overflow-hidden ${getBackgroundClass()}`}>
      {/* Enhanced Animated background pulses */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-white/8 rounded-full animate-pulse" style={{ animationDelay: '0s', animationDuration: '4s' }}></div>
        <div className="absolute bottom-1/4 right-1/4 w-56 h-56 bg-white/6 rounded-full animate-pulse" style={{ animationDelay: '2s', animationDuration: '6s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/4 rounded-full animate-pulse" style={{ animationDelay: '1s', animationDuration: '8s' }}></div>
        <div className="absolute top-1/3 right-1/3 w-40 h-40 bg-white/6 rounded-full animate-pulse" style={{ animationDelay: '3s', animationDuration: '5s' }}></div>
      </div>

      {/* Content */}
      <div className="relative z-10 text-center max-w-sm mx-auto px-6">
        {/* Enhanced Incoming call label with icon */}
        <div className="mb-6 p-4 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/20">
          <div className="flex items-center justify-center space-x-3 mb-2">
            {callType === 'voice' ? (
              <PhoneIcon className="w-6 h-6 text-white animate-bounce" />
            ) : (
              <VideoCameraIcon className="w-6 h-6 text-white animate-bounce" />
            )}
            <div className="w-2 h-2 bg-green-400 rounded-full animate-ping"></div>
            <div className="w-2 h-2 bg-green-400 rounded-full animate-ping" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-2 h-2 bg-green-400 rounded-full animate-ping" style={{ animationDelay: '0.4s' }}></div>
          </div>
          <p className="text-lg text-white/90 font-semibold">
            Incoming {callType === 'voice' ? 'voice' : 'video'} call
          </p>
        </div>

        {/* Enhanced Caller avatar with multiple effects */}
        <div className="relative mb-8">
          <div className="relative">
            {/* Multiple enhanced pulse rings with different sizes and opacities */}
            <div className="absolute -inset-4 rounded-full animate-ping bg-white/25" style={{ animationDelay: '0s' }}></div>
            <div className="absolute -inset-8 rounded-full animate-ping bg-white/15" style={{ animationDelay: '0.3s' }}></div>
            <div className="absolute -inset-12 rounded-full animate-ping bg-white/10" style={{ animationDelay: '0.6s' }}></div>
            <div className="absolute -inset-16 rounded-full animate-ping bg-white/5" style={{ animationDelay: '0.9s' }}></div>
            
            {/* Main Avatar with enhanced styling */}
            <div className="w-44 h-44 mx-auto rounded-full overflow-hidden bg-white/20 flex items-center justify-center relative shadow-2xl border-4 border-white/30">
              {/* Enhanced glow effect */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/40 via-white/20 to-white/10 animate-pulse"></div>
              
              {callerAvatar ? (
                <img 
                  src={callerAvatar} 
                  alt={callerName}
                  className="w-full h-full object-cover relative z-10"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-white/50 to-white/30 rounded-full flex items-center justify-center relative z-10">
                  <span className="text-6xl font-bold text-white drop-shadow-2xl">
                    {callerName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Enhanced Typography */}
        <div className="mb-8 space-y-3">
          <h2 className="text-4xl font-bold mb-3 drop-shadow-lg animate-fade-in-up">{callerName}</h2>
          
          <div className="flex items-center justify-center space-x-2 mb-2">
            {callType === 'voice' ? (
              <PhoneIcon className="w-5 h-5 text-white/80" />
            ) : (
              <VideoCameraIcon className="w-5 h-5 text-white/80" />
            )}
            <p className="text-xl text-white/90 font-medium">
              {callType === 'voice' ? 'Voice call' : 'Video call'}
            </p>
          </div>
          
          <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm border border-white/20">
            <div className="flex items-center justify-center space-x-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <p className="text-lg text-white/80 font-medium">
                Ringing... ({timeLeft}s)
              </p>
            </div>
          </div>
        </div>

        {/* Enhanced Call controls with better spacing and animations */}
        <div className="flex items-center justify-center space-x-20 mb-6">
          {/* Enhanced Decline button */}
          <button
            onClick={handleDecline}
            className="group relative w-20 h-20 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-110 shadow-2xl backdrop-blur-sm border-2 border-red-400/50"
          >
            {/* Subtle pulsing effect */}
            <div className="absolute inset-0 rounded-full bg-red-500/20 animate-ping"></div>
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-red-400/50 to-red-600/50"></div>
            <XMarkIcon className="w-10 h-10 text-white relative z-10 group-hover:scale-110 transition-transform duration-200" />
          </button>

          {/* Enhanced Accept button with more prominent animation */}
          <button
            onClick={handleAccept}
            className="group relative w-24 h-24 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-110 shadow-2xl backdrop-blur-sm border-2 border-green-400/50"
          >
            {/* Enhanced pulsing effect for accept button */}
            <div className="absolute inset-0 rounded-full bg-green-500/30 animate-ping"></div>
            <div className="absolute inset-0 rounded-full bg-green-500/20 animate-ping" style={{ animationDelay: '0.5s' }}></div>
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-green-400/50 to-green-600/50"></div>
            {callType === 'voice' ? (
              <PhoneIcon className="w-11 h-11 text-white relative z-10 group-hover:scale-110 transition-transform duration-200" />
            ) : (
              <VideoCameraIcon className="w-11 h-11 text-white relative z-10 group-hover:scale-110 transition-transform duration-200" />
            )}
          </button>
        </div>

        {/* Enhanced Action labels with better styling */}
        <div className="flex items-center justify-center space-x-20 mb-6">
          <div className="text-center">
            <p className="text-white/70 text-sm font-medium">Decline</p>
          </div>
          <div className="text-center">
            <p className="text-white/70 text-sm font-medium">Accept</p>
          </div>
        </div>

        {/* Enhanced info section */}
        <div className="p-4 bg-white/5 rounded-xl backdrop-blur-sm border border-white/10">
          <div className="flex items-center justify-center space-x-2">
            <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
            <p className="text-white/60 text-sm font-medium">
              Auto-decline in {timeLeft}s
            </p>
          </div>
        </div>
      </div>

      {/* Enhanced CSS animations */}
      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-2px); }
          75% { transform: translateX(2px); }
        }
        
        @keyframes fade-in-up {
          0% {
            opacity: 0;
            transform: translateY(20px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes glow-pulse {
          0%, 100% {
            box-shadow: 0 0 20px rgba(34, 197, 94, 0.3);
          }
          50% {
            box-shadow: 0 0 40px rgba(34, 197, 94, 0.6);
          }
        }
        
        .shake {
          animation: shake 0.5s ease-in-out infinite;
        }

        .animate-fade-in-up {
          animation: fade-in-up 0.8s ease-out forwards;
        }

        .animate-glow-pulse {
          animation: glow-pulse 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};