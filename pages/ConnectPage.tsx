import React, { useState, useEffect, useCallback, FormEvent, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

// --- UI Components & Types ---
import { Card, Button } from '../components'; // Assuming these are in your project
import { User as FrontendUser, UserSearchResult, ConnectionRequestWithProfile, ConnectedUser, ConnectionStatus, UserPublicProfile } from '../types';
import {
    SearchIcon as GlobalSearchIcon, UsersIcon, ClockIcon, SendIcon as SendIconNav,
    UserPlusIcon as GlobalUserPlusIcon, UserCheckIcon, UserXIcon, ClockRewindIcon,
    MessageCircleIcon, PhoneIcon, Users2Icon, VideoCameraIcon
} from '../constants'; // Assuming these are in your project

// --- Services & Hooks ---
import { connectService } from '../connectService';
import { useStreamChat } from '../components/StreamProvider';
import { presenceService } from '../presenceService';

// --- Stream Chat React Imports ---
import {
  Channel as StreamChannel,
  ChannelHeader,
  MessageInput,
  MessageList,
  Thread,
  Window,
  useChatContext,
  Chat,
  useMessageInputContext,
  useChannelActionContext
} from 'stream-chat-react';
import { Channel } from 'stream-chat'; // Import the Channel TYPE for state

// --- Helper UI Components ---

const LoadingSpinner: React.FC = () => (
  <div className="flex items-center justify-center h-full">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

const EmptyState: React.FC<{ message: string, subMessage: string, actionButton?: React.ReactNode }> = ({
  message,
  subMessage,
  actionButton
}) => (
  <div className="flex flex-col items-center justify-center h-full text-center text-muted dark:text-muted-dark p-4">
    <MessageCircleIcon className="w-16 h-16 mb-4 opacity-50" />
    <p className="text-lg font-medium text-text dark:text-text-dark">{message}</p>
    <p className="text-sm mb-4">{subMessage}</p>
    {actionButton}
  </div>
);

// --- Custom Stream Chat Components ---

const CustomChannelHeader: React.FC<{ 
  onVideoCall: (otherUserId: string) => void;
  onVoiceCall: (otherUserId: string) => void;
  channel: any;
  currentUserId: string;
}> = ({ onVideoCall, onVoiceCall, channel, currentUserId }) => {
  // Extract the other user's ID from channel members
  const getOtherUserId = () => {
    if (channel?.state?.members) {
      const members = Object.keys(channel.state.members);
      return members.find(id => id !== currentUserId) || '';
    }
    return '';
  };

  const otherUserId = getOtherUserId();

  return (
    <div className="p-4 border-b border-border dark:border-border-dark flex items-center justify-between bg-card dark:bg-card-dark">
      <ChannelHeader />
      <div className="flex items-center space-x-2">
        <button
          onClick={() => onVoiceCall(otherUserId)}
          className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Start Voice Call"
          disabled={!otherUserId}
        >
          <PhoneIcon className="w-5 h-5 text-text dark:text-text-dark" />
        </button>
        <button
          onClick={() => onVideoCall(otherUserId)}
          className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Start Video Call"
          disabled={!otherUserId}
        >
          <VideoCameraIcon className="w-5 h-5 text-text dark:text-text-dark" />
        </button>
      </div>
    </div>
  );
};

// Enhanced Custom Send Button Component
const CustomSendButton: React.FC<{ sendMessage: () => void; disabled: boolean }> = ({ sendMessage, disabled }) => (
  <button
    onClick={sendMessage}
    disabled={disabled}
    className="group relative w-10 h-10 bg-primary hover:bg-primary-dark disabled:bg-muted disabled:cursor-not-allowed rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105 disabled:scale-100 shadow-lg hover:shadow-xl"
    title="Send message"
  >
    <SendIconNav className="w-5 h-5 text-white group-hover:scale-110 transition-transform duration-200" />
  </button>
);

// Enhanced Emoji Picker Component
const EmojiPickerButton: React.FC<{ onEmojiSelect: (emoji: string) => void }> = ({ onEmojiSelect }) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
  const commonEmojis = ['😀', '😂', '😍', '🤔', '👍', '👎', '❤️', '🔥', '💯', '🎉', '😢', '😮', '😡', '🤝', '🙏', '✨'];
  
  return (
    <div className="relative">
      <button
        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
        className="group w-8 h-8 bg-transparent hover:bg-surface dark:hover:bg-surface-dark rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
        title="Add emoji"
      >
        <span className="text-lg group-hover:scale-110 transition-transform duration-200">😀</span>
      </button>
      
      {showEmojiPicker && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40"
            onClick={() => setShowEmojiPicker(false)}
          />
          
          {/* Emoji Panel */}
          <div className="absolute bottom-full right-0 mb-2 z-50 bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-2xl shadow-2xl p-4 w-80 max-h-64 overflow-y-auto backdrop-blur-sm">
            <div className="mb-3">
              <h4 className="text-sm font-semibold text-text dark:text-text-dark mb-2">Frequently Used</h4>
              <div className="grid grid-cols-8 gap-2">
                {commonEmojis.map((emoji, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      onEmojiSelect(emoji);
                      setShowEmojiPicker(false);
                    }}
                    className="w-8 h-8 flex items-center justify-center text-lg hover:bg-surface dark:hover:bg-surface-dark rounded-lg transition-all duration-200 hover:scale-125"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
            
            <div>
              <h4 className="text-sm font-semibold text-text dark:text-text-dark mb-2">More Emojis</h4>
              <div className="grid grid-cols-8 gap-2">
                {['🚀', '💡', '⭐', '🌟', '🎯', '🔔', '📱', '💻', '🎵', '🎮', '⚡', '🌈', '🎨', '📷', '🍕', '☕'].map((emoji, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      onEmojiSelect(emoji);
                      setShowEmojiPicker(false);
                    }}
                    className="w-8 h-8 flex items-center justify-center text-lg hover:bg-surface dark:hover:bg-surface-dark rounded-lg transition-all duration-200 hover:scale-125"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// Enhanced Custom Message Input Component with proper Stream integration
const CustomMessageInput: React.FC<{ channel: any }> = ({ channel }) => {
  const { 
    sendMessage, 
    text, 
    handleChange, 
    handleSubmit,
    uploadNewFiles,
    removeFile,
    attachments = []
  } = useMessageInputContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleEmojiSelect = (emoji: string) => {
    const currentText = text || '';
    const newText = currentText + emoji;
    handleChange({ target: { value: newText } } as React.ChangeEvent<HTMLTextAreaElement>);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && uploadNewFiles) {
      uploadNewFiles(Array.from(files));
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text && text.trim()) {
      handleSubmit(e);
    }
  };

  return (
    <>
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        multiple
        className="hidden"
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
      />
      
      {/* Attachment previews */}
      {attachments.length > 0 && (
        <div className="p-4 pt-2 bg-background dark:bg-background-dark border-t border-border dark:border-border-dark">
          <div className="flex flex-wrap gap-2">
            {attachments.map((attachment: any, index: number) => (
              <div 
                key={index} 
                className="relative bg-surface dark:bg-surface-dark rounded-lg p-2 border border-border dark:border-border-dark"
              >
                <div className="flex items-center space-x-2">
                  <div className="flex-shrink-0">
                    {attachment.type?.startsWith('image/') ? (
                      <img 
                        src={URL.createObjectURL(attachment.file || attachment)} 
                        alt="Preview" 
                        className="w-12 h-12 object-cover rounded"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-primary/10 rounded flex items-center justify-center">
                        <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text dark:text-text-dark truncate">
                      {attachment.file?.name || attachment.name || 'File'}
                    </p>
                    <p className="text-xs text-muted dark:text-muted-dark">
                      {attachment.file?.size ? `${Math.round(attachment.file.size / 1024)}KB` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => removeFile && removeFile(attachment.id)}
                    className="flex-shrink-0 w-6 h-6 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-colors"
                  >
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="p-4 bg-card dark:bg-card-dark border-t border-border dark:border-border-dark">
        <form onSubmit={onSubmit} className="flex items-end space-x-3">
          <div className="flex-1 relative">
            <div className="flex items-center bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-2xl px-4 py-2 focus-within:border-primary transition-colors duration-200">
              {/* Attachment Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="group w-8 h-8 bg-transparent hover:bg-background dark:hover:bg-background-dark rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 mr-2"
                title="Attach file"
              >
                <svg className="w-5 h-5 text-muted dark:text-muted-dark group-hover:text-text dark:group-hover:text-text-dark transition-colors duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>
              
              {/* Text Input */}
              <textarea
                value={text || ''}
                onChange={handleChange || (() => {})}
                placeholder="Type a message..."
                className="flex-1 bg-transparent border-none outline-none resize-none text-text dark:text-text-dark placeholder-muted dark:placeholder-muted-dark text-sm max-h-24 min-h-[20px] py-1"
                rows={1}
                style={{
                  lineHeight: '1.4',
                  maxHeight: '96px',
                  minHeight: '20px',
                  height: 'auto',
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    onSubmit(e);
                  }
                }}
              />
              
              {/* Emoji Picker */}
              <EmojiPickerButton onEmojiSelect={handleEmojiSelect} />
            </div>
          </div>
          
          {/* Send Button */}
          <CustomSendButton 
            sendMessage={() => handleSubmit({} as React.FormEvent)} 
            disabled={!text || !text.trim()} 
          />
        </form>
      </div>
    </>
  );
};

// REMOVED: This component is no longer needed as the ChannelList has been removed.
// const CustomChannelPreview: React.FC<...> = (...) => { ... };

// --- Refactored Stream Chat Wrapper Component ---
const StreamChatWrapper: React.FC<{
  currentUser: FrontendUser;
  connections: ConnectedUser[];
  activeChannel: Channel | null;
  setActiveChannel: (channel: Channel | null) => void;
  onVideoCall: (otherUserId: string) => void;
  onVoiceCall: (otherUserId: string) => void;
  onStartChatWithConnection: (connection: ConnectedUser) => void;
  onSwitchToConnectTab: () => void;
  isChannelLoading: boolean;
  isPresenceActive: boolean;
}> = ({
  currentUser,
  connections,
  activeChannel,
  setActiveChannel,
  onVideoCall,
  onVoiceCall,
  onStartChatWithConnection,
  onSwitchToConnectTab,
  isChannelLoading,
  isPresenceActive,
}) => {
  const { client, error, isConnected } = useStreamChat();

  // REMOVED: These were only used for the now-removed ChannelList component.
  // const channelListFilters = useMemo(...);
  // const channelListSort = useMemo(...);

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center h-full text-center">
        <div>
          <LoadingSpinner />
          <p className="mt-4 text-muted dark:text-muted-dark">{error ? 'Connection Error' : 'Connecting to chat...'}</p>
          {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-background dark:bg-background-dark">
      {/* Sidebar */}
      <div className="w-64 border-r border-border dark:border-border-dark flex flex-col bg-card dark:bg-card-dark">
        <div className="p-4 border-b border-border dark:border-border-dark flex-shrink-0">
          <h2 className="text-lg font-semibold text-text dark:text-text-dark">Messages</h2>
          <div className="flex items-center space-x-2">
            <p className="text-xs text-muted dark:text-muted-dark">{connections.length} connection{connections.length !== 1 ? 's' : ''}</p>
            {isPresenceActive && (
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-green-600 dark:text-green-400">Live</span>
              </div>
            )}
          </div>
        </div>

        {connections.length > 0 && (
          <div className="p-3 border-b border-border dark:border-border-dark">
            <h3 className="text-xs font-medium text-muted dark:text-muted-dark uppercase tracking-wide mb-2">Start New Chat</h3>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {connections.map(connection => (
                <button
                  key={connection.id}
                  onClick={() => onStartChatWithConnection(connection)}
                  className="w-full flex items-center space-x-2 p-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                >
                  <img
                    src={connection.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(connection.full_name || 'U')}&background=random`}
                    alt={connection.full_name || 'User'}
                    className="w-6 h-6 rounded-full"
                  />
                  <span className="text-gray-700 dark:text-gray-300 truncate">{connection.full_name || connection.email}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {isChannelLoading ? (
            <div className="flex flex-col items-center justify-center h-full">
                <LoadingSpinner />
                <p className="mt-2 text-sm text-muted dark:text-muted-dark">Opening chat...</p>
            </div>
        ) : activeChannel && client ? (
          <StreamChannel channel={activeChannel} key={activeChannel.cid}>
            <Window>
              <CustomChannelHeader 
                onVideoCall={onVideoCall}
                onVoiceCall={onVoiceCall}
                channel={activeChannel}
                currentUserId={currentUser.id}
              />
              <MessageList />
              <CustomMessageInput channel={activeChannel} />
            </Window>
            <Thread />
          </StreamChannel>
        ) : (
          <EmptyState
            message="Select a Conversation"
            subMessage="Choose a chat from the left panel or start a new one with a connection."
            actionButton={
              connections.length === 0 ? (
                <Button onClick={onSwitchToConnectTab} leftIcon={<GlobalUserPlusIcon className="w-4 h-4" />}>
                  Find Connections
                </Button>
              ) : undefined
            }
          />
        )}
      </div>
    </div>
  );
};

// --- Prop Interfaces ---
interface MainTabItem {
  id: 'chat' | 'call' | 'connect';
  label: string;
  icon: React.FC<{ className?: string }>;
}

interface ConnectSubTabItem {
  id: 'search' | 'pending' | 'sent';
  label: string;
  icon: React.FC<{ className?: string }>;
  count?: number;
}

interface ConnectPageProps {
  currentUser: FrontendUser | null;
}

// --- Main Component ---
export const ConnectPage: React.FC<ConnectPageProps> = ({ currentUser }) => {
  const navigate = useNavigate();
  const { client, createOrGetChannelWithUsers, isConnected } = useStreamChat();

  // --- State Hooks ---
  const [activeMainTab, setActiveMainTab] = useState<MainTabItem['id']>('connect');
  const [activeConnectSubTab, setActiveConnectSubTab] = useState<ConnectSubTabItem['id']>('search');
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<UserSearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [connections, setConnections] = useState<ConnectedUser[]>([]);
  const [pendingRequests, setPendingRequests] = useState<ConnectionRequestWithProfile[]>([]);
  const [sentRequests, setSentRequests] = useState<ConnectionRequestWithProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuggestionLoading, setIsSuggestionLoading] = useState(false);
  const [isChannelLoading, setIsChannelLoading] = useState(false); 
  const [error, setError] = useState<string | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [lastCallAttempt, setLastCallAttempt] = useState<number>(0);
  const [callInProgress, setCallInProgress] = useState<string | null>(null);
  const [isPresenceActive, setIsPresenceActive] = useState(false);

  // --- Ref Hooks ---
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceTimeoutRef = useRef<number | null>(null);

  // --- Data Fetching and Side Effects ---
  const fetchAllConnectionData = useCallback(async () => {
    if (!currentUser?.id) return;
    setIsLoading(true);
    setError(null);
    try {
      const [conns, pend, snt] = await Promise.all([
        connectService.getConnections(currentUser.id),
        connectService.getPendingRequests(currentUser.id),
        connectService.getSentRequests(currentUser.id)
      ]);
      setConnections(conns);
      setPendingRequests(pend);
      setSentRequests(snt);
      
      // Get real online status for connections
      const connectionIds = conns.map(c => c.id);
      const onlineUserIds = await presenceService.getOnlineUsers(connectionIds);
      setOnlineUsers(onlineUserIds);
    } catch (err: any) {
      setError(err.message || "Failed to load connection data.");
      console.error("Error fetching connection data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      fetchAllConnectionData();
    }
  }, [currentUser, fetchAllConnectionData]);

  // Initialize presence service for real-time online status
  useEffect(() => {
    if (currentUser) {
      presenceService.initialize((onlineUserIds: string[]) => {

        setOnlineUsers(onlineUserIds);
        setIsPresenceActive(true);
      });
    }
    
    return () => {
      // Cleanup presence service when component unmounts
      presenceService.cleanup();
    };
  }, [currentUser]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node) &&
          searchInputRef.current && !searchInputRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- Event Handlers ---
  // Generate valid call ID (only a-z, 0-9, _, - allowed, max 64 chars)
  const generateCallId = useCallback((user1Id: string, user2Id: string) => {
    const participants = [user1Id, user2Id].sort(); // Sort for consistency
    
    // Create short hashes of user IDs to keep call ID under 64 characters
    const hash1 = participants[0].substring(0, 8); // First 8 chars
    const hash2 = participants[1].substring(0, 8); // First 8 chars
    const timestamp = Date.now().toString(36); // Base36 for shorter timestamp
    
    const callId = `call-${hash1}-${hash2}-${timestamp}`;
    
    // Replace any invalid characters and ensure max 64 length
    const cleanId = callId.replace(/[^a-zA-Z0-9_-]/g, '-');
    return cleanId.length > 64 ? cleanId.substring(0, 64) : cleanId;
  }, []);

  // Handle video call - simplified to work like test buttons
  const handleVideoCall = useCallback(async (otherUserId: string) => {

    if (!currentUser || !otherUserId) {
      alert("Cannot start call without valid users.");
      return;
    }

    // Rate limiting: prevent multiple calls to same user
    const now = Date.now();
    const timeSinceLastCall = now - lastCallAttempt;
    
    if (timeSinceLastCall < 5000) { // 5 second cooldown
      alert('Please wait a moment before making another call.');
      return;
    }

    if (callInProgress === otherUserId) {
      alert('Call already in progress with this user.');
      return;
    }

    setLastCallAttempt(now);
    setCallInProgress(otherUserId);

    const callId = generateCallId(currentUser.id, otherUserId);
    
    // Send call notification in background (don't wait for it)
    if (isConnected && createOrGetChannelWithUsers) {
      try {
        const user1 = { id: currentUser.id, name: currentUser.full_name || 'User', image: currentUser.avatar_url };
        const user2 = { id: otherUserId, name: 'User', image: undefined };
        
        const channel = await createOrGetChannelWithUsers(user1, user2);
        if (channel) {
          // Send notification without blocking the calling screen
          channel.sendMessage({
            text: `📹 INCOMING VIDEO CALL from ${currentUser.full_name || 'Someone'}! Click to join: ${window.location.origin}/#/app/call/${callId}`,
            custom_type: 'video_call_invitation',
            call_id: callId,
            caller_id: currentUser.id,
            caller_name: currentUser.full_name || currentUser.email || 'Someone',
            caller_avatar: currentUser.avatar_url,
            call_type: 'video',
            priority: 'high'
          }).catch(e => console.warn('Failed to send call notification:', e));

        }
      } catch (error) {
        console.warn('Failed to send call notification:', error);
        // Don't return - continue with calling screen anyway
      }
    }
    
    // Navigate to the calling screen immediately (like test buttons)
    const recipientUser = connections.find(c => c.id === otherUserId);
    const params = new URLSearchParams({
      type: 'video',
      recipient: otherUserId,
      name: recipientUser?.full_name || 'User',
      ...(recipientUser?.avatar_url && { avatar: recipientUser.avatar_url })
    });
    
    const callingUrl = `/app/calling/${callId}?${params.toString()}`;

    navigate(callingUrl);
    
    // Clear call in progress after 30 seconds (call timeout)
    setTimeout(() => {
      setCallInProgress(null);
    }, 30000);
  }, [navigate, currentUser, isConnected, generateCallId, createOrGetChannelWithUsers, lastCallAttempt, callInProgress, connections]);

  // Handle voice call - simplified to work like test buttons
  const handleVoiceCall = useCallback(async (otherUserId: string) => {

    if (!currentUser || !otherUserId) {
      alert("Cannot start call without valid users.");
      return;
    }

    // Rate limiting: prevent multiple calls to same user
    const now = Date.now();
    const timeSinceLastCall = now - lastCallAttempt;
    
    if (timeSinceLastCall < 5000) { // 5 second cooldown
      alert('Please wait a moment before making another call.');
      return;
    }

    if (callInProgress === otherUserId) {
      alert('Call already in progress with this user.');
      return;
    }

    setLastCallAttempt(now);
    setCallInProgress(otherUserId);

    const callId = `voice-${generateCallId(currentUser.id, otherUserId)}`;
    
    // Send call notification in background (don't wait for it)
    if (isConnected && createOrGetChannelWithUsers) {
      try {
        const user1 = { id: currentUser.id, name: currentUser.full_name || 'User', image: currentUser.avatar_url };
        const user2 = { id: otherUserId, name: 'User', image: undefined };
        
        const channel = await createOrGetChannelWithUsers(user1, user2);
        if (channel) {
          // Send notification without blocking the calling screen
          channel.sendMessage({
            text: `📞 INCOMING VOICE CALL from ${currentUser.full_name || 'Someone'}! Click to join: ${window.location.origin}/#/app/voice/${callId}`,
            custom_type: 'voice_call_invitation',
            call_id: callId,
            caller_id: currentUser.id,
            caller_name: currentUser.full_name || currentUser.email || 'Someone',
            caller_avatar: currentUser.avatar_url,
            call_type: 'voice',
            priority: 'high'
          }).catch(e => console.warn('Failed to send voice call notification:', e));

        }
      } catch (error) {
        console.warn('Failed to send voice call notification:', error);
        // Don't return - continue with calling screen anyway
      }
    }
    
    // Navigate to the calling screen immediately (like test buttons)
    const recipientUser = connections.find(c => c.id === otherUserId);
    const params = new URLSearchParams({
      type: 'voice',
      recipient: otherUserId,
      name: recipientUser?.full_name || 'User',
      ...(recipientUser?.avatar_url && { avatar: recipientUser.avatar_url })
    });
    
    const callingUrl = `/app/calling/${callId}?${params.toString()}`;

    navigate(callingUrl);
    
    // Clear call in progress after 30 seconds (call timeout)
    setTimeout(() => {
      setCallInProgress(null);
    }, 30000);
  }, [navigate, currentUser, isConnected, generateCallId, createOrGetChannelWithUsers, lastCallAttempt, callInProgress, connections]);

  const handleStartChatWithConnection = useCallback(async (connection: ConnectedUser) => {
    if (!currentUser || !client || !isConnected || !createOrGetChannelWithUsers) {
      alert('Chat service is not available. Please try again.');
      return;
    }
    
    setActiveMainTab('chat');
    setIsChannelLoading(true);
    setActiveChannel(null); 

    try {
      const user1 = { id: currentUser.id, name: currentUser.full_name || 'Me', image: currentUser.avatar_url };
      const user2 = { id: connection.id, name: connection.full_name, image: connection.avatar_url };

      const channel = await createOrGetChannelWithUsers(user1, user2);

      if (channel) {
        setActiveChannel(channel);
      }
    } catch (error) {
      console.error('❌ Error starting chat:', error);
      alert('Failed to start chat. Please check the console for details.');
      setActiveMainTab('connect');
    } finally {
      setIsChannelLoading(false);
    }
  }, [currentUser, client, isConnected, createOrGetChannelWithUsers]);

  const fetchSuggestions = useCallback(async (term: string) => {
    if (!term.trim() || term.length < 2) {
      setSuggestions([]);
      return;
    }
    setIsSuggestionLoading(true);
    try {
      const results = await connectService.searchUsersLegacy(term);
      setSuggestions(results.slice(0, 5));
      setShowSuggestions(true);
      setSelectedSuggestionIndex(-1);
    } catch (err) {
      console.error("Error fetching suggestions:", err);
    } finally {
      setIsSuggestionLoading(false);
    }
  }, []);

  const handleSearchInputChange = useCallback((value: string) => {
    setSearchTerm(value);
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    debounceTimeoutRef.current = window.setTimeout(() => fetchSuggestions(value), 300);
  }, [fetchSuggestions]);

  const selectSuggestion = useCallback((suggestion: UserSearchResult) => {
    setSearchTerm(suggestion.full_name || suggestion.email);
    setShowSuggestions(false);
    setSearchResults([suggestion]);
  }, []);

  const handleSearch = useCallback(async (e?: FormEvent) => {
    e?.preventDefault();
    if (!searchTerm.trim()) return;
    setShowSuggestions(false);
    setIsLoading(true);
    setError(null);
    try {
      const results = await connectService.searchUsersLegacy(searchTerm);
      setSearchResults(results);
      if (results.length === 0) setError("No users found.");
    } catch (err: any) {
      setError(err.message || "Search failed.");
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm]);

  const handleKeyDownSearch = useCallback((e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); setSelectedSuggestionIndex(p => (p < suggestions.length - 1 ? p + 1 : p)); break;
      case 'ArrowUp': e.preventDefault(); setSelectedSuggestionIndex(p => (p > 0 ? p - 1 : -1)); break;
      case 'Enter':
        e.preventDefault();
        if (selectedSuggestionIndex > -1) {
          selectSuggestion(suggestions[selectedSuggestionIndex]);
        } else {
          handleSearch(e as any);
        }
        break;
      case 'Escape': setShowSuggestions(false); break;
    }
  }, [showSuggestions, suggestions, selectedSuggestionIndex, selectSuggestion, handleSearch]);

  const handleSendRequest = useCallback(async (receiverId: string) => {
    setIsLoading(true);
    try {
      await connectService.sendConnectionRequest(receiverId);
      alert("Connection request sent!");
      await Promise.all([handleSearch(), fetchAllConnectionData()]);
    } catch (err: any) {
      alert(`Failed to send request: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [handleSearch, fetchAllConnectionData]);

  const handleRequestAction = useCallback(async (action: 'accept' | 'reject' | 'cancel' | 'remove', id: string) => {
    setIsLoading(true);
    try {
      switch(action) {
        case 'accept': await connectService.acceptConnectionRequest(id); alert("Request accepted!"); break;
        case 'reject': await connectService.rejectConnectionRequest(id); alert("Request rejected."); break;
        case 'cancel': await connectService.cancelConnectionRequest(id); alert("Request cancelled."); break;
        case 'remove': await connectService.removeConnection(id); alert("Connection removed."); break;
      }
      await fetchAllConnectionData();
      if (activeConnectSubTab === 'search') await handleSearch();
    } catch(err: any) {
      alert(`Action failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [fetchAllConnectionData, activeConnectSubTab, handleSearch]);

  // --- Memoized Values ---
  const mainTabs: MainTabItem[] = useMemo(() => [
    { id: 'chat', label: 'Chat', icon: MessageCircleIcon },
    { id: 'call', label: 'Call', icon: PhoneIcon },
    { id: 'connect', label: 'Connect', icon: Users2Icon },
  ], []);

  const connectSubTabs: ConnectSubTabItem[] = useMemo(() => [
    { id: 'search', label: 'Search Users', icon: GlobalSearchIcon },
    { id: 'pending', label: 'Pending', icon: ClockIcon, count: pendingRequests.length },
    { id: 'sent', label: 'Sent', icon: SendIconNav, count: sentRequests.length },
  ], [pendingRequests.length, sentRequests.length]);

  // --- Render Functions ---
  const renderUserCard = (user: UserPublicProfile, statusInfo: { status: ConnectionStatus, requestId?: string, connectionId?: string }) => (
    <Card key={user.id} className="p-4 flex items-center justify-between hover:shadow-md transition-shadow">
      <div className="flex items-center space-x-3 min-w-0">
        <div className="relative flex-shrink-0">
          <img src={user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name || 'U')}`} alt={user.full_name || 'Avatar'} className="w-10 h-10 rounded-full object-cover" />
          {onlineUsers.includes(user.id) && <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full"></div>}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-text dark:text-text-dark truncate">{user.full_name || 'Unnamed User'}</p>
          <p className="text-xs text-muted dark:text-muted-dark truncate">{user.email}</p>
        </div>
      </div>
      <div className="flex space-x-2 flex-shrink-0 ml-2">
        {statusInfo.status === 'none' && <Button size="sm" onClick={() => handleSendRequest(user.id)} leftIcon={<GlobalUserPlusIcon className="w-4 h-4"/>}>Connect</Button>}
        {statusInfo.status === 'pending_sent' && statusInfo.requestId && <Button size="sm" variant="outline" onClick={() => handleRequestAction('cancel', statusInfo.requestId!)} leftIcon={<ClockRewindIcon className="w-4 h-4"/>}>Cancel</Button>}
        {statusInfo.status === 'pending_received' && statusInfo.requestId && (
          <>
            <Button size="sm" onClick={() => handleRequestAction('accept', statusInfo.requestId!)} leftIcon={<UserCheckIcon className="w-4 h-4"/>}>Accept</Button>
            <Button size="sm" variant="danger" onClick={() => handleRequestAction('reject', statusInfo.requestId!)} leftIcon={<UserXIcon className="w-4 h-4"/>}>Reject</Button>
          </>
        )}
        {statusInfo.status === 'connected' && statusInfo.connectionId && <Button size="sm" variant="danger" onClick={() => handleRequestAction('remove', statusInfo.connectionId!)} leftIcon={<UserXIcon className="w-4 h-4"/>}>Remove</Button>}
      </div>
    </Card>
  );

  const renderSuggestionItem = (user: UserSearchResult, index: number) => (
    <div
      key={user.id}
      className={`px-4 py-3 cursor-pointer flex items-center space-x-3 hover:bg-gray-50 dark:hover:bg-gray-800 ${selectedSuggestionIndex === index ? 'bg-gray-100 dark:bg-gray-700' : ''}`}
      onClick={() => selectSuggestion(user)}
    >
      <div className="relative"><img src={user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name || 'U')}`} alt={user.full_name || 'Avatar'} className="w-8 h-8 rounded-full object-cover" /></div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text dark:text-text-dark truncate">{user.full_name || 'Unnamed User'}</p>
        <p className="text-xs text-muted dark:text-muted-dark truncate">{user.email}</p>
      </div>
    </div>
  );

  const renderChatTab = () => (
    <StreamChatWrapper
        currentUser={currentUser!}
        connections={connections}
        activeChannel={activeChannel}
        setActiveChannel={setActiveChannel}
        onVideoCall={handleVideoCall}
        onVoiceCall={handleVoiceCall}
        onStartChatWithConnection={handleStartChatWithConnection}
        onSwitchToConnectTab={() => setActiveMainTab('connect')}
        isChannelLoading={isChannelLoading}
        isPresenceActive={isPresenceActive}
    />
  );
  
  const renderCallTab = () => {

    return (
      <div className="space-y-4 py-6">
        <div className="text-center py-8">
          <PhoneIcon className="w-16 h-16 mx-auto text-muted dark:text-muted-dark mb-4" />
          <h3 className="text-lg font-medium text-text dark:text-text-dark mb-2">Voice & Video Calls</h3>
          <p className="text-muted dark:text-muted-dark mb-6">Start a high-quality video call with your connections.</p>
        </div>
        {connections.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-muted dark:text-muted-dark">No connections available for calls.</p>
          <Button className="mt-4" onClick={() => setActiveMainTab('connect')} leftIcon={<Users2Icon className="w-4 h-4" />}>Find People</Button>
        </Card>
      ) : (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted dark:text-muted-dark uppercase tracking-wide">Available Connections ({connections.length})</h4>
          
          {connections.map(user => (
            <Card key={user.id} className="p-4 flex items-center justify-between hover:shadow-md transition-shadow">
              <div className="flex items-center space-x-3"><div className="relative"><img src={user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name || 'U')}`} alt={user.full_name || 'Avatar'} className="w-10 h-10 rounded-full object-cover" />{onlineUsers.includes(user.id) && <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full"></div>}</div><div><p className="text-sm font-medium text-text dark:text-text-dark">{user.full_name || 'Unnamed User'}</p><p className={`text-xs ${onlineUsers.includes(user.id) ? 'text-green-600 dark:text-green-400' : 'text-muted dark:text-muted-dark'}`}>{onlineUsers.includes(user.id) ? 'Online' : 'Offline'}</p></div></div>
              <div className="flex space-x-2">
                <Button size="sm" variant="outline" leftIcon={<MessageCircleIcon className="w-4 h-4" />} onClick={() => handleStartChatWithConnection(user)}>Chat</Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  leftIcon={<PhoneIcon className="w-4 h-4" />} 
                  onClick={() => handleVoiceCall(user.id)}
                  disabled={callInProgress === user.id}
                >
                  {callInProgress === user.id ? 'Calling...' : 'Voice Call'}
                </Button>
                <Button 
                  size="sm" 
                  leftIcon={<VideoCameraIcon className="w-4 h-4" />} 
                  onClick={() => handleVideoCall(user.id)}
                  disabled={callInProgress === user.id}
                >
                  {callInProgress === user.id ? 'Calling...' : 'Video Call'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
    );
  };

  const renderConnectSubTabContent = () => {
    const isSearching = isLoading && activeConnectSubTab === 'search';
    if (isLoading && !isSearching) return <div className="text-center py-10"><LoadingSpinner /></div>;
    if (error && !isSearching) return <div className="text-center py-10 text-red-500">{error}</div>;

    switch (activeConnectSubTab) {
      case 'search':
        return (
          <div className="space-y-4">
            <form onSubmit={handleSearch} className="flex space-x-2">
              <div className="relative flex-grow">
                <input ref={searchInputRef} type="search" value={searchTerm} onChange={(e) => handleSearchInputChange(e.target.value)} onKeyDown={handleKeyDownSearch} onFocus={() => searchTerm.length > 1 && setShowSuggestions(true)} placeholder="Search by name or email..." className="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-card dark:bg-card-dark text-text dark:text-text-dark" />
                {(isSuggestionLoading || isSearching) && <div className="absolute right-3 top-1/2 transform -translate-y-1/2"><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div></div>}
                {showSuggestions && suggestions.length > 0 && <div ref={suggestionsRef} className="absolute z-10 w-full mt-1 bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-md shadow-lg max-h-80 overflow-y-auto">{suggestions.map(renderSuggestionItem)}</div>}
              </div>
              <Button type="submit" loading={isSearching}>Search</Button>
            </form>
            {error && !isLoading && <p className="text-red-500 text-sm p-2 bg-red-100 dark:bg-red-900/20 rounded">{error}</p>}
            {searchResults.map(user => renderUserCard(user, { status: user.connection_status, requestId: user.request_id, connectionId: user.connection_id }))}
          </div>
        );
      case 'pending':
        if (pendingRequests.length === 0) return <p className="text-muted dark:text-muted-dark text-center py-10">No pending requests.</p>;
        return <div className="space-y-3">{pendingRequests.map(req => req.sender_profile ? renderUserCard(req.sender_profile, { status: 'pending_received', requestId: req.id }) : null)}</div>;
      case 'sent':
        if (sentRequests.length === 0) return <p className="text-muted dark:text-muted-dark text-center py-10">No sent requests.</p>;
        return <div className="space-y-3">{sentRequests.map(req => req.receiver_profile ? renderUserCard(req.receiver_profile, { status: 'pending_sent', requestId: req.id }) : null)}</div>;
      default: return null;
    }
  };

  const renderConnectSubTabs = () => (
    <div className="py-6 flex-1 flex flex-col overflow-hidden">
      <div className="flex border-b border-border dark:border-border-dark overflow-x-auto scrollbar-hide flex-shrink-0">
        {connectSubTabs.map(subTab => (
          <button key={subTab.id} onClick={() => setActiveConnectSubTab(subTab.id)} className={`flex-shrink-0 flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-colors ${activeConnectSubTab === subTab.id ? 'border-b-2 border-primary text-primary' : 'text-muted dark:text-muted-dark hover:text-text dark:hover:text-text-dark border-b-2 border-transparent'}`}>
            <subTab.icon className="w-4 h-4" />
            <span>{subTab.label}</span>
            {subTab.count !== undefined && subTab.count > 0 && <span className="bg-gray-200 dark:bg-gray-700 text-xs font-bold px-1.5 py-0.5 rounded-full">{subTab.count}</span>}
          </button>
        ))}
      </div>
      <div className="flex-grow overflow-y-auto pt-6 pr-1">{renderConnectSubTabContent()}</div>
    </div>
  );

  const renderMainTabContent = () => {
    switch (activeMainTab) {
      case 'chat': return <div key="chat-tab" className="flex-1 flex flex-col overflow-hidden h-full">{renderChatTab()}</div>;
      case 'call': return <div key="call-tab" className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8">{renderCallTab()}</div>;
      case 'connect': return <div key="connect-tab" className="flex-1 flex flex-col overflow-hidden px-4 sm:px-6 lg:px-8">{renderConnectSubTabs()}</div>;
      default: return null;
    }
  };

  if (!currentUser) {
    return (
      <div className="h-full flex items-center justify-center p-4 bg-background dark:bg-background-dark">
        <Card className="p-8 text-center max-w-md">
          <Users2Icon className="w-16 h-16 mx-auto text-muted dark:text-muted-dark mb-4" />
          <h3 className="text-lg font-medium text-text dark:text-text-dark mb-2">Please Sign In</h3>
          <p className="text-muted dark:text-muted-dark">Sign in to connect, chat, and call other users.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background dark:bg-background-dark">
      <div className="px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 flex-shrink-0">
        <h1 className="text-2xl font-bold text-text dark:text-text-dark mb-6">Connect & Network</h1>
        <div className="flex border-b border-border dark:border-border-dark overflow-x-auto scrollbar-hide">
          {mainTabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveMainTab(tab.id)} className={`flex-shrink-0 flex items-center space-x-2 px-4 sm:px-6 py-4 text-base font-medium transition-colors ${activeMainTab === tab.id ? 'border-b-2 border-primary text-primary bg-primary/5' : 'text-muted dark:text-muted-dark hover:text-text dark:hover:text-text-dark border-b-2 border-transparent hover:bg-gray-50/50 dark:hover:bg-gray-800/50'}`}>
              <tab.icon className="w-5 h-5" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="flex-grow overflow-hidden flex flex-col">
        {renderMainTabContent()}
      </div>
    </div>
  );
};