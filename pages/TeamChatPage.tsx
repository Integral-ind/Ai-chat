import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Channel,
  ChannelHeader,
  MessageInput,
  MessageList,
  Thread,
  useChatContext,
  Window,
} from 'stream-chat-react';
import { TeamType as AppTeamType, User as FrontendUser } from '../types';
import { Button } from '../components';
import { ArrowLeftIcon, UsersIcon, VideoCameraIcon, PhoneIcon } from '../constants';
import { supabase } from '../supabaseClient';
import { useStreamVideo } from '../components/StreamVideoProvider';

// Custom Team Chat Header Component with Video Call functionality
const TeamChatHeader: React.FC<{ 
  team: AppTeamType; 
  onVideoCall: () => void; 
  onBack: () => void;
}> = ({ team, onVideoCall, onBack }) => (
  <div className="p-4 border-b border-border dark:border-border-dark flex items-center justify-between bg-card dark:bg-card-dark">
    <div className="flex items-center space-x-3">
      <Button onClick={onBack} variant="ghost" leftIcon={<ArrowLeftIcon />} className="text-sm">
        Back
      </Button>
      <div className="flex items-center space-x-2">
        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
          <UsersIcon className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-text dark:text-text-dark">{team.name}</h3>
          <p className="text-xs text-muted dark:text-muted-dark">{team.members.length} members</p>
        </div>
      </div>
    </div>
    <div className="flex items-center space-x-2">
      <button
        onClick={onVideoCall}
        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        title="Start Team Video Meeting"
      >
        <VideoCameraIcon className="w-5 h-5 text-text dark:text-text-dark" />
      </button>
      <button
        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        title="Start Team Voice Call"
      >
        <PhoneIcon className="w-5 h-5 text-text dark:text-text-dark" />
      </button>
    </div>
  </div>
);

// This is the main component for the team chat page
export const TeamChatPage: React.FC<{
  team: AppTeamType;
  currentUser: FrontendUser;
  onBack: (teamId: string) => void;
}> = ({ team, currentUser, onBack }) => {
  const navigate = useNavigate();
  const { client } = useChatContext();
  const { createCall, isConnected } = useStreamVideo();
  const [channel, setChannel] = useState<any>(null);

  // Handle team video call with duplicate prevention
  const handleTeamVideoCall = () => {
    if (!isConnected) {
      alert('Video service is not connected. Please try again.');
      return;
    }
    
    // Use a consistent team call ID that doesn't change with each click
    // This prevents creating multiple calls for the same team
    const teamIdShort = team.id.substring(0, 12); // First 12 chars of team ID
    const dailyDate = new Date().toISOString().split('T')[0].replace(/-/g, ''); // YYYYMMDD format
    const teamCallId = `team-${teamIdShort}-${dailyDate}`;
    
    // Ensure it's under 64 characters
    const finalCallId = teamCallId.length > 64 ? teamCallId.substring(0, 64) : teamCallId;

    navigate(`/app/call/${finalCallId}`);
  };

  useEffect(() => {
    if (!client) return;
    
    const setupChannel = async () => {
        try {
            // First, ensure all team members exist as users in Stream Chat via backend
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                console.error('No active session for creating team channel');
                return;
            }

            // Create users via backend edge function
            const userPromises = team.members.map(async (member) => {
                try {
                    const result = await supabase.functions.invoke('create-stream-user', {
                        body: { 
                            userId: member.id, 
                            name: member.full_name || member.email || `User ${member.id}`,
                            email: member.email, 
                            avatar: member.avatar_url 
                        },
                        headers: { Authorization: `Bearer ${session.access_token}` },
                    });
                    if (result.error) {
                        console.warn(`Failed to create user ${member.id}:`, result.error);
                    }
                    return result;
                } catch (userError) {
                    console.warn(`Failed to create user ${member.id}:`, userError);
                    return null;
                }
            });

            // Wait for all users to be created
            await Promise.all(userPromises);

            // Small delay to ensure users are created in Stream
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Now create the channel with existing users
            const teamChannel = client.channel('team', team.id, {
                name: team.name,
                image: team.photoUrl || undefined,
                members: team.members.map(m => m.id),
                created_by_id: currentUser.id,
            });

            await teamChannel.watch();
            setChannel(teamChannel);
        } catch (error) {
            console.error('Error setting up team channel:', error);
        }
    };
    
    setupChannel();

    return () => {
        setChannel(null);
    };
  }, [client, team, currentUser]);

  if (!channel) {
    return (
        <div className="flex flex-col h-full bg-background dark:bg-black text-text dark:text-text-dark">
             <TeamChatHeader 
               team={team} 
               onVideoCall={handleTeamVideoCall}
               onBack={() => onBack(team.id)}
             />
            <div className="flex-1 flex items-center justify-center">
                 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                 <p className="ml-3 text-muted dark:text-muted-dark">Loading team chat...</p>
            </div>
        </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background dark:bg-black text-text dark:text-text-dark">
      <Channel channel={channel}>
        <Window>
          <TeamChatHeader 
            team={team} 
            onVideoCall={handleTeamVideoCall}
            onBack={() => onBack(team.id)}
          />
          <MessageList />
          <MessageInput />
        </Window>
        <Thread />
      </Channel>
    </div>
  );
};