import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  CallControls,
  CallParticipantsList,
  SpeakerLayout,
  StreamCall,
  StreamTheme,
  useStreamVideoClient,
} from '@stream-io/video-react-sdk';
import { Call } from '@stream-io/video-client';
import { Button } from '../components';
import { ArrowLeftIcon } from '../constants';
import { useStreamVideo } from '../components/StreamVideoProvider';
import { CallPreview } from '../components/CallPreview';

const LoadingSpinner: React.FC = () => (
    <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
);

const VideoCallUI: React.FC<{ onLeave: () => void }> = ({ onLeave }) => {
    const [showControls, setShowControls] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Auto-hide controls after 5 seconds of no interaction
    useEffect(() => {
        let timeout: NodeJS.Timeout;
        
        const resetTimeout = () => {
            if (timeout) clearTimeout(timeout);
            setShowControls(true);
            timeout = setTimeout(() => setShowControls(false), 5000);
        };

        resetTimeout();
        
        const handleMouseMove = () => resetTimeout();
        const handleKeyPress = () => resetTimeout();
        
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('keypress', handleKeyPress);
        
        return () => {
            if (timeout) clearTimeout(timeout);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('keypress', handleKeyPress);
        };
    }, []);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    return (
        <StreamTheme className="h-full w-full relative bg-gray-900">
            <div className="h-full w-full flex flex-col relative">
                {/* Enhanced Video Layout */}
                <div className="flex-1 min-h-0 relative">
                    <SpeakerLayout participantsBarPosition='bottom' />
                    
                    {/* Floating UI Controls Overlay */}
                    <div className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ${
                        showControls ? 'opacity-100' : 'opacity-0'
                    }`}>
                        {/* Top Bar */}
                        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/50 to-transparent p-4 pointer-events-auto">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                                    <span className="text-white font-medium">Live</span>
                                </div>
                                
                                <div className="flex items-center space-x-2">
                                    <button
                                        onClick={toggleFullscreen}
                                        className="p-2 bg-black/30 hover:bg-black/50 rounded-lg transition-colors duration-200"
                                        title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                                    >
                                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            {isFullscreen ? (
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M15 9h4.5M15 9V4.5M15 9l5.25-5.25M9 15H4.5M9 15v4.5M9 15l-5.25 5.25M15 15h4.5M15 15v4.5M15 15l5.25 5.25" />
                                            ) : (
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                                            )}
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Bottom Controls Bar */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-6 pointer-events-auto">
                            <div className="flex items-center justify-center">
                                <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-4">
                                    <CallControls onLeave={onLeave} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Click anywhere to show/hide controls */}
            <div 
                className="absolute inset-0 z-10 cursor-pointer"
                onClick={() => setShowControls(!showControls)}
                style={{ pointerEvents: showControls ? 'none' : 'auto' }}
            />
        </StreamTheme>
    );
};

export const VideoCallPage: React.FC = () => {
    const { callId } = useParams<{ callId: string }>();
    const navigate = useNavigate();
    const client = useStreamVideoClient();
    const { createCall, isConnected, error: videoError, currentUser } = useStreamVideo();

    const [call, setCall] = useState<Call | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isJoining, setIsJoining] = useState(false);
    const [showPreview, setShowPreview] = useState(true);
    const [callState, setCallState] = useState<'preview' | 'joining' | 'joined' | 'error'>('preview');

    // Check if this is a team call
    const isTeamCall = callId?.includes('team-');
    const meetingTitle = isTeamCall ? 'Team Meeting' : 'Video Call';

    // Enhanced cleanup for page refresh/reload and navigation
    useEffect(() => {
        const handleBeforeUnload = () => {
            if (call) {

                call.leave({ reject: false }).catch(console.error);
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            if (call) {

                call.leave({ reject: false }).catch(console.error);
            }
        };
    }, [call]);

    const handleJoinCall = async () => {
        if (!isConnected || !callId || isJoining) return;

        setIsJoining(true);
        setCallState('joining');
        setError(null);
        setShowPreview(false);
        
        try {
            const callInstance = createCall(callId, 'default');
            if (!callInstance) {
                throw new Error('Could not create call instance.');
            }

            // For team calls, implement robust duplicate prevention
            if (isTeamCall) {

                try {
                    // First, try to get call state to check for existing sessions
                    const existingCall = client?.call('default', callId);
                    if (existingCall) {
                        // Force leave any existing connection
                        await existingCall.leave({ reject: false }).catch(() => {

                        });
                        
                        // Wait a moment for cleanup
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                } catch (cleanupError) {

                }
                
                // Check if call has no active participants (empty meeting)
                try {
                    const callState = await callInstance.get();
                    const activeParticipants = callState?.call?.session?.participants_count_by_role?.user || 0;
                    
                    if (activeParticipants === 0) {

                        // This is an empty meeting, safe to join fresh
                    } else {

                    }
                } catch (stateError) {

                }
            }
            
            // Join with optimized settings for team calls
            const joinOptions = {
                create: true,
                data: {
                    created_by_id: currentUser?.id,
                    custom: {
                        join_timestamp: Date.now(),
                        call_type: isTeamCall ? 'team' : 'individual',
                        session_id: `${currentUser?.id}_${Date.now()}`
                    }
                },
                // For team calls, don't create if empty participants
                ...(isTeamCall && {
                    ring: false,
                    notify: false
                })
            };
            
            await callInstance.join(joinOptions);

            setCall(callInstance);
            setCallState('joined');
            
            // Set up event listeners
            callInstance.on('call.session_participant_joined', (event) => {

            });
            
            callInstance.on('call.session_participant_left', (event) => {

                // For team calls, check if meeting should be terminated
                if (isTeamCall) {
                    setTimeout(() => {
                        const remainingParticipants = callInstance.state.participants.length;
                        if (remainingParticipants === 0) {

                            handleLeave();
                        }
                    }, 5000); // Wait 5 seconds before checking
                }
            });
            
            // Monitor for empty team meetings
            if (isTeamCall) {
                const emptyMeetingCheck = setInterval(() => {
                    const participantCount = callInstance.state.participants.length;
                    if (participantCount === 0) {

                        clearInterval(emptyMeetingCheck);
                        handleLeave();
                    }
                }, 30000); // Check every 30 seconds
                
                // Store interval reference for cleanup
                (callInstance as any).emptyMeetingCheck = emptyMeetingCheck;
            }
            
        } catch (err: any) {
            console.error('Failed to join call:', err);
            setError(`Failed to join the call: ${err.message}`);
            setCallState('error');
        } finally {
            setIsJoining(false);
        }
    };

    const handleLeave = async () => {
        if (call) {
            try {

                // Clean up monitoring interval
                if ((call as any).emptyMeetingCheck) {
                    clearInterval((call as any).emptyMeetingCheck);
                }
                
                // Leave the call
                await call.leave({ reject: false });

                // For team calls, end the call completely if we're the last participant
                if (isTeamCall) {
                    try {
                        const state = call.state;
                        const participantCount = state.participants.length;
                        
                        if (participantCount <= 1) {

                            await call.endCall();
                        }
                    } catch (endError) {
                        console.warn('Could not end team call:', endError);
                    }
                }
                
            } catch (error) {
                console.error('❌ Error leaving call:', error);
            }
        }
        setCall(null);
        setCallState('preview');
        navigate(-1); // Go back to the previous page
    };

    const handleCancelPreview = () => {
        navigate(-1);
    };

    if (!isConnected) {
        return (
            <div className="h-screen flex flex-col items-center justify-center bg-background dark:bg-background-dark text-text dark:text-text-dark">
                <h2 className="text-xl font-semibold mb-4">Video Client Not Ready</h2>
                <p>Connecting to video services. Please wait...</p>
                {videoError && <p className="text-red-500 mt-2">{videoError}</p>}
                <LoadingSpinner />
            </div>
        );
    }

    if (callState === 'error' || error || videoError) {
         return (
            <div className="h-screen flex flex-col items-center justify-center bg-background dark:bg-background-dark text-red-500">
                <h2 className="text-xl font-semibold mb-4">Call Error</h2>
                <p>{error || videoError}</p>
                <Button onClick={() => navigate(-1)} variant="outline" className="mt-4">Go Back</Button>
            </div>
        );
    }

    // Show preview screen
    if (callState === 'preview' && showPreview) {
        return (
            <CallPreview
                onJoin={handleJoinCall}
                onCancel={handleCancelPreview}
                userName={currentUser?.name || 'User'}
                userAvatar={currentUser?.image}
                callType="video"
                meetingTitle={meetingTitle}
            />
        );
    }
    
    // Show joining state
    if (callState === 'joining' || isJoining) {
        return (
            <div className="h-screen w-screen bg-gray-900 text-white flex flex-col items-center justify-center">
                <h2 className="text-xl font-semibold mb-4">Joining {meetingTitle}...</h2>
                <LoadingSpinner />
            </div>
        );
    }
    
    // Show the actual call interface
    return (
        <div className="h-screen w-screen bg-gray-900 text-white flex flex-col">
            <header className="p-4 border-b border-gray-700">
                <Button onClick={handleLeave} variant="ghost" leftIcon={<ArrowLeftIcon />}>
                    Leave Call
                </Button>
            </header>
             {call ? (
                <StreamCall call={call}>
                    <VideoCallUI onLeave={handleLeave} />
                </StreamCall>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center">
                    <p className="mb-4">Setting up your call...</p>
                    <LoadingSpinner />
                </div>
            )}
        </div>
    );
};