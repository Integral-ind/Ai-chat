import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  CallControls,
  CallParticipantsList,
  StreamCall,
  StreamTheme,
  useStreamVideoClient,
} from '@stream-io/video-react-sdk';
import { Call } from '@stream-io/video-client';
import { Button } from '../components';
import { ArrowLeftIcon, PhoneIcon, MicrophoneIcon, MicrophoneOffIcon } from '../constants';
import { useStreamVideo } from '../components/StreamVideoProvider';

const LoadingSpinner: React.FC = () => (
    <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
);

const VoiceCallUI: React.FC<{ onLeave: () => void; participants: any[] }> = ({ onLeave, participants }) => {
    const [isMuted, setIsMuted] = useState(false);
    const [callDuration, setCallDuration] = useState(0);

    // Call duration timer
    useEffect(() => {
        const interval = setInterval(() => {
            setCallDuration(prev => prev + 1);
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const toggleMute = () => {
        setIsMuted(!isMuted);
        // The actual mute functionality is handled by Stream's CallControls
    };

    return (
        <StreamTheme className="h-full w-full">
            <div className="h-full w-full flex flex-col items-center justify-center bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 text-white relative overflow-hidden">
                {/* Animated Background */}
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-white/5 rounded-full animate-pulse" style={{ animationDelay: '0s', animationDuration: '4s' }}></div>
                    <div className="absolute bottom-1/3 right-1/4 w-48 h-48 bg-white/5 rounded-full animate-pulse" style={{ animationDelay: '2s', animationDuration: '6s' }}></div>
                    <div className="absolute top-1/2 right-1/3 w-32 h-32 bg-white/5 rounded-full animate-pulse" style={{ animationDelay: '1s', animationDuration: '5s' }}></div>
                </div>

                {/* Main Content */}
                <div className="relative z-10 flex flex-col items-center max-w-lg mx-auto px-6">
                    {/* Enhanced Voice Call Header */}
                    <div className="text-center mb-10">
                        <div className="relative mb-6">
                            {/* Pulsing rings around the phone icon */}
                            <div className="absolute inset-0 rounded-full animate-ping bg-white/20" style={{ animationDelay: '0s' }}></div>
                            <div className="absolute inset-0 rounded-full animate-ping bg-white/15" style={{ animationDelay: '0.5s' }}></div>
                            <div className="absolute inset-0 rounded-full animate-ping bg-white/10" style={{ animationDelay: '1s' }}></div>
                            
                            <div className="w-32 h-32 mx-auto bg-white/20 rounded-full flex items-center justify-center relative shadow-2xl backdrop-blur-sm border border-white/30">
                                <PhoneIcon className="w-16 h-16 text-white drop-shadow-lg" />
                            </div>
                        </div>
                        <h2 className="text-3xl font-bold mb-3 drop-shadow-lg">Voice Call</h2>
                        <div className="flex items-center justify-center space-x-2">
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                            <p className="text-white/80 font-medium">
                                {participants.length > 1 ? `${participants.length} participants` : 'Connecting...'}
                            </p>
                        </div>
                    </div>

                    {/* Enhanced Participants Display */}
                    <div className="mb-10 w-full">
                        <div className="grid grid-cols-2 gap-6 max-w-xs mx-auto">
                            {participants.slice(0, 4).map((participant, index) => (
                                <div key={index} className="text-center group">
                                    <div className="relative mb-3">
                                        {/* Speaking indicator */}
                                        {participant.audioEnabled && (
                                            <div className="absolute -inset-1 rounded-full bg-green-400/30 animate-pulse"></div>
                                        )}
                                        <div className="w-20 h-20 mx-auto bg-white/20 rounded-full flex items-center justify-center relative shadow-xl backdrop-blur-sm border border-white/20 group-hover:scale-105 transition-transform duration-200">
                                            <img 
                                                src={participant.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(participant.name || 'User')}&background=random`}
                                                alt={participant.name || 'User'}
                                                className="w-18 h-18 rounded-full object-cover"
                                            />
                                        </div>
                                    </div>
                                    <p className="text-sm font-medium text-white/90 mb-1">{participant.name || 'User'}</p>
                                    <div className="flex items-center justify-center space-x-1">
                                        {participant.audioEnabled ? (
                                            <>
                                                <div className="w-1 h-1 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                                                <div className="w-1 h-1 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                                <div className="w-1 h-1 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                                                <span className="text-xs text-green-400 font-medium ml-1">Speaking</span>
                                            </>
                                        ) : (
                                            <>
                                                <MicrophoneOffIcon className="w-3 h-3 text-red-400" />
                                                <span className="text-xs text-red-400">Muted</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Enhanced Call Duration */}
                    <div className="mb-10 p-4 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/20">
                        <div className="flex items-center space-x-3">
                            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                            <p className="text-xl font-mono font-bold text-white">
                                {formatDuration(callDuration)}
                            </p>
                        </div>
                    </div>

                    {/* Enhanced Call Controls */}
                    <div className="flex items-center space-x-8">
                        <button
                            onClick={toggleMute}
                            className={`group w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 shadow-2xl backdrop-blur-sm border-2 relative ${
                                isMuted 
                                    ? 'bg-red-500 hover:bg-red-600 border-red-400/50' 
                                    : 'bg-white/20 hover:bg-white/30 border-white/20'
                            }`}
                            title={isMuted ? 'Unmute' : 'Mute'}
                        >
                            {isMuted && <div className="absolute inset-0 rounded-full bg-red-500/30 animate-ping"></div>}
                            {isMuted ? (
                                <MicrophoneOffIcon className="w-7 h-7 text-white relative z-10 group-hover:scale-110 transition-transform duration-200" />
                            ) : (
                                <MicrophoneIcon className="w-7 h-7 text-white relative z-10 group-hover:scale-110 transition-transform duration-200" />
                            )}
                        </button>
                        
                        <button
                            onClick={onLeave}
                            className="group w-20 h-20 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 shadow-2xl backdrop-blur-sm border-2 border-red-400/50 relative"
                            title="End Call"
                        >
                            <div className="absolute inset-0 rounded-full bg-red-500/30 animate-ping"></div>
                            <PhoneIcon className="w-9 h-9 text-white transform rotate-135 relative z-10 group-hover:scale-110 transition-transform duration-200" />
                        </button>
                    </div>

                    {/* Stream CallControls (hidden but functional) */}
                    <div className="hidden">
                        <CallControls onLeave={onLeave} />
                    </div>
                </div>
            </div>
        </StreamTheme>
    );
};

export const VoiceCallPage: React.FC = () => {
    const { callId } = useParams<{ callId: string }>();
    const navigate = useNavigate();
    const client = useStreamVideoClient();
    const { createCall, isConnected, error: videoError } = useStreamVideo();

    const [call, setCall] = useState<Call | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isJoining, setIsJoining] = useState(false);
    const [participants, setParticipants] = useState<any[]>([]);
    const [lastJoinAttempt, setLastJoinAttempt] = useState<number>(0);
    const [joinRetryCount, setJoinRetryCount] = useState<number>(0);

    // Handle page refresh/reload - cleanup any existing calls
    useEffect(() => {
        const handleBeforeUnload = () => {
            if (call) {
                call.leave().catch(console.error);
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [call]);

    useEffect(() => {
        if (!isConnected || !callId) return;

        let callInstance: Call;
        
        const initializeCall = async () => {
            if (isJoining) {

                return;
            }

            // Rate limiting: prevent too frequent join attempts
            const now = Date.now();
            const timeSinceLastAttempt = now - lastJoinAttempt;
            const minInterval = Math.min(2000 * Math.pow(2, joinRetryCount), 30000); // Exponential backoff, max 30s
            
            if (timeSinceLastAttempt < minInterval) {

                setError(`Please wait ${Math.ceil((minInterval - timeSinceLastAttempt) / 1000)} seconds before trying again.`);
                return;
            }

            setLastJoinAttempt(now);
            setIsJoining(true);
            setError(null);
            
            try {
                // Remove 'voice-' prefix if present to get the original call ID
                const actualCallId = callId.startsWith('voice-') ? callId.substring(6) : callId;
                callInstance = createCall(actualCallId, 'default');
                
                if (!callInstance) {
                    setError('Could not create call instance.');
                    return;
                }

                // Enhanced duplicate prevention for team voice calls
                try {
                    const callState = callInstance.state;
                    const currentUserId = callInstance.currentUserId;
                    
                    // Check if already a member
                    const isAlreadyMember = callState?.members?.some(member => member.user.id === currentUserId);
                    
                    // Check if already in session participants
                    const isInSession = callState?.participants?.some(participant => participant.user.id === currentUserId);
                    
                    if (isAlreadyMember || isInSession) {

                        setCall(callInstance);
                        setJoinRetryCount(0); // Reset on success
                        return;
                    }
                    
                    // For team calls, also check if there are any "ghost" members
                    const totalMembers = callState?.members?.length || 0;
                    const activeParticipants = callState?.participants?.length || 0;
                    
                    if (totalMembers > activeParticipants + 5) { // More than 5 inactive members

                        // Attempt to clean up the call by leaving and rejoining
                        try {
                            await callInstance.leave();
                            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
                        } catch (cleanupError) {
                            console.warn('Could not cleanup voice call:', cleanupError);
                        }
                    }
                } catch (stateError) {
                    console.warn('Could not check call state:', stateError);
                    // Continue with join attempt
                }
                
                // Join the call with audio only (disable video for voice calls)
                await callInstance.join({ 
                    create: true,
                    data: {
                        settings_override: {
                            video: {
                                enabled: false, // Disable video for voice calls
                            },
                            audio: {
                                enabled: true,
                            }
                        }
                    }
                });

                setCall(callInstance);
                setJoinRetryCount(0); // Reset retry count on success
                
                // Listen for participant changes
                callInstance.on('call.session_participant_joined', (event) => {

                    updateParticipants(callInstance);
                });
                
                callInstance.on('call.session_participant_left', (event) => {

                    updateParticipants(callInstance);
                });

                // Initial participants update
                updateParticipants(callInstance);
                
            } catch (err: any) {
                console.error('Failed to join voice call:', err);
                setJoinRetryCount(prev => prev + 1); // Increment retry count on failure
                
                if (err.message?.includes('Too many requests')) {
                    setError('Too many requests. Please wait a moment and try again.');
                } else {
                    setError('Failed to join the voice call. Please try again.');
                }
            } finally {
                setIsJoining(false);
            }
        };

        const updateParticipants = (callInstance: Call) => {
            try {
                const members = callInstance.state.members || [];
                const participantList = members.map(member => ({
                    id: member.user.id,
                    name: member.user.name || member.user.id,
                    image: member.user.image,
                    audioEnabled: !member.isMuted
                }));
                setParticipants(participantList);
            } catch (error) {
                console.warn('Could not update participants:', error);
            }
        };

        initializeCall();

        return () => {
            if (callInstance) {

                // Properly leave and cleanup
                callInstance.leave().then(() => {

                }).catch(err => console.error("Error leaving voice call on cleanup:", err));
            }
            setCall(null);
        };
    }, [isConnected, callId, createCall]);

    const handleLeave = async () => {
        if (call) {
            try {

                await call.leave();

            } catch (error) {
                console.error('❌ Error leaving voice call:', error);
            }
        }
        setCall(null);
        navigate(-1); // Go back to the previous page
    };

    if (!isConnected) {
        return (
            <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-900 to-purple-900 text-white">
                <h2 className="text-xl font-semibold mb-4">Voice Client Not Ready</h2>
                <p>Connecting to voice services. Please wait...</p>
                {videoError && <p className="text-red-400 mt-2">{videoError}</p>}
                <LoadingSpinner />
            </div>
        );
    }

    if (error || videoError) {
         return (
            <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-900 to-purple-900 text-red-400">
                <h2 className="text-xl font-semibold mb-4">Voice Call Error</h2>
                <p>{error || videoError}</p>
                <Button onClick={() => navigate(-1)} variant="outline" className="mt-4">Go Back</Button>
            </div>
        );
    }
    
    return (
        <div className="h-screen w-screen bg-gradient-to-br from-blue-900 to-purple-900 text-white flex flex-col">
            <header className="p-4 border-b border-white/20">
                <Button onClick={handleLeave} variant="ghost" leftIcon={<ArrowLeftIcon />} className="text-white hover:bg-white/20">
                    Leave Call
                </Button>
            </header>
             {call ? (
                <StreamCall call={call}>
                    <VoiceCallUI onLeave={handleLeave} participants={participants} />
                </StreamCall>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center">
                    <p className="mb-4">Setting up your voice call...</p>
                    <LoadingSpinner />
                </div>
            )}
        </div>
    );
};