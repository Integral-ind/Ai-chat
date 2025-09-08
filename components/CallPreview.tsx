import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../components';
import { VideoCameraIcon, MicrophoneIcon, MicrophoneOffIcon, XMarkIcon } from '../constants';

interface CallPreviewProps {
  onJoin: () => void;
  onCancel: () => void;
  userName: string;
  userAvatar?: string;
  callType: 'voice' | 'video';
  meetingTitle?: string;
}

export const CallPreview: React.FC<CallPreviewProps> = ({
  onJoin,
  onCancel,
  userName,
  userAvatar,
  callType,
  meetingTitle
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoEnabled, setVideoEnabled] = useState(callType === 'video');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize camera/mic preview
  useEffect(() => {
    const initializeMedia = async () => {
      try {
        const constraints = {
          video: callType === 'video' ? { 
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user'
          } : false,
          audio: true
        };

        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        setStream(mediaStream);
        
        if (videoRef.current && callType === 'video') {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err: any) {
        console.error('Error accessing media devices:', err);
        setError('Could not access camera/microphone. Please check permissions.');
      }
    };

    initializeMedia();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [callType]);

  const toggleVideo = () => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoEnabled;
        setVideoEnabled(!videoEnabled);
      }
    }
  };

  const toggleAudio = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioEnabled;
        setAudioEnabled(!audioEnabled);
      }
    }
  };

  const handleJoin = () => {
    // Keep the stream for the actual call
    onJoin();
  };

  const handleCancel = () => {
    // Stop the stream before canceling
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    onCancel();
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col items-center justify-center">
      <div className="w-full max-w-4xl mx-auto p-8 flex flex-col items-center">
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            {meetingTitle || 'Ready to join?'}
          </h1>
          <p className="text-gray-300">
            {callType === 'video' ? 'Check your camera and microphone' : 'Check your microphone'}
          </p>
        </div>

        {/* Preview area */}
        <div className="relative mb-8">
          {callType === 'video' ? (
            <div className="relative">
              <div className="w-80 h-60 bg-gray-800 rounded-lg overflow-hidden border-2 border-gray-600">
                {videoEnabled && !error ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                    {error ? (
                      <>
                        <XMarkIcon className="w-12 h-12 mb-2" />
                        <p className="text-sm text-center px-4">{error}</p>
                      </>
                    ) : (
                      <>
                        <VideoCameraIcon className="w-16 h-16 mb-4" />
                        <div className="w-20 h-20 bg-gray-600 rounded-full flex items-center justify-center mb-2">
                          {userAvatar ? (
                            <img 
                              src={userAvatar} 
                              alt={userName}
                              className="w-full h-full object-cover rounded-full"
                            />
                          ) : (
                            <span className="text-2xl font-bold text-white">
                              {userName.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <p className="text-sm">Camera is off</p>
                      </>
                    )}
                  </div>
                )}
              </div>
              
              {/* User name overlay */}
              <div className="absolute bottom-4 left-4 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                {userName}
              </div>
            </div>
          ) : (
            /* Voice call preview */
            <div className="flex flex-col items-center">
              <div className="w-32 h-32 bg-gray-600 rounded-full flex items-center justify-center mb-4">
                {userAvatar ? (
                  <img 
                    src={userAvatar} 
                    alt={userName}
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  <span className="text-4xl font-bold text-white">
                    {userName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <p className="text-xl text-white font-semibold">{userName}</p>
              <p className="text-gray-400">Voice call</p>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center space-x-6 mb-8">
          {/* Microphone toggle */}
          <button
            onClick={toggleAudio}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
              audioEnabled 
                ? 'bg-gray-600 hover:bg-gray-500 text-white' 
                : 'bg-red-500 hover:bg-red-600 text-white'
            }`}
            title={audioEnabled ? 'Turn off microphone' : 'Turn on microphone'}
          >
            {audioEnabled ? (
              <MicrophoneIcon className="w-6 h-6" />
            ) : (
              <MicrophoneOffIcon className="w-6 h-6" />
            )}
          </button>

          {/* Camera toggle (video calls only) */}
          {callType === 'video' && (
            <button
              onClick={toggleVideo}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
                videoEnabled 
                  ? 'bg-gray-600 hover:bg-gray-500 text-white' 
                  : 'bg-red-500 hover:bg-red-600 text-white'
              }`}
              title={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
            >
              <VideoCameraIcon className="w-6 h-6" />
            </button>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center space-x-4">
          <Button
            onClick={handleCancel}
            variant="outline"
            className="px-8 py-3"
          >
            Cancel
          </Button>
          
          <Button
            onClick={handleJoin}
            className="px-8 py-3 bg-green-600 hover:bg-green-700"
            disabled={!!error}
          >
            Join now
          </Button>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-900/20 border border-red-500 rounded-lg text-red-300 text-center max-w-md">
            <p className="text-sm">
              {error} You can still join the call, but others may not be able to see or hear you.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};