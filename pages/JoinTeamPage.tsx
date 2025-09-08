// pages/JoinTeamPage.tsx

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { teamService } from '../teamService';
import { Card, Button } from '../components';
import { TeamInviteWithTeamDetails } from '../types';
import { TEAM_ICON_OPTIONS } from '../constants';
import { supabase } from '../supabaseClient';

// --- SPINNER COMPONENT DEFINED LOCALLY ---
interface LocalSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}
const LocalSpinner: React.FC<LocalSpinnerProps> = ({ size = 'md', className = '' }) => {
  const sizeClasses = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12' };
  return (
    <svg
      className={`animate-spin ${sizeClasses[size]} text-primary dark:text-primary-light ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-label="Loading..."
      role="status"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  );
};
// --- END OF LOCAL SPINNER DEFINITION ---

const getDeterministicColor = (id: string | number): string => {
  const teamIconColors = [
    "bg-red-500", "bg-blue-500", "bg-green-500", "bg-yellow-500",
    "bg-purple-500", "bg-pink-500", "bg-indigo-500", "bg-teal-500",
  ];
  let hash = 0;
  const strId = String(id);
  for (let i = 0; i < strId.length; i++) {
    hash = strId.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  const index = Math.abs(hash) % teamIconColors.length;
  return teamIconColors[index];
};

const JoinTeamPage: React.FC = () => {
    const { inviteCode } = useParams<{ inviteCode: string }>();
    const navigate = useNavigate();

    const [inviteDetails, setInviteDetails] = useState<TeamInviteWithTeamDetails | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isJoining, setIsJoining] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [authLoading, setAuthLoading] = useState(true);

    // Check authentication status
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                setIsAuthenticated(!!session?.user);
            } catch (error) {
                console.error('Error checking auth status:', error);
                setIsAuthenticated(false);
            } finally {
                setAuthLoading(false);
            }
        };

        checkAuth();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setIsAuthenticated(!!session?.user);
            setAuthLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    // Fetch invite details
    useEffect(() => {
        if (!inviteCode) {
            setError("No invite code provided.");
            setIsLoading(false);
            return;
        }

        const fetchInvite = async () => {
            try {
                const details = await teamService.getInviteDetailsByCode(inviteCode);
                setInviteDetails(details);
            } catch (err: any) {
                setError(err.message || "Failed to load invitation details. It may be invalid or expired.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchInvite();
    }, [inviteCode]);

    // Handle saving invite code for logged-out users
    useEffect(() => {
        if (!authLoading && !isAuthenticated && inviteCode) {
            // Save the invite code for after authentication
            try {
                localStorage.setItem('pendingInviteCode', inviteCode);
            } catch (error) {
                console.warn('Failed to save pending invite code:', error);
            }
        }
    }, [authLoading, isAuthenticated, inviteCode]);

    const handleAcceptInvite = async () => {
        if (!inviteCode) return;
        setIsJoining(true);
        setError(null);
        try {
            const joinedTeam = await teamService.acceptTeamInvite(inviteCode);
            navigate('/app/collaboration', { 
                state: { 
                    teamId: joinedTeam.id,
                    openTeamDetail: true,
                },
                replace: true
            });
        } catch (err: any) {
            setError(err.message || "An unexpected error occurred while trying to join the team.");
            setIsJoining(false);
        }
    };

    const handleSignUpToAccept = () => {
        navigate('/signup');
    };

    const handleLogInToAccept = () => {
        navigate('/signin');
    };

    if (authLoading || isLoading) {
        return (
            <div className="flex justify-center items-center h-screen bg-gray-50 dark:bg-background-dark">
                <LocalSpinner size="lg" />
            </div>
        );
    }
    
    const Icon = inviteDetails ? (TEAM_ICON_OPTIONS[inviteDetails.teamIconSeed] || TEAM_ICON_OPTIONS.Users) : null;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-background-dark flex flex-col justify-center items-center p-4">
            <Card className="w-full max-w-md p-6 sm:p-8 shadow-2xl">
                {error && !inviteDetails && (
                    <div className="text-center">
                        <h2 className="text-xl font-bold text-red-600 dark:text-red-400">Invitation Error</h2>
                        <p className="mt-2 text-muted dark:text-muted-dark">{error}</p>
                        <Button 
                            onClick={() => navigate(isAuthenticated ? '/app' : '/')} 
                            className="mt-6"
                        >
                            {isAuthenticated ? 'Go to Dashboard' : 'Go to Home'}
                        </Button>
                    </div>
                )}

                {inviteDetails && (
                    <div className="text-center">
                        <div className="flex justify-center mb-4">
                            {inviteDetails.teamPhotoUrl ? (
                                <img 
                                    src={inviteDetails.teamPhotoUrl} 
                                    alt={inviteDetails.teamName} 
                                    className="w-24 h-24 rounded-2xl object-cover shadow-lg" 
                                />
                            ) : (
                                Icon && (
                                <div className={`w-24 h-24 rounded-2xl flex items-center justify-center ${getDeterministicColor(inviteDetails.teamId)} shadow-lg`}>
                                    <Icon className="w-12 h-12 text-white" />
                                </div>
                                )
                            )}
                        </div>

                        <h1 className="text-2xl font-bold text-text dark:text-text-dark">
                            Join {inviteDetails.teamName}
                        </h1>
                        <p className="text-muted dark:text-muted-dark mt-1">
                            You've been invited to join this team.
                        </p>
                        
                        {inviteDetails.teamDescription && (
                            <p className="mt-4 text-sm bg-gray-100 dark:bg-surface-dark p-3 rounded-md">
                                {inviteDetails.teamDescription}
                            </p>
                        )}

                        <div className="mt-4 text-sm text-muted dark:text-muted-dark">
                            <p>{inviteDetails.teamMemberCount} member{inviteDetails.teamMemberCount !== 1 ? 's' : ''}</p>
                        </div>
                        
                        {/* CONDITIONAL RENDERING BASED ON AUTH STATUS */}
                        {!isAuthenticated ? (
                            // LOGGED OUT STATE - Show signup/signin buttons
                            <div className="mt-6 space-y-3">
                                <Button 
                                    onClick={handleSignUpToAccept} 
                                    size="lg" 
                                    className="w-full"
                                >
                                    Sign Up to Accept
                                </Button>
                                <Button 
                                    onClick={handleLogInToAccept} 
                                    variant="outline" 
                                    size="lg" 
                                    className="w-full"
                                >
                                    Log In to Accept
                                </Button>
                            </div>
                        ) : (
                            // LOGGED IN STATE - Show accept button
                            <div className="mt-6">
                                <Button 
                                    onClick={handleAcceptInvite} 
                                    disabled={isJoining} 
                                    size="lg" 
                                    className="w-full"
                                >
                                    {isJoining ? (
                                        <div className="flex items-center justify-center">
                                            <LocalSpinner size="sm" className="mr-2" />
                                            Joining...
                                        </div>
                                    ) : (
                                        'Accept Invitation & Join Team'
                                    )}
                                </Button>
                            </div>
                        )}

                        {error && (
                            <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>
                        )}
                    </div>
                )}
            </Card>
        </div>
    );
};

export default JoinTeamPage;