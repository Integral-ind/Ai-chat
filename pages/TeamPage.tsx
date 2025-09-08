import React, { useState, useEffect, useCallback, useMemo, useRef, FormEvent, lazy, Suspense } from 'react';
import { Card, Button, Modal, ProgressBar, TeamStatCard, Checkbox } from '../components';
import { TeamType as AppTeamType, UserRole, DepartmentType, UserPublicProfile, User as FrontendUser, Project as ProjectType, UserSearchResult, TeamMember, StatCardData, TeamPermission, TeamUpdate, TeamIconName } from '../types';
import { teamService } from '../teamService';
import { connectService } from '../connectService';
import { projectService } from '../projectService';
import { resourceService } from '../resourceService';
import { useNavigate } from 'react-router-dom';
import { useTeamRealtime, useUserTeamsRealtime, useOptimisticProjectLink } from '../hooks/useRealtime';
import {
    PlusIcon, UsersIcon as TeamMembersIcon, FolderOpenIcon,
    CheckCircle2Icon as TasksIcon, Building2Icon,
    VideoCameraIcon as VideoIcon, MessageCircleIcon, ShareIcon as Share2Icon,
    Trash2Icon, UserPlusIcon as AddUserIcon, XMarkIcon, ArrowLeftIcon, EllipsisHorizontalIcon,
    TEAM_ICON_OPTIONS, BriefcaseIcon, ShieldCheckIcon, UserCircleIcon as DefaultAvatarIcon, CogIcon,
    TAG_COLORS as GLOBAL_TAG_COLORS, SendIcon, ChatBubbleLeftIcon,
    TrashIcon, BellIcon, EyeIcon,
    ExclamationTriangleIcon, CheckCircleIcon, ChevronRightIcon, ArrowUturnRightIcon
} from '../constants';
import { TEAM_PERMISSIONS } from '../constants';


const teamIconColors = [
    "bg-red-500", "bg-blue-500", "bg-green-500", "bg-yellow-500",
    "bg-purple-500", "bg-pink-500", "bg-indigo-500", "bg-teal-500",
];

// Memoize color calculations to avoid repeated computation
const colorCache = new Map<string, string>();
const getDeterministicColor = (id: string | number): string => {
  const key = String(id);
  if (colorCache.has(key)) {
    return colorCache.get(key)!;
  }
  
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; // Ensure 32-bit integer
  }
  const index = Math.abs(hash) % teamIconColors.length;
  const color = teamIconColors[index];
  
  colorCache.set(key, color);
  return color;
};

const hasPermission = (member: TeamMember | undefined, permission: TeamPermission): boolean => {
  if (!member) return false;
  if (member.role === UserRole.OWNER) return true; // Owner has all permissions implicitly
  return member.permissions?.includes(permission) ?? false;
};

const getDefaultPermissionsForRole = (role: UserRole): TeamPermission[] => {
  switch (role) {
    case UserRole.OWNER:
      return Object.keys(TEAM_PERMISSIONS) as TeamPermission[];
    case UserRole.ADMIN:
      return (Object.keys(TEAM_PERMISSIONS) as TeamPermission[]).filter(p => p !== 'CAN_DELETE_TEAM');
    case UserRole.MEMBER:
      return ['CAN_MANAGE_PROJECTS'];
    default:
      return [];
  }
};


interface CreateTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, description?: string, iconSeed?: TeamIconName, photoFile?: File) => Promise<void>;
}
const CreateTeamModal: React.FC<CreateTeamModalProps> = ({ isOpen, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIcon, setSelectedIcon] = useState<TeamIconName>('Users');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    if (photoFile) {
        objectUrl = URL.createObjectURL(photoFile);
        setPhotoPreview(objectUrl);
    }

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [photoFile]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPhotoFile(e.target.files[0]);
    } else {
      setPhotoFile(null);
      setPhotoPreview(null);
    }
  };

  const resetAndClose = useCallback(() => {
    setName(''); 
    setDescription(''); 
    setSelectedIcon('Users'); 
    setPhotoFile(null); 
    setPhotoPreview(null);
    onClose();
  }, [onClose]);

  const handleSubmit = async () => {
    if (!name.trim()) { alert("Team name is required."); return; }
    setIsSaving(true);
    try {
        await onSave(name, description, selectedIcon, photoFile || undefined);
        resetAndClose();
    } catch(e) {
        // Error is handled by parent, so we only stop the loading indicator
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={resetAndClose} title="Create New Team" onSave={handleSubmit} saveLabel="Create Team" isSaving={isSaving}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-muted dark:text-muted-dark">Team Photo (Optional)</label>
          <div className="mt-1 flex items-center space-x-4">
            {photoPreview ? (
              <img src={photoPreview} alt="Team preview" className="w-16 h-16 rounded-lg object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <TeamMembersIcon className="w-8 h-8 text-gray-400" />
              </div>
            )}
            <input type="file" id="teamPhoto" onChange={handlePhotoChange} className="input-style text-sm" accept="image/*" />
          </div>
        </div>
        <div>
          <label htmlFor="teamName" className="block text-sm font-medium text-muted dark:text-muted-dark">Team Name</label>
          <input type="text" id="teamName" value={name} onChange={e => setName(e.target.value)} className="input-style" required />
        </div>
        <div>
          <label htmlFor="teamDescription" className="block text-sm font-medium text-muted dark:text-muted-dark">Description (Optional)</label>
          <textarea id="teamDescription" value={description} onChange={e => setDescription(e.target.value)} rows={3} className="input-style" />
        </div>
        <div>
          <label className="block text-sm font-medium text-muted dark:text-muted-dark mb-1">Team Icon (Fallback)</label>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {Object.keys(TEAM_ICON_OPTIONS).map(iconKey => {
              const IconComponent = TEAM_ICON_OPTIONS[iconKey as TeamIconName];
              return (
                <button
                  key={iconKey}
                  type="button"
                  onClick={() => setSelectedIcon(iconKey as TeamIconName)}
                  className={`p-3 rounded-lg border-2 transition-colors ${selectedIcon === iconKey ? 'border-primary dark:border-primary-light ring-2 ring-primary dark:ring-primary-light' : 'border-border dark:border-border-dark hover:border-gray-400 dark:hover:border-gray-500'}`}
                  aria-label={`Select ${iconKey} icon`}
                >
                  <IconComponent className="w-6 h-6 mx-auto text-text dark:text-text-dark" />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
};

interface CreateDepartmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, description?: string) => Promise<void>;
  teamName: string;
}
const CreateDepartmentModal: React.FC<CreateDepartmentModalProps> = ({ isOpen, onClose, onSave, teamName }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) { alert("Department name is required."); return; }
    setIsSaving(true);
    try {
        await onSave(name, description);
        if (isOpen) {
          setName(''); setDescription('');
        }
    } catch (e) { /* Parent handles */ }
    finally { setIsSaving(false); }
  };

  useEffect(() => {
    if (isOpen) {
      setName('');
      setDescription('');
    }
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`New Department in ${teamName}`} onSave={handleSubmit} saveLabel="Create Department" isSaving={isSaving}>
      <div className="space-y-4">
        <div>
          <label htmlFor="deptName" className="block text-sm font-medium text-muted dark:text-muted-dark">Department Name</label>
          <input type="text" id="deptName" value={name} onChange={e => setName(e.target.value)} className="input-style" required />
        </div>
        <div>
          <label htmlFor="deptDescription" className="block text-sm font-medium text-muted dark:text-muted-dark">Description (Optional)</label>
          <textarea id="deptDescription" value={description} onChange={e => setDescription(e.target.value)} rows={3} className="input-style" />
        </div>
      </div>
    </Modal>
  );
};


interface ManageDepartmentMembersModalProps {
    isOpen: boolean;
    onClose: () => void;
    department: DepartmentType;
    teamMembers: TeamMember[];
    onAddMemberToDept: (departmentId: string, userId: string) => Promise<void>;
    onRemoveMemberFromDept: (departmentId: string, userId: string) => Promise<void>;
}
const ManageDepartmentMembersModal: React.FC<ManageDepartmentMembersModalProps> = React.memo(({ isOpen, onClose, department, teamMembers, onAddMemberToDept, onRemoveMemberFromDept }) => {
    const [isLoadingOp, setIsLoadingOp] = useState<Record<string,boolean>>({});

    const departmentMemberIds = useMemo(() => new Set(department.members.map(m => m.id)), [department.members]);

    const handleOperation = async (userId: string, operation: 'add' | 'remove') => {
        setIsLoadingOp(prev => ({...prev, [userId]: true}));
        try {
            if (operation === 'add') {
                await onAddMemberToDept(department.id, userId);
            } else {
                await onRemoveMemberFromDept(department.id, userId);
            }
        } catch (e) { /* Parent handles alert */ }
        finally { setIsLoadingOp(prev => ({...prev, [userId]: false})); }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Manage Members for ${department.name}`} showSaveButton={false}>
            <div className="max-h-96 overflow-y-auto space-y-2">
                {teamMembers.map(member => {
                    const isInDept = departmentMemberIds.has(member.id);
                    return (
                        <div key={member.id} className="flex items-center justify-between p-3 bg-surface dark:bg-surface-dark rounded-lg">
                            <div className="flex items-center space-x-3">
                                <img src={member.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.full_name || 'U')}`} alt={member.full_name || 'Member'} className="w-8 h-8 rounded-full object-cover" />
                                <div>
                                    <p className="text-sm font-medium text-text dark:text-text-dark">{member.full_name}</p>
                                    <p className="text-xs text-muted dark:text-muted-dark">{member.email}</p>
                                </div>
                            </div>
                            <Button
                                size="sm"
                                variant={isInDept ? "danger" : "outline"}
                                onClick={() => handleOperation(member.id, isInDept ? 'remove' : 'add')}
                                loading={isLoadingOp[member.id]}
                            >
                                {isInDept ? "Remove" : "Add"}
                            </Button>
                        </div>
                    );
                })}
                 {teamMembers.length === 0 && <p className="text-sm text-muted dark:text-muted-dark text-center p-4">No members in the parent team to add.</p>}
            </div>
        </Modal>
    );
});

interface LinkProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    teamId: string;
    teamName: string;
    onLinkProject: (projectId: string, teamId: string) => Promise<ProjectType | null>;
    onUnlinkProject: (projectId: string) => Promise<ProjectType | null>;
    onProjectsUpdated: () => void;
}
const LinkProjectModal: React.FC<LinkProjectModalProps> = ({ isOpen, onClose, teamId, teamName, onLinkProject, onUnlinkProject, onProjectsUpdated }) => {
    const [linkedProjects, setLinkedProjects] = useState<ProjectType[]>([]);
    const [availableProjects, setAvailableProjects] = useState<ProjectType[]>([]);
    const [isLoadingModalData, setIsLoadingModalData] = useState(false);
    
    // 🚀 OPTIMISTIC UPDATE STATES
    const [linkingProjects, setLinkingProjects] = useState<Set<string>>(new Set());
    const [unlinkingProjects, setUnlinkingProjects] = useState<Set<string>>(new Set());

    const fetchData = useCallback(async () => {
        setIsLoadingModalData(true);
        try {
            const [linked, available] = await Promise.all([
                projectService.getProjectsForTeam(teamId),
                projectService.getProjectsAvailableForLinking(teamId)
            ]);
            setLinkedProjects(linked);
            setAvailableProjects(available);
        } catch (error) {
            console.error("Error fetching projects for linking:", error);
            alert("Failed to load project data.");
        } finally {
            setIsLoadingModalData(false);
        }
    }, [teamId]);

    // 🚀 REALTIME SUBSCRIPTION - only when modal is open (after fetchData is defined)
    const { isConnected: isRealtimeConnected } = useTeamRealtime(
        teamId, 
        fetchData, // Refresh data when realtime updates occur
        isOpen // Only subscribe when modal is open
    );

    useEffect(() => { if (isOpen) { fetchData(); } }, [isOpen, fetchData]);

    // 🚀 OPTIMISTIC UPDATE HANDLERS
    const handleOptimisticLink = async (projectId: string) => {
        // 1. IMMEDIATELY show linking state
        setLinkingProjects(prev => new Set(prev).add(projectId));
        
        // 2. IMMEDIATELY move project from available to linked (optimistic)
        const projectToMove = availableProjects.find(p => p.id === projectId);
        if (projectToMove) {
            setAvailableProjects(prev => prev.filter(p => p.id !== projectId));
            setLinkedProjects(prev => [...prev, { ...projectToMove, teamId }]);
        }

        try {
            // 3. Make actual API call
            await onLinkProject(projectId, teamId);
            onProjectsUpdated();
        } catch (error: any) {
            // 4. REVERT optimistic update on error
            if (projectToMove) {
                setLinkedProjects(prev => prev.filter(p => p.id !== projectId));
                setAvailableProjects(prev => [...prev, projectToMove]);
            }
            alert(`Failed to link project: ${error.message}`);
        } finally {
            setLinkingProjects(prev => {
                const newSet = new Set(prev);
                newSet.delete(projectId);
                return newSet;
            });
        }
    };

    const handleOptimisticUnlink = async (projectId: string) => {
        // 1. IMMEDIATELY show unlinking state
        setUnlinkingProjects(prev => new Set(prev).add(projectId));
        
        // 2. IMMEDIATELY move project from linked to available (optimistic)
        const projectToMove = linkedProjects.find(p => p.id === projectId);
        if (projectToMove) {
            setLinkedProjects(prev => prev.filter(p => p.id !== projectId));
            setAvailableProjects(prev => [...prev, { ...projectToMove, teamId: undefined }]);
        }

        try {
            // 3. Make actual API call
            await onUnlinkProject(projectId);
            onProjectsUpdated();
        } catch (error: any) {
            // 4. REVERT optimistic update on error
            if (projectToMove) {
                setAvailableProjects(prev => prev.filter(p => p.id !== projectId));
                setLinkedProjects(prev => [...prev, projectToMove]);
            }
            alert(`Failed to unlink project: ${error.message}`);
        } finally {
            setUnlinkingProjects(prev => {
                const newSet = new Set(prev);
                newSet.delete(projectId);
                return newSet;
            });
        }
    };

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title={
                <div className="flex items-center space-x-2">
                    <span>Manage Projects for {teamName}</span>
                    <div className={`w-2 h-2 rounded-full ${isRealtimeConnected ? 'bg-green-500' : 'bg-gray-400'}`} title={isRealtimeConnected ? 'Connected to realtime updates' : 'Offline'} />
                </div>
            } 
            showSaveButton={false} 
            size="lg"
        >
            {isLoadingModalData && <div className="p-4 text-center">Loading projects...</div>}
            {!isLoadingModalData && (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <section>
                        <h4 className="text-md font-semibold mb-2 text-text dark:text-text-dark">Linked Projects ({linkedProjects.length})</h4>
                        <div className="max-h-80 overflow-y-auto space-y-2 border dark:border-border-dark rounded-md p-2">
                            {linkedProjects.length === 0 && <p className="text-xs text-muted dark:text-muted-dark p-2 text-center">No projects currently linked.</p>}
                            {linkedProjects.map(proj => (
                                <div key={proj.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-surface-dark rounded">
                                    <span className="text-sm text-text dark:text-text-dark truncate pr-2" title={proj.name}>{proj.name}</span>
                                    <Button 
                                        size="sm" 
                                        variant="danger" 
                                        onClick={() => handleOptimisticUnlink(proj.id)}
                                        disabled={unlinkingProjects.has(proj.id) || linkingProjects.has(proj.id)}
                                    >
                                        {unlinkingProjects.has(proj.id) ? 'Unlinking...' : 'Unlink'}
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </section>
                    <section>
                        <h4 className="text-md font-semibold mb-2 text-text dark:text-text-dark">Available Projects ({availableProjects.length})</h4>
                         <div className="max-h-80 overflow-y-auto space-y-2 border dark:border-border-dark rounded-md p-2">
                            {availableProjects.length === 0 && <p className="text-xs text-muted dark:text-muted-dark p-2 text-center">No other projects available to link.</p>}
                            {availableProjects.map(proj => (
                                <div key={proj.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-surface-dark rounded">
                                    <span className="text-sm text-text dark:text-text-dark truncate pr-2" title={proj.name}>{proj.name}</span>
                                    <Button 
                                        size="sm" 
                                        variant="outline" 
                                        onClick={() => handleOptimisticLink(proj.id)}
                                        disabled={linkingProjects.has(proj.id) || unlinkingProjects.has(proj.id)}
                                    >
                                        {linkingProjects.has(proj.id) ? 'Linking...' : 'Link'}
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </section>
                 </div>
            )}
        </Modal>
    );
};

interface TeamCardProps {
  team: AppTeamType;
  onSelectTeam: (teamId: string) => void;
}
const TeamCard: React.FC<TeamCardProps> = React.memo(({ team, onSelectTeam }) => {
  const TeamDisplayIcon = TEAM_ICON_OPTIONS[team.iconSeed] || TEAM_ICON_OPTIONS.Users;
  
  return (
    <Card onClick={() => onSelectTeam(team.id)} className="p-4 cursor-pointer hover:shadow-xl transition-shadow duration-150 ease-in-out h-full flex flex-col">
      <div className="flex items-center space-x-3 mb-3">
        {team.photoUrl ? (
          <img src={team.photoUrl} alt={team.name} className="w-10 h-10 rounded-lg object-cover" />
        ) : (
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getDeterministicColor(team.id)}`}>
            <TeamDisplayIcon className="w-6 h-6 text-white" />
          </div>
        )}
        <h3 className="text-lg font-semibold text-text dark:text-text-dark truncate" title={team.name}>{team.name}</h3>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs mt-auto pt-3 border-t border-border dark:border-border-dark/50">
        <div className="text-muted dark:text-muted-dark">Members: <span className="font-semibold text-text dark:text-text-dark">{team.membersCount}</span></div>
        <div className="text-muted dark:text-muted-dark">Projects: <span className="font-semibold text-text dark:text-text-dark">{team.projectsCount}</span></div>
        <div className="text-muted dark:text-muted-dark">Tasks: <span className="font-semibold text-text dark:text-text-dark">{team.tasksCount}</span></div>
      </div>
    </Card>
  );
});


interface AddMemberFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddMember: (userId: string, role: UserRole, tags: string[]) => Promise<void>;
  teamId: string;
  teamName: string;
  currentMembers: TeamMember[];
}
const AddMemberFormModal: React.FC<AddMemberFormModalProps> = ({ isOpen, onClose, onAddMember, teamId, teamName, currentMembers }) => {
  const [emailTerm, setEmailTerm] = useState('');
  const [foundUser, setFoundUser] = useState<UserSearchResult | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.MEMBER);
  const [tagsInput, setTagsInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleSearchUser = async () => {
    if (!emailTerm.trim()) { setSearchError("Please enter an email to search."); return; }
    setIsSearching(true); setSearchError(null); setFoundUser(null);
    try {
      const results = await connectService.searchUsersLegacy(emailTerm);
      const alreadyMember = currentMembers.some(m => m.email === emailTerm || m.id === results[0]?.id);
      if (results.length > 0 && !alreadyMember) {
        setFoundUser(results[0]);
      } else if (alreadyMember) {
        setSearchError("This user is already a member of the team.");
      } else {
        setSearchError("User not found.");
      }
    } catch (e: any) { setSearchError(e.message || "Error searching user."); }
    finally { setIsSearching(false); }
  };

  const handleConfirmAdd = async () => {
    if (!foundUser) { alert("No user selected to add."); return; }
    setIsAdding(true);
    const tagsArray = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
    try {
      await onAddMember(foundUser.id, selectedRole, tagsArray);
    } catch (e) { /* Parent handles error */ }
    finally { setIsAdding(false); }
  };

  useEffect(() => {
    if (isOpen) {
        setEmailTerm(''); setFoundUser(null); setSelectedRole(UserRole.MEMBER);
        setTagsInput(''); setIsSearching(false); setIsAdding(false); setSearchError(null);
    }
  }, [isOpen, teamId]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Add Member to ${teamName}`} onSave={handleConfirmAdd} saveLabel="Add Member" isSaving={isAdding} saveDisabled={!foundUser || isAdding}>
      <div className="space-y-4">
        <div className="flex space-x-2">
          <input type="email" value={emailTerm} onChange={e => setEmailTerm(e.target.value)} placeholder="Search by user email" className="input-style flex-grow" />
          <Button onClick={handleSearchUser} loading={isSearching} disabled={isSearching}>Search</Button>
        </div>
        {searchError && <p className="text-xs text-red-500">{searchError}</p>}
        {foundUser && (
          <Card className="p-3 bg-surface dark:bg-surface-dark">
            <div className="flex items-center space-x-3">
              <img src={foundUser.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(foundUser.full_name || 'U')}`} alt="User" className="w-10 h-10 rounded-full" />
              <div>
                <p className="text-sm font-medium">{foundUser.full_name}</p>
                <p className="text-xs text-muted dark:text-muted-dark">{foundUser.email}</p>
              </div>
            </div>
          </Card>
        )}
        {foundUser && (
          <>
            <div>
              <label htmlFor="memberRole" className="block text-sm font-medium text-muted dark:text-muted-dark">Role</label>
              <select id="memberRole" value={selectedRole} onChange={e => setSelectedRole(e.target.value as UserRole)} className="input-style">
                <option value={UserRole.MEMBER}>Member</option>
                <option value={UserRole.ADMIN}>Admin</option>
              </select>
            </div>
            <div>
              <label htmlFor="memberTags" className="block text-sm font-medium text-muted dark:text-muted-dark">Tags (comma-separated)</label>
              <input type="text" id="memberTags" value={tagsInput} onChange={e => setTagsInput(e.target.value)} className="input-style" placeholder="e.g., Frontend, Backend" />
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

interface EditMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: TeamMember | null;
  teamId: string;
  currentUserMember: TeamMember | undefined;
  onUpdateMember: (memberId: string, updates: { role?: UserRole, tags?: string[], permissions?: TeamPermission[] }) => Promise<void>;
  onRemoveMember: (memberId: string) => Promise<void>;
}
const EditMemberModal: React.FC<EditMemberModalProps> = ({ isOpen, onClose, member, teamId, currentUserMember, onUpdateMember, onRemoveMember }) => {
  const [role, setRole] = useState<UserRole>(UserRole.MEMBER);
  const [tags, setTags] = useState('');
  const [permissions, setPermissions] = useState<TeamPermission[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const isEditingOwner = member?.role === UserRole.OWNER;

  const canManageThisMemberRole = useMemo(() => {
    if (!currentUserMember || !member || isEditingOwner) return false;
    if (currentUserMember.role === UserRole.OWNER) return true;
    if (hasPermission(currentUserMember, 'CAN_MANAGE_ROLES')) {
      return member.role === UserRole.MEMBER || member.role === UserRole.ADMIN;
    }
    return false;
  }, [currentUserMember, member, isEditingOwner]);

  const canManageThisMemberPermissions = useMemo(() => {
      if (!currentUserMember || !member || isEditingOwner) return false;
      if (currentUserMember.role === UserRole.OWNER) return true;
      if (hasPermission(currentUserMember, 'CAN_MANAGE_ROLES')) {
        return true;
      }
      return false;
  }, [currentUserMember, member, isEditingOwner]);

  const canCurrentUserRemoveThisMember = useMemo(() => {
    if (!currentUserMember || !member || isEditingOwner) return false;
    if (member.id === currentUserMember.id) return false;
    if (currentUserMember.role === UserRole.OWNER) return true;
    if (hasPermission(currentUserMember, 'CAN_REMOVE_MEMBERS')) {
      return member.role === UserRole.MEMBER;
    }
    return false;
  }, [currentUserMember, member, isEditingOwner]);

  useEffect(() => {
    if (member) {
      setRole(member.role);
      setTags(member.tags?.join(', ') || '');
      if (member.role === UserRole.OWNER) {
        setPermissions(getDefaultPermissionsForRole(UserRole.OWNER));
      } else {
        setPermissions(member.permissions || getDefaultPermissionsForRole(member.role));
      }
    }
  }, [member, isOpen]);

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    setPermissions(getDefaultPermissionsForRole(newRole));
  };

  const handleSave = async () => {
    if (!member) return;
    setIsSaving(true);
    const newTags = tags.split(',').map(t => t.trim()).filter(Boolean);
    const updatesToSave: { role?: UserRole, tags?: string[], permissions?: TeamPermission[] } = {
        tags: newTags,
    };
    
    if (canManageThisMemberRole && role !== member.role) {
        updatesToSave.role = role;
    }
    
    if (canManageThisMemberPermissions) {
        updatesToSave.permissions = permissions;
    }

    try {
        await onUpdateMember(member.id, updatesToSave);
        onClose();
    } catch(e) { /* parent handles error reporting */ }
    finally { setIsSaving(false); }
  };

  const handlePermissionChange = (permission: TeamPermission, checked: boolean) => {
    setPermissions(prev =>
      checked ? [...prev, permission] : prev.filter(p => p !== permission)
    );
  };

  if (!member) return null;

  const roleOptions = [UserRole.ADMIN, UserRole.MEMBER]; 

  const getInitials = (name?: string) => (name || '').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={`Edit ${member.full_name}`}
      size="md"
    >
        <div className="flex justify-between items-center mb-6">
            <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                    <span className="text-lg font-bold text-text dark:text-text-dark">{getInitials(member.full_name)}</span>
                </div>
                <div>
                    <h3 className="text-lg font-semibold">{member.full_name}</h3>
                    <p className="text-sm text-muted dark:text-muted-dark">{member.email}</p>
                </div>
            </div>
            <Button variant="ghost" className="p-1 -mr-2" onClick={onClose}><XMarkIcon className="w-5 h-5"/></Button>
        </div>
        
        <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-text dark:text-text-dark mb-1">Role</label>
              <select value={role} onChange={e => handleRoleChange(e.target.value as UserRole)} className="input-style" disabled={isEditingOwner || !canManageThisMemberRole}>
                {isEditingOwner && <option value={UserRole.OWNER}>Owner</option>}
                {roleOptions.map(r => (
                  <option key={r} value={r} >{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                ))}
              </select>
              {isEditingOwner && <p className="text-xs text-muted dark:text-muted-dark mt-1">Owner role cannot be changed here.</p>}
              {!isEditingOwner && !canManageThisMemberRole && <p className="text-xs text-muted dark:text-muted-dark mt-1">You do not have permission to change this member's role.</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-text dark:text-text-dark mb-1">Tags (comma-separated)</label>
              <input type="text" value={tags} onChange={e => setTags(e.target.value)} className="input-style" placeholder="e.g., Frontend, Backend" disabled={isSaving}/>
            </div>

            <div>
              <label className="block text-sm font-medium text-text dark:text-text-dark mb-2">Permissions</label>
              <div className="space-y-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 p-3 border rounded-lg dark:border-border-dark bg-gray-50 dark:bg-surface-dark/30">
                {Object.entries(TEAM_PERMISSIONS).map(([key, label]) => (
                  <Checkbox
                    key={key}
                    id={`perm-${key}`}
                    label={label}
                    checked={permissions.includes(key as TeamPermission)}
                    onChange={(checked) => handlePermissionChange(key as TeamPermission, checked)}
                    disabled={isSaving || isEditingOwner || !canManageThisMemberPermissions || (currentUserMember?.role !== UserRole.OWNER && key === 'CAN_DELETE_TEAM')}
                  />
                ))}
              </div>
            </div>
        </div>

        <div className="mt-8 flex justify-between items-center">
             {canCurrentUserRemoveThisMember ? (
                <Button variant="danger" onClick={() => onRemoveMember(member.id)} loading={isSaving}>Remove Member</Button>
            ) : <div />}
            <div className="flex space-x-2">
                <Button variant="outline" onClick={onClose}>Cancel</Button>
                <Button onClick={handleSave} loading={isSaving} disabled={isSaving || isEditingOwner}>Save Changes</Button>
            </div>
        </div>
    </Modal>
  );
};

interface InviteLinkModalProps {
    isOpen: boolean;
    onClose: () => void;
    team: AppTeamType;
}
  
const InviteLinkModal: React.FC<InviteLinkModalProps> = ({ isOpen, onClose, team }) => {
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [inviteInfo, setInviteInfo] = useState<{ isNew: boolean; expiresAt: string } | null>(null);

  const handleGenerateLink = async () => {
      setIsLoading(true);
      setError(null);
      try {
          const invite = await teamService.createTeamInvite(team.id);
          const baseUrl = window.location.origin;
          const link = `${baseUrl}/#/join-team/${invite.id}`;
          setInviteLink(link);
          
          // Determine if this is a new invite or reused one
          const createdAt = new Date(invite.createdAt);
          const now = new Date();
          const isNew = (now.getTime() - createdAt.getTime()) < 5000; // Created within last 5 seconds
          
          setInviteInfo({
              isNew,
              expiresAt: invite.expiresAt
          });
      } catch(err: any) {
          setError(err.message || "Failed to generate link. You may not have permission to invite members.");
      } finally {
          setIsLoading(false);
      }
  };
  
  const handleCopy = () => {
      if (!inviteLink) return;
      navigator.clipboard.writeText(inviteLink).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
      });
  };
  
  useEffect(() => {
      if (isOpen) {
          setInviteLink(null);
          setError(null);
          setCopied(false);
          setInviteInfo(null);
      }
  }, [isOpen]);

  const formatExpiryDate = (dateString: string) => {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
          weekday: 'short', 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
      });
  };

  return (
      <Modal isOpen={isOpen} onClose={onClose} title={`Invite to ${team.name}`} showSaveButton={false}>
          <div className="space-y-4">
              <p className="text-sm text-muted dark:text-muted-dark">
                  Share this link with people you want to invite to your team.
              </p>
              
              {error && <div className="p-2 text-xs text-red-600 bg-red-100 dark:bg-red-900/30 rounded-md">{error}</div>}

              {inviteLink ? (
                  <div className="space-y-3">
                      {/* Status indicator */}
                      {inviteInfo && (
                          <div className={`p-2 text-xs rounded-md ${
                              inviteInfo.isNew 
                                  ? 'text-green-600 bg-green-100 dark:bg-green-900/30' 
                                  : 'text-blue-600 bg-blue-100 dark:bg-blue-900/30'
                          }`}>
                              {inviteInfo.isNew 
                                  ? '✨ New invitation link created!' 
                                  : '🔄 Using your existing invitation link'
                              }
                              <br />
                              Expires: {formatExpiryDate(inviteInfo.expiresAt)}
                          </div>
                      )}
                      
                      {/* Link input and copy button */}
                      <div className="flex items-center space-x-2">
                          <input 
                              type="text" 
                              value={inviteLink} 
                              readOnly 
                              className="input-style flex-grow text-sm" 
                          />
                          <Button onClick={handleCopy} size="sm">
                              {copied ? '✓ Copied!' : 'Copy'}
                          </Button>
                      </div>
                      
                      {/* Additional info */}
                      <p className="text-xs text-muted dark:text-muted-dark">
                          💡 This link can be used multiple times until it expires.
                      </p>
                  </div>
              ) : (
                  <Button onClick={handleGenerateLink} loading={isLoading} className="w-full">
                      {isLoading ? 'Getting Invite Link...' : 'Get Invite Link'}
                  </Button>
              )}
          </div>
      </Modal>
  );
};

interface TeamActivityFeedProps {
    team: AppTeamType;
    currentUser: FrontendUser;
}
  
const TeamActivityFeed: React.FC<TeamActivityFeedProps> = ({ team, currentUser }) => {
    const [updates, setUpdates] = useState<TeamUpdate[]>([]);
    const [newUpdate, setNewUpdate] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
  
    useEffect(() => {
        teamService.getTeamUpdates(team.id)
            .then(setUpdates)
            .finally(() => setIsLoading(false));
    }, [team.id]);
  
    const handlePostUpdate = async (e: FormEvent) => {
        e.preventDefault();
        if (!newUpdate.trim()) return;
        setIsSubmitting(true);
        try {
            const createdUpdate = await teamService.addTeamUpdate(team.id, newUpdate);
            setUpdates(prev => [createdUpdate, ...prev]);
            setNewUpdate('');
        } catch (error) {
            alert("Failed to post team update.");
        } finally {
            setIsSubmitting(false);
        }
    };
    
    return (
        <div className="space-y-4">
            <form onSubmit={handlePostUpdate} className="space-y-2">
                <textarea value={newUpdate} onChange={e => setNewUpdate(e.target.value)} placeholder="Share an update with the team..." className="input-style" rows={3}/>
                <div className="flex justify-end">
                    <Button type="submit" loading={isSubmitting} size="sm" disabled={!newUpdate.trim()}>Post Update</Button>
                </div>
            </form>
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2 scrollbar-thin">
                {isLoading && <p className="text-center text-muted dark:text-muted-dark">Loading updates...</p>}
                {updates.length === 0 && !isLoading && <p className="text-center text-muted dark:text-muted-dark py-4">No updates yet for this team.</p>}
                {updates.map(update => (
                    <div key={update.id} className="flex gap-3 p-3 border rounded-lg dark:border-border-dark hover:bg-surface dark:hover:bg-surface-dark/50">
                        <img src={update.authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(update.authorName || 'U')}`} alt={update.authorName} className="w-8 h-8 rounded-full object-cover"/>
                        <div className="flex-1">
                            <div className="flex items-center space-x-2">
                                <span className="text-sm font-medium">{update.authorName}</span>
                                <span className="text-xs text-muted dark:text-muted-dark">{new Date(update.createdAt).toLocaleString()}</span>
                            </div>
                            <p className="text-sm mt-1">{update.content}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// =========================================================================================
// ++ NEW INTEGRATED TEAM SETTINGS MODAL
// =========================================================================================

interface TeamSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    team: AppTeamType;
    currentUserMember: TeamMember | undefined;
    onTeamUpdated: (updatedTeam: AppTeamType) => void;
    onTeamDeleted: () => void;
}

type SettingsTab = 'general' | 'permissions' | 'security' | 'notifications' | 'ownership' | 'danger';

interface TeamSettingsData {
    name: string;
    description: string;
    iconSeed: TeamIconName;
    photoFile: File | null;
    isPrivate: boolean;
    allowMemberInvites: boolean;
    requireApprovalForJoining: boolean;
    autoArchiveInactiveProjects: boolean;
    defaultMemberPermissions: TeamPermission[];
}

const TeamSettingsModal: React.FC<TeamSettingsModalProps> = ({
    isOpen,
    onClose,
    team,
    currentUserMember,
    onTeamUpdated,
    onTeamDeleted,
}) => {
    const [activeTab, setActiveTab] = useState<SettingsTab>('general');
    const [isLoading, setIsLoading] = useState(false);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
    const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
    
    // Ownership transfer states
    const [showOwnershipTransfer, setShowOwnershipTransfer] = useState(false);
    const [eligibleMembers, setEligibleMembers] = useState<TeamMember[]>([]);
    const [selectedNewOwner, setSelectedNewOwner] = useState<string>('');
    const [ownershipConfirmationText, setOwnershipConfirmationText] = useState('');
    const [isLoadingEligibleMembers, setIsLoadingEligibleMembers] = useState(false);
    const [isTransferringOwnership, setIsTransferringOwnership] = useState(false);
    
    // Leave team states
    const [showLeaveConfirmation, setShowLeaveConfirmation] = useState(false);
    const [leaveConfirmationText, setLeaveConfirmationText] = useState('');
    const [isLeavingTeam, setIsLeavingTeam] = useState(false);
    
    const [settings, setSettings] = useState<TeamSettingsData>({
        name: team.name,
        description: team.description || '',
        iconSeed: team.iconSeed,
        photoFile: null,
        isPrivate: false, 
        allowMemberInvites: true,
        requireApprovalForJoining: false,
        autoArchiveInactiveProjects: false,
        defaultMemberPermissions: ['CAN_MANAGE_PROJECTS']
    });

    const canEditTeam = currentUserMember?.role === UserRole.OWNER || 
        currentUserMember?.permissions?.includes('CAN_EDIT_TEAM_DETAILS');
    const canManagePermissions = currentUserMember?.role === UserRole.OWNER || 
        currentUserMember?.permissions?.includes('CAN_MANAGE_ROLES');
    const canDeleteTeam = currentUserMember?.role === UserRole.OWNER || 
        currentUserMember?.permissions?.includes('CAN_DELETE_TEAM');
    const canTransferOwnership = currentUserMember?.role === UserRole.OWNER;
    const canLeaveTeam = currentUserMember && currentUserMember.role !== UserRole.OWNER;

    useEffect(() => {
        if (isOpen) {
            setSettings({
                name: team.name,
                description: team.description || '',
                iconSeed: team.iconSeed,
                photoFile: null,
                isPrivate: false,
                allowMemberInvites: true,
                requireApprovalForJoining: false,
                autoArchiveInactiveProjects: false,
                defaultMemberPermissions: ['CAN_MANAGE_PROJECTS']
            });
            setPhotoPreview(team.photoUrl);
            setActiveTab('general');
            setShowDeleteConfirmation(false);
            setDeleteConfirmationText('');
            setShowOwnershipTransfer(false);
            setSelectedNewOwner('');
            setOwnershipConfirmationText('');
            setEligibleMembers([]);
        }
    }, [isOpen, team]);

    useEffect(() => {
        let objectUrl: string | null = null;
        if (settings.photoFile) {
            objectUrl = URL.createObjectURL(settings.photoFile);
            setPhotoPreview(objectUrl);
        }
        return () => {
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [settings.photoFile]);

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSettings(prev => ({ ...prev, photoFile: e.target.files![0] }));
        } else {
            setSettings(prev => ({ ...prev, photoFile: null }));
            setPhotoPreview(team.photoUrl);
        }
    };

    const handleSaveGeneral = async () => {
        if (!canEditTeam) {
            alert('You do not have permission to edit team settings.');
            return;
        }

        setIsLoading(true);
        try {
            const updatedTeam = await teamService.updateTeam(team.id, {
                name: settings.name.trim(),
                description: settings.description.trim(),
                iconSeed: settings.iconSeed,
                photoFile: settings.photoFile || undefined,
            });
            
            if (updatedTeam) {
                onTeamUpdated(updatedTeam);
            }
        } catch (error: any) {
            alert(`Failed to update team: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteTeam = async () => {
        if (!canDeleteTeam) {
            alert('You do not have permission to delete this team.');
            return;
        }

        if (deleteConfirmationText !== team.name) {
            alert('Please type the team name exactly to confirm deletion.');
            return;
        }

        setIsLoading(true);
        try {
            await teamService.deleteTeam(team.id);
            onTeamDeleted();
            onClose();
        } catch (error: any) {
            alert(`Failed to delete team: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLeaveTeam = async () => {
        if (!canLeaveTeam) {
            alert('You cannot leave this team.');
            return;
        }

        if (leaveConfirmationText !== team.name) {
            alert('Please type the team name exactly to confirm leaving.');
            return;
        }

        setIsLeavingTeam(true);
        try {
            await teamService.leaveTeam(team.id);
            onClose();
            // Navigate away from team after leaving
            if (onTeamDeleted) {
                onTeamDeleted(); // This will refresh the data and navigate away
            }
        } catch (error: any) {
            alert(`Failed to leave team: ${error.message}`);
        } finally {
            setIsLeavingTeam(false);
        }
    };

    const tabs = [
        { id: 'general' as const, label: 'General', icon: CogIcon, enabled: canEditTeam },
        { id: 'permissions' as const, label: 'Permissions', icon: ShieldCheckIcon, enabled: canManagePermissions },
        { id: 'security' as const, label: 'Security', icon: ShieldCheckIcon, enabled: canEditTeam },
        { id: 'notifications' as const, label: 'Notifications', icon: BellIcon, enabled: true },
        { id: 'ownership' as const, label: 'Ownership', icon: DefaultAvatarIcon, enabled: canTransferOwnership },
        { id: 'danger' as const, label: 'Danger Zone', icon: ExclamationTriangleIcon, enabled: canDeleteTeam || canLeaveTeam }
    ].filter(tab => tab.enabled);

    const renderGeneralTab = () => (
        <div className="space-y-6">
            <div>
                <label className="block text-sm font-medium text-muted dark:text-muted-dark mb-2">
                    Team Photo
                </label>
                <div className="flex items-center space-x-4">
                    {photoPreview ? (
                        <img 
                            src={photoPreview} 
                            alt="Team preview" 
                            className="w-16 h-16 rounded-lg object-cover"
                        />
                    ) : (
                        <div className="w-16 h-16 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                            <TeamMembersIcon className="w-8 h-8 text-gray-400" />
                        </div>
                    )}
                    <div>
                        <input 
                            type="file" 
                            onChange={handlePhotoChange} 
                            className="input-style text-sm" 
                            accept="image/*"
                            disabled={!canEditTeam}
                        />
                        <p className="text-xs text-muted dark:text-muted-dark mt-1">
                            Recommended: 256x256px, max 5MB
                        </p>
                    </div>
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-muted dark:text-muted-dark mb-1">
                    Team Name
                </label>
                <input 
                    type="text" 
                    value={settings.name}
                    onChange={e => setSettings(prev => ({ ...prev, name: e.target.value }))}
                    className="input-style"
                    disabled={!canEditTeam}
                    required
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-muted dark:text-muted-dark mb-1">
                    Description
                </label>
                <textarea 
                    value={settings.description}
                    onChange={e => setSettings(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="input-style"
                    disabled={!canEditTeam}
                    placeholder="Describe your team's purpose..."
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-muted dark:text-muted-dark mb-2">
                    Team Icon (Fallback)
                </label>
                <div className="grid grid-cols-6 gap-2">
                    {Object.keys(TEAM_ICON_OPTIONS).map(iconKey => {
                        const IconComponent = TEAM_ICON_OPTIONS[iconKey as TeamIconName];
                        return (
                            <button
                                key={iconKey}
                                type="button"
                                onClick={() => setSettings(prev => ({ ...prev, iconSeed: iconKey as TeamIconName }))}
                                disabled={!canEditTeam}
                                className={`p-3 rounded-lg border-2 transition-colors ${
                                    settings.iconSeed === iconKey 
                                        ? 'border-primary dark:border-primary-light ring-2 ring-primary dark:ring-primary-light' 
                                        : 'border-border dark:border-border-dark hover:border-gray-400 dark:hover:border-gray-500'
                                } ${!canEditTeam ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <IconComponent className="w-6 h-6 mx-auto text-text dark:text-text-dark" />
                            </button>
                        );
                    })}
                </div>
            </div>

            {canEditTeam && (
                <div className="flex justify-end pt-4 border-t dark:border-border-dark">
                    <Button 
                        onClick={handleSaveGeneral}
                        loading={isLoading}
                        disabled={!settings.name.trim()}
                    >
                        Save Changes
                    </Button>
                </div>
            )}
        </div>
    );

    const renderPermissionsTab = () => (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold mb-2">Default Member Permissions</h3>
                <p className="text-sm text-muted dark:text-muted-dark mb-4">
                    These permissions will be automatically assigned to new team members.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 border rounded-lg dark:border-border-dark bg-surface dark:bg-surface-dark/30">
                    {Object.entries(TEAM_PERMISSIONS).map(([key, label]) => (
                        <Checkbox
                            key={key}
                            id={`default-perm-${key}`}
                            label={label}
                            checked={settings.defaultMemberPermissions.includes(key as TeamPermission)}
                            onChange={(checked) => {
                                setSettings(prev => ({
                                    ...prev,
                                    defaultMemberPermissions: checked
                                        ? [...prev.defaultMemberPermissions, key as TeamPermission]
                                        : prev.defaultMemberPermissions.filter(p => p !== key)
                                }));
                            }}
                            disabled={!canManagePermissions}
                        />
                    ))}
                </div>
            </div>

            <div>
                <h3 className="text-lg font-semibold mb-4">Permission Overview</h3>
                <div className="space-y-2">
                    {Object.values(UserRole).map(role => {
                        const memberCount = team.members.filter(m => m.role === role).length;
                        return (
                            <div key={role} className="flex justify-between items-center p-2 bg-surface dark:bg-surface-dark rounded">
                                <span className="font-medium capitalize">{role}s ({memberCount})</span>
                                <span className="text-sm text-muted dark:text-muted-dark">
                                    {role === UserRole.OWNER ? 'Full access' : 
                                     role === UserRole.ADMIN ? 'Most permissions' : 
                                     'Limited permissions'}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );

    const renderSecurityTab = () => (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold mb-4">Team Privacy</h3>
                <div className="space-y-4">
                    <Checkbox
                        id="private-team"
                        label="Private Team"
                        checked={settings.isPrivate}
                        onChange={(checked) => setSettings(prev => ({ ...prev, isPrivate: checked }))}
                        disabled={!canEditTeam}
                        description="Only invited members can see and join this team"
                    />
                    
                    <Checkbox
                        id="allow-member-invites"
                        label="Allow Members to Send Invites"
                        checked={settings.allowMemberInvites}
                        onChange={(checked) => setSettings(prev => ({ ...prev, allowMemberInvites: checked }))}
                        disabled={!canEditTeam}
                        description="Team members can invite others to join"
                    />
                    
                    <Checkbox
                        id="require-approval"
                        label="Require Approval for New Members"
                        checked={settings.requireApprovalForJoining}
                        onChange={(checked) => setSettings(prev => ({ ...prev, requireApprovalForJoining: checked }))}
                        disabled={!canEditTeam}
                        description="New member requests must be approved by admins"
                    />
                </div>
            </div>

            <div>
                <h3 className="text-lg font-semibold mb-4">Data Management</h3>
                <Checkbox
                    id="auto-archive"
                    label="Auto-archive Inactive Projects"
                    checked={settings.autoArchiveInactiveProjects}
                    onChange={(checked) => setSettings(prev => ({ ...prev, autoArchiveInactiveProjects: checked }))}
                    disabled={!canEditTeam}
                    description="Automatically archive projects with no activity for 90 days"
                />
            </div>

            {canEditTeam && (
                <div className="flex justify-end pt-4 border-t dark:border-border-dark">
                    <Button onClick={() => alert('Security settings saved!')}>
                        Save Security Settings
                    </Button>
                </div>
            )}
        </div>
    );

    const renderNotificationsTab = () => (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold mb-4">Team Notifications</h3>
                <div className="space-y-4">
                    <Checkbox
                        id="notify-new-members"
                        label="New Member Joins"
                        checked={true}
                        onChange={() => {}}
                        description="Get notified when someone joins the team"
                    />
                    
                    <Checkbox
                        id="notify-project-updates"
                        label="Project Updates"
                        checked={true}
                        onChange={() => {}}
                        description="Get notified about project milestones and updates"
                    />
                    
                    <Checkbox
                        id="notify-mentions"
                        label="Team Mentions"
                        checked={true}
                        onChange={() => {}}
                        description="Get notified when the team is mentioned"
                    />
                    
                    <Checkbox
                        id="notify-weekly-digest"
                        label="Weekly Team Digest"
                        checked={false}
                        onChange={() => {}}
                        description="Receive a weekly summary of team activity"
                    />
                </div>
            </div>

            <div className="flex justify-end pt-4 border-t dark:border-border-dark">
                <Button onClick={() => alert('Notification preferences saved!')}>
                    Save Preferences
                </Button>
            </div>
        </div>
    );

    const renderOwnershipTab = () => (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold mb-2">Current Owner</h3>
                <div className="p-4 border rounded-lg dark:border-border-dark bg-surface dark:bg-surface-dark">
                    <div className="flex items-center space-x-3">
                        <img 
                            src={team.members.find(m => m.role === UserRole.OWNER)?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(team.ownerName || 'O')}`} 
                            alt="Owner" 
                            className="w-10 h-10 rounded-full object-cover" 
                        />
                        <div>
                            <p className="font-medium text-text dark:text-text-dark">{team.ownerName}</p>
                            <p className="text-sm text-muted dark:text-muted-dark">Team Owner</p>
                        </div>
                    </div>
                </div>
            </div>
            <div>
                <h3 className="text-lg font-semibold mb-4">Transfer Ownership</h3>
                <div className="p-4 border border-yellow-200 dark:border-yellow-800 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 mb-4">
                    <div className="flex items-center space-x-2 mb-2">
                        <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                        <h4 className="font-semibold text-yellow-800 dark:text-yellow-300">Important Notice</h4>
                    </div>
                    <p className="text-sm text-yellow-700 dark:text-yellow-400">
                        Transferring ownership will make you an admin and give the selected member full control over the team. 
                        This action cannot be undone unless the new owner transfers it back.
                    </p>
                </div>
                <Button
                    onClick={() => {
                        setShowOwnershipTransfer(true);
                        loadEligibleMembers();
                    }}
                    variant="outline"
                    leftIcon={<ChevronRightIcon className="w-4 h-4" />}
                >
                    Transfer Ownership
                </Button>
            </div>
        </div>
    );

    const renderDangerTab = () => (
        <div className="space-y-6">
            <div className="p-4 border border-red-200 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-900/20">
                <div className="flex items-center space-x-2 mb-2">
                    <ExclamationTriangleIcon className="w-5 h-5 text-red-600 dark:text-red-400" />
                    <h3 className="text-lg font-semibold text-red-800 dark:text-red-300">Danger Zone</h3>
                </div>
                <p className="text-sm text-red-700 dark:text-red-400 mb-4">
                    These actions are permanent and cannot be undone. Please proceed with caution.
                </p>
            </div>

            {canLeaveTeam && (
                <Card className="p-4 border-red-200 dark:border-red-800">
                    <div className="flex justify-between items-start">
                        <div>
                            <h4 className="font-semibold text-red-800 dark:text-red-300 mb-1">Leave Team</h4>
                            <p className="text-sm text-red-700 dark:text-red-400">
                                Leave this team permanently. You will lose access to all team resources and conversations.
                            </p>
                        </div>
                        <Button
                            variant="danger"
                            onClick={() => setShowLeaveConfirmation(true)}
                            leftIcon={<ArrowUturnRightIcon className="w-4 h-4" />}
                        >
                            Leave Team
                        </Button>
                    </div>
                </Card>
            )}

            {canDeleteTeam && (
                <Card className="p-4 border-red-200 dark:border-red-800">
                    <div className="flex justify-between items-start">
                        <div>
                            <h4 className="font-semibold text-red-800 dark:text-red-300 mb-1">Delete Team</h4>
                            <p className="text-sm text-red-700 dark:text-red-400">
                                Permanently delete this team and all its data. This action cannot be undone.
                            </p>
                        </div>
                        <Button
                            variant="danger"
                            onClick={() => setShowDeleteConfirmation(true)}
                            leftIcon={<TrashIcon className="w-4 h-4" />}
                        >
                            Delete Team
                        </Button>
                    </div>
                </Card>
            )}

            {!canDeleteTeam && !canLeaveTeam && (
                <div className="text-center p-8 text-muted dark:text-muted-dark">
                    <EyeIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>You don't have permission to perform dangerous actions on this team.</p>
                </div>
            )}
        </div>
    );

    const loadEligibleMembers = async () => {
        setIsLoadingEligibleMembers(true);
        try {
            // Get all team members except the current owner
            const members = team.members.filter(member => 
                member.id !== currentUserMember?.id && member.role !== UserRole.OWNER
            );
            setEligibleMembers(members);
        } catch (error) {
            console.error('Error loading eligible members:', error);
        } finally {
            setIsLoadingEligibleMembers(false);
        }
    };

    const handleOwnershipTransfer = async () => {
        if (!selectedNewOwner) {
            alert('Please select a new owner.');
            return;
        }
        if (ownershipConfirmationText !== 'TRANSFER OWNERSHIP') {
            alert('Please type "TRANSFER OWNERSHIP" to confirm.');
            return;
        }
        setIsTransferringOwnership(true);
        try {
            const result = await teamService.transferTeamOwnership(team.id, selectedNewOwner);
            if (result.success) {
                alert('Ownership transferred successfully! You are now an admin of this team.');
                onClose();
                // Refresh team data
                if (onTeamUpdated) {
                    const updatedTeam = await teamService.getTeamById(team.id);
                    if (updatedTeam) {
                        onTeamUpdated(updatedTeam);
                    }
                }
            } else {
                alert(`Failed to transfer ownership: ${result.error}`);
            }
        } catch (error: any) {
            alert(`Error transferring ownership: ${error.message}`);
        } finally {
            setIsTransferringOwnership(false);
            setShowOwnershipTransfer(false);
            setSelectedNewOwner('');
            setOwnershipConfirmationText('');
        }
    };

    return (
        <>
            <Modal 
                isOpen={isOpen && !showDeleteConfirmation && !showLeaveConfirmation} 
                onClose={onClose} 
                title={`Team Settings - ${team.name}`}
                size="xl"
                showSaveButton={false}
            >
                <div className="flex flex-col md:flex-row gap-6 min-h-[600px]">
                    <div className="w-full md:w-48 flex-shrink-0">
                        <nav className="space-y-1">
                            {tabs.map(tab => {
                                const IconComponent = tab.icon;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`w-full flex items-center space-x-2 px-3 py-2 text-left rounded-lg transition-colors ${
                                            activeTab === tab.id
                                                ? 'bg-primary text-white'
                                                : 'text-text dark:text-text-dark hover:bg-surface dark:hover:bg-surface-dark'
                                        }`}
                                    >
                                        <IconComponent className="w-4 h-4 flex-shrink-0" />
                                        <span className="text-sm">{tab.label}</span>
                                    </button>
                                );
                            })}
                        </nav>
                    </div>
                    <div className="flex-1 min-w-0">
                        {activeTab === 'general' && renderGeneralTab()}
                        {activeTab === 'permissions' && renderPermissionsTab()}
                        {activeTab === 'security' && renderSecurityTab()}
                        {activeTab === 'notifications' && renderNotificationsTab()}
                        {activeTab === 'ownership' && renderOwnershipTab()}
                        {activeTab === 'danger' && renderDangerTab()}
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={showDeleteConfirmation}
                onClose={() => setShowDeleteConfirmation(false)}
                title="Delete Team"
                size="md"
            >
                <div className="space-y-4">
                    <div className="flex items-center space-x-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <ExclamationTriangleIcon className="w-8 h-8 text-red-600 dark:text-red-400 flex-shrink-0" />
                        <div>
                            <h3 className="font-semibold text-red-800 dark:text-red-300">
                                This action cannot be undone
                            </h3>
                            <p className="text-sm text-red-700 dark:text-red-400">
                                This will permanently delete the team, all its departments, projects, and associated data.
                            </p>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-text dark:text-text-dark mb-2">
                            Type <strong>{team.name}</strong> to confirm deletion:
                        </label>
                        <input
                            type="text"
                            value={deleteConfirmationText}
                            onChange={e => setDeleteConfirmationText(e.target.value)}
                            className="input-style"
                            placeholder={team.name}
                        />
                    </div>

                    <div className="flex justify-end space-x-2 pt-4">
                        <Button
                            variant="outline"
                            onClick={() => setShowDeleteConfirmation(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="danger"
                            onClick={handleDeleteTeam}
                            loading={isLoading}
                            disabled={deleteConfirmationText !== team.name}
                            leftIcon={<TrashIcon className="w-4 h-4" />}
                        >
                            Delete Team Forever
                        </Button>
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={showLeaveConfirmation}
                onClose={() => {
                    setShowLeaveConfirmation(false);
                    setLeaveConfirmationText('');
                }}
                title="Leave Team"
                size="md"
            >
                <div className="space-y-4">
                    <div className="flex items-center space-x-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <ExclamationTriangleIcon className="w-8 h-8 text-red-600 dark:text-red-400 flex-shrink-0" />
                        <div>
                            <h3 className="font-semibold text-red-800 dark:text-red-300">
                                You will lose access to this team
                            </h3>
                            <p className="text-sm text-red-700 dark:text-red-400">
                                This will remove you from the team. You will lose access to all team resources, conversations, and projects.
                            </p>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-text dark:text-text-dark mb-2">
                            Type <strong>{team.name}</strong> to confirm leaving:
                        </label>
                        <input
                            type="text"
                            value={leaveConfirmationText}
                            onChange={e => setLeaveConfirmationText(e.target.value)}
                            className="input-style"
                            placeholder={team.name}
                        />
                    </div>

                    <div className="flex justify-end space-x-2 pt-4">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setShowLeaveConfirmation(false);
                                setLeaveConfirmationText('');
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="danger"
                            onClick={handleLeaveTeam}
                            loading={isLeavingTeam}
                            disabled={leaveConfirmationText !== team.name}
                            leftIcon={<ArrowUturnRightIcon className="w-4 h-4" />}
                        >
                            Leave Team
                        </Button>
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={showOwnershipTransfer}
                onClose={() => setShowOwnershipTransfer(false)}
                title="Transfer Team Ownership"
                size="md"
            >
                <div className="space-y-6">
                    <div className="p-4 border border-yellow-200 dark:border-yellow-800 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                        <div className="flex items-center space-x-2 mb-2">
                            <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                            <h4 className="font-semibold text-yellow-800 dark:text-yellow-300">Confirm Ownership Transfer</h4>
                        </div>
                        <p className="text-sm text-yellow-700 dark:text-yellow-400">
                            You will become an admin and lose owner privileges. The selected member will become the new owner with full control.
                        </p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text dark:text-text-dark mb-2">
                            Select New Owner
                        </label>
                        {isLoadingEligibleMembers ? (
                            <div className="p-4 text-center text-muted dark:text-muted-dark">Loading members...</div>
                        ) : (
                            <select
                                value={selectedNewOwner}
                                onChange={(e) => setSelectedNewOwner(e.target.value)}
                                className="input-style w-full"
                            >
                                <option value="">Choose a team member...</option>
                                {eligibleMembers.map(member => (
                                    <option key={member.id} value={member.id}>
                                        {member.full_name} ({member.role})
                                    </option>
                                ))}
                            </select>
                        )}
                        {eligibleMembers.length === 0 && !isLoadingEligibleMembers && (
                            <p className="text-sm text-muted dark:text-muted-dark mt-2">
                                No eligible members available for ownership transfer.
                            </p>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text dark:text-text-dark mb-2">
                            Type <strong>TRANSFER OWNERSHIP</strong> to confirm:
                        </label>
                        <input
                            type="text"
                            value={ownershipConfirmationText}
                            onChange={(e) => setOwnershipConfirmationText(e.target.value)}
                            className="input-style w-full"
                            placeholder="TRANSFER OWNERSHIP"
                        />
                    </div>
                    <div className="flex justify-end space-x-2 pt-4">
                        <Button
                            variant="outline"
                            onClick={() => setShowOwnershipTransfer(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleOwnershipTransfer}
                            loading={isTransferringOwnership}
                            disabled={!selectedNewOwner || ownershipConfirmationText !== 'TRANSFER OWNERSHIP'}
                            leftIcon={<ChevronRightIcon className="w-4 h-4" />}
                        >
                            Transfer Ownership
                        </Button>
                    </div>
                </div>
            </Modal>
        </>
    );
};


// =========================================================================================
// ++ END OF TEAM SETTINGS MODAL
// =========================================================================================


interface SelectedTeamViewProps {
  team: AppTeamType;
  currentUser: FrontendUser;
  onBack: () => void;
  onOpenAddMemberModal: (teamId: string) => void;
  onOpenEditMemberModal: (member: TeamMember) => void;
  onAddDepartment: (teamId: string) => void;
  onDeleteDepartment: (departmentId: string) => Promise<void>;
  onLinkProjects: (teamId: string) => void;
  onMajorDataChange: () => Promise<void>;
  onOpenSettings: (team: AppTeamType) => void;
  onViewDepartmentDetails: (teamId: string, departmentId: string) => void;
  onViewChat: (teamId: string) => void;
  isRealtimeConnected?: boolean;
}
const SelectedTeamView: React.FC<SelectedTeamViewProps> = ({
  team, currentUser, onBack, onOpenAddMemberModal, onOpenEditMemberModal, onAddDepartment,
  onDeleteDepartment, onLinkProjects, onMajorDataChange, onOpenSettings, onViewDepartmentDetails,
  onViewChat, isRealtimeConnected = false
}) => {
  const TeamDisplayIcon = TEAM_ICON_OPTIONS[team.iconSeed] || DefaultAvatarIcon;
  const currentUserTeamMembership = team.members.find(m => m.id === currentUser.id);

  const [departmentToDelete, setDepartmentToDelete] = useState<DepartmentType | null>(null);
  const navigate = useNavigate();
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isNavigatingToResources, setIsNavigatingToResources] = useState(false);
  
  // Leave team functionality
  const [showLeaveConfirmation, setShowLeaveConfirmation] = useState(false);
  const [leaveConfirmationText, setLeaveConfirmationText] = useState('');
  const [isLeavingTeam, setIsLeavingTeam] = useState(false);

  const handleResourcesClick = async () => {
    if (!currentUser) return;
    setIsNavigatingToResources(true);
    try {
        const teamRootFolder = await resourceService.findOrCreateTeamRootFolder(team.id, team.name, currentUser.id);
        navigate('/app/resources', { 
            state: { 
                initialFolderId: teamRootFolder.id,
                teamContext: { id: team.id, name: team.name },
            } 
        });
    } catch (error) {
        console.error("Failed to navigate to team resources:", error);
        alert("Could not open team resources. Please try again.");
        setIsNavigatingToResources(false);
    }
  };

  const statCardsData: StatCardData[] = useMemo(() => [
    { title: "Team Members", value: team.membersCount, icon: TeamMembersIcon, onClick: () => onOpenAddMemberModal(team.id) },
    { title: "Departments", value: team.departments.length, icon: Building2Icon },
    { title: "Projects", value: team.projectsCount, icon: BriefcaseIcon, onClick: () => onLinkProjects(team.id) },
    {
      title: "Resources",
      value: team.resourcesCount || 0,
      icon: FolderOpenIcon,
      onClick: handleResourcesClick,
      isLoading: isNavigatingToResources,
    },
  ], [team, onLinkProjects, onOpenAddMemberModal, isNavigatingToResources, currentUser]);

  const confirmDeleteDepartment = async () => {
    if (departmentToDelete) {
      try {
        await onDeleteDepartment(departmentToDelete.id);
        await onMajorDataChange();
      }
      catch (e) { /* Parent handles error */ }
      finally { setDepartmentToDelete(null); }
    }
  };

  const handleLeaveTeam = async () => {
    if (leaveConfirmationText !== team.name) {
      alert('Please type the team name exactly to confirm leaving.');
      return;
    }

    if (!currentUserTeamMembership) {
      alert('You are not a member of this team.');
      return;
    }

    if (currentUserTeamMembership.role === UserRole.OWNER) {
      alert('Team owners cannot leave the team. Please transfer ownership to another member first.');
      return;
    }

    setIsLeavingTeam(true);
    try {
      // Add team update before leaving
      const memberRole = currentUserTeamMembership.role.toLowerCase();
      const updateMessage = `${currentUserTeamMembership.full_name} (${memberRole}) has left the team.`;
      
      try {
        await teamService.addTeamUpdate(team.id, updateMessage);
      } catch (updateError) {
        console.warn('Failed to add team update for member leaving:', updateError);
        // Continue with leaving even if update fails
      }
      
      await teamService.leaveTeam(team.id);
      
      // Show success notification
      alert(`You have successfully left ${team.name}. You will be redirected to the teams page.`);
      
      // Close modal and navigate back
      setShowLeaveConfirmation(false);
      setLeaveConfirmationText('');
      
      // Navigate back to teams list and refresh data
      onBack();
      await onMajorDataChange();
    } catch (error: any) {
      alert(`Failed to leave team: ${error.message}`);
    } finally {
      setIsLeavingTeam(false);
    }
  };

  const canUserManageTeamDetails = hasPermission(currentUserTeamMembership, 'CAN_EDIT_TEAM_DETAILS');
  const canUserManageDepartments = hasPermission(currentUserTeamMembership, 'CAN_MANAGE_DEPARTMENTS');
  const canUserAddMembers = hasPermission(currentUserTeamMembership, 'CAN_ADD_MEMBERS');
  const canUserLeaveTeam = currentUserTeamMembership && currentUserTeamMembership.role !== UserRole.OWNER;
  const isOwner = currentUserTeamMembership && currentUserTeamMembership.role === UserRole.OWNER;


  return (
    <div className="flex flex-col bg-background dark:bg-black text-text dark:text-text-dark">
      <header className="flex items-center justify-between p-4 border-b dark:border-border-dark flex-shrink-0">
        <Button onClick={onBack} variant="ghost" leftIcon={<ArrowLeftIcon />} className="text-sm">
          All Teams
        </Button>
        <div className="flex items-center space-x-3">
          {team.photoUrl ? (
              <img src={team.photoUrl} alt={team.name} className="w-8 h-8 rounded-md object-cover" />
          ) : (
              <div className={`w-8 h-8 rounded-md flex items-center justify-center ${getDeterministicColor(team.id)}`}>
                  <TeamDisplayIcon className="w-5 h-5 text-white" />
              </div>
          )}
          <h2 className="text-xl font-semibold truncate" title={team.name}>{team.name}</h2>
          {/* 🚀 REALTIME CONNECTION INDICATOR */}
          <div className={`w-2 h-2 rounded-full ${isRealtimeConnected ? 'bg-green-500' : 'bg-gray-400'}`} title={isRealtimeConnected ? 'Connected to realtime updates' : 'Offline'} />
        </div>
        <div className="flex items-center space-x-2">
            {canUserAddMembers && (
              <Button onClick={() => setIsInviteModalOpen(true)} size="sm" variant="outline" leftIcon={<Share2Icon className="w-4 h-4"/>}>Invite</Button>
            )}
            <Button onClick={() => onViewChat(team.id)} size="sm" variant="outline" leftIcon={<MessageCircleIcon className="w-4 h-4"/>}>Team Chat</Button>
            <Button onClick={() => navigate(`/app/call/team-${team.id}`)} size="sm" variant="outline" leftIcon={<VideoIcon className="w-4 h-4"/>}>
                Team Meet
            </Button>
            {canUserLeaveTeam && (
              <Button 
                onClick={() => setShowLeaveConfirmation(true)} 
                size="sm" 
                variant="outline" 
                className="text-red-600 dark:text-red-400 border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                leftIcon={<ArrowUturnRightIcon className="w-4 h-4"/>}
              >
                Leave Team
              </Button>
            )}
            {isOwner && (
              <Button 
                onClick={() => onOpenSettings(team)} 
                size="sm" 
                variant="outline" 
                className="text-orange-600 dark:text-orange-400 border-orange-300 dark:border-orange-700 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                leftIcon={<ExclamationTriangleIcon className="w-4 h-4"/>}
              >
                Transfer/Delete
              </Button>
            )}
            {canUserManageTeamDetails && <Button onClick={() => onOpenSettings(team)} size="sm" variant="ghost" leftIcon={<CogIcon className="w-4 h-4" />} >Settings</Button>}
        </div>
      </header>

      <main className="flex-1 p-6 overflow-y-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3">
            <Card className="p-4 flex flex-col">
              <h3 className="text-lg font-semibold mb-3 text-text dark:text-text-dark">Departments ({team.departments.length})</h3>
              <div className="flex-grow overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 max-h-112">
                {team.departments.length === 0 ? (
                    <p className="text-sm text-muted dark:text-muted-dark text-center py-4">No departments yet.</p>
                ) : (
                    team.departments.map(dept => (
                    <div key={dept.id} onClick={() => onViewDepartmentDetails(team.id, dept.id)} className="p-3 rounded-lg border dark:border-border-dark bg-surface dark:bg-surface-dark/50 hover:shadow-sm cursor-pointer hover:border-primary/50 dark:hover:border-primary-dark/50 transition-colors">
                        <div className="flex justify-between items-center">
                        <div>
                            <h4 className="font-medium text-text dark:text-text-dark">{dept.name}</h4>
                            <p className="text-xs text-muted dark:text-muted-dark">{dept.members.length} member(s)</p>
                        </div>
                        {canUserManageDepartments && (
                            <div className="relative group">
                                <Button variant="ghost" size="sm" className="p-1" onClick={e => e.stopPropagation()}><EllipsisHorizontalIcon className="w-5 h-5"/></Button>
                                <div className="absolute top-full right-0 mt-1 hidden group-hover:flex flex-col bg-card dark:bg-card-dark border dark:border-border-dark rounded-md shadow-lg z-20 py-1 min-w-[150px]">
                                    <button onClick={(e) => {e.stopPropagation(); setDepartmentToDelete(dept);}} className="text-left w-full px-3 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">Delete Department</button>
                                </div>
                            </div>
                        )}
                        </div>
                        {dept.description && <p className="text-xs text-muted dark:text-muted-dark mt-1 pt-1 border-t dark:border-border-dark/50">{dept.description}</p>}
                    </div>
                    ))
                )}
              </div>
              {canUserManageDepartments && (
                <Button onClick={() => onAddDepartment(team.id)} variant="outline" size="sm" leftIcon={<PlusIcon className="w-4 h-4"/>} className="mt-4 w-full">
                  Add Department
                </Button>
              )}
            </Card>
          </div>

          <div className="lg:col-span-2 space-y-4">
            {statCardsData.map((stat) => (
              <TeamStatCard key={stat.title} {...stat} />
            ))}
          </div>

          <div className="lg:col-span-5">
            <Card className="p-4">
              <h3 className="text-lg font-semibold mb-3 text-text dark:text-text-dark">Team Updates</h3>
              <TeamActivityFeed team={team} currentUser={currentUser} />
            </Card>
          </div>
        </div>
      </main>

      {departmentToDelete && (
            <Modal isOpen={!!departmentToDelete} onClose={() => setDepartmentToDelete(null)} title={`Delete ${departmentToDelete.name}?`} size="sm">
                <p className="text-sm text-text dark:text-text-dark mb-6">
                    Are you sure you want to delete the department "<strong>{departmentToDelete.name}</strong>"? This action cannot be undone.
                </p>
                <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setDepartmentToDelete(null)}>Cancel</Button>
                    <Button variant="danger" onClick={confirmDeleteDepartment}>Delete</Button>
                </div>
            </Modal>
        )}

      {/* Leave Team Confirmation Modal */}
      <Modal
        isOpen={showLeaveConfirmation}
        onClose={() => {
          setShowLeaveConfirmation(false);
          setLeaveConfirmationText('');
        }}
        title="Leave Team"
        size="md"
      >
        <div className="space-y-4">
          <div className="flex items-center space-x-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <ExclamationTriangleIcon className="w-8 h-8 text-red-600 dark:text-red-400 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-red-800 dark:text-red-300">
                You will lose access to this team
              </h3>
              <p className="text-sm text-red-700 dark:text-red-400">
                This will remove you from the team. You will lose access to all team resources, conversations, and projects.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text dark:text-text-dark mb-2">
              Type <strong>{team.name}</strong> to confirm leaving:
            </label>
            <input
              type="text"
              value={leaveConfirmationText}
              onChange={e => setLeaveConfirmationText(e.target.value)}
              className="input-style"
              placeholder={team.name}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowLeaveConfirmation(false);
                setLeaveConfirmationText('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleLeaveTeam}
              loading={isLeavingTeam}
              disabled={leaveConfirmationText !== team.name}
              leftIcon={<ArrowUturnRightIcon className="w-4 h-4" />}
            >
              Leave Team
            </Button>
          </div>
        </div>
      </Modal>

      <InviteLinkModal isOpen={isInviteModalOpen} onClose={() => setIsInviteModalOpen(false)} team={team} />
    </div>
  );
};

interface TeamMembersManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  team: AppTeamType;
  currentUser: FrontendUser;
  onRefresh: () => Promise<void>;
}

const TeamMembersManagementModal: React.FC<TeamMembersManagementModalProps> = ({ isOpen, onClose, team, currentUser, onRefresh }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [memberToEdit, setMemberToEdit] = useState<TeamMember | null>(null);

  const currentUserAsMember = team.members.find(m => m.id === currentUser.id);

  const handleAddMember = async (userId: string, role: UserRole, tags: string[]) => {
    try {
      await teamService.addTeamMember(team.id, userId, role, tags);
      await onRefresh();
      setShowAddModal(false);
    } catch (e: any) { alert(`Error adding member: ${e.message}`); }
  };

  const handleUpdateMember = async (memberId: string, updates: any) => {
    try {
        await teamService.updateTeamMemberDetails(team.id, memberId, updates);
        await onRefresh();
        setMemberToEdit(null);
    } catch(e:any) { alert(`Error updating member: ${e.message}`); }
  };
  
  const handleRemoveMember = async (memberId: string) => {
    if(window.confirm("Are you sure you want to remove this member?")){
      try {
        await teamService.removeTeamMember(team.id, memberId);
        await onRefresh();
        setMemberToEdit(null);
      } catch(e:any) { alert(`Error removing member: ${e.message}`); }
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setShowAddModal(false);
      setMemberToEdit(null);
    }
  }, [isOpen]);
  
  return (
    <>
      <Modal isOpen={isOpen && !showAddModal && !memberToEdit} onClose={onClose} title={`Manage Members for ${team.name}`} showSaveButton={false} size="lg">
        <div className="flex justify-end mb-4">
          <Button onClick={() => setShowAddModal(true)} leftIcon={<AddUserIcon className="w-4 h-4" />}>
            Add Member
          </Button>
        </div>
        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
          {team.members.map(member => (
            <div key={member.id} className="p-3 rounded-lg flex items-center justify-between bg-gray-50 dark:bg-surface-dark">
              <div className="flex items-center space-x-3">
                <img src={member.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.full_name || 'U')}`} alt={member.full_name || ''} className="w-10 h-10 rounded-full object-cover" />
                <div>
                  <p className="font-semibold text-text dark:text-text-dark">{member.full_name}</p>
                  <p className="text-sm text-muted dark:text-muted-dark capitalize">{member.role}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setMemberToEdit(member)}>Manage</Button>
            </div>
          ))}
        </div>
      </Modal>

      <AddMemberFormModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAddMember={handleAddMember}
        teamId={team.id}
        teamName={team.name}
        currentMembers={team.members}
      />
      
      <EditMemberModal
        isOpen={!!memberToEdit}
        onClose={() => setMemberToEdit(null)}
        member={memberToEdit}
        teamId={team.id}
        currentUserMember={currentUserAsMember}
        onUpdateMember={handleUpdateMember}
        onRemoveMember={handleRemoveMember}
      />
    </>
  );
};


interface TeamPageProps {
  initialTeams: AppTeamType[];
  currentUser: FrontendUser | null;
  isLoadingParent: boolean;
  onViewTeamDetails?: (teamId: string) => void;
  selectedTeamIdForDetailView?: string | null; 
  onReturnToDashboard?: () => void; 
  onDataRefreshNeeded?: () => Promise<void>;
  onViewDepartmentDetails?: (teamId: string, departmentId: string) => void;
  onViewTeamChat?: (teamId: string) => void;
}

export const TeamPage: React.FC<TeamPageProps> = ({
  initialTeams,
  currentUser,
  isLoadingParent = false,
  onViewTeamDetails,
  selectedTeamIdForDetailView,
  onReturnToDashboard,
  onDataRefreshNeeded,
  onViewDepartmentDetails,
  onViewTeamChat,
}) => {
  const [teams, setTeams] = useState<AppTeamType[]>(initialTeams);
  const [teamForDetail, setTeamForDetail] = useState<AppTeamType | null>(null);
  const [isCreateTeamModalOpen, setIsCreateTeamModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(isLoadingParent);
  const [error, setError] = useState<string | null>(null);

  // Modals for team details
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [teamForMembersModal, setTeamForMembersModal] = useState<AppTeamType | null>(null);
  const [createDeptModalTeam, setCreateDeptModalTeam] = useState<AppTeamType | null>(null);
  const [linkProjectsModalTeam, setLinkProjectsModalTeam] = useState<AppTeamType | null>(null);
  
  // State for the new integrated settings modal
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [teamForSettings, setTeamForSettings] = useState<AppTeamType | null>(null);

  const fetchData = useCallback(async () => {
    if (!currentUser) return;
    setIsLoading(true);
    setError(null);
    try {
      // Batch API calls when possible
      const promises = [teamService.getAllTeamsForUser()];
      
      if (selectedTeamIdForDetailView) {
        promises.push(teamService.getTeamById(selectedTeamIdForDetailView));
      }
      
      const results = await Promise.all(promises);
      const teamsData = results[0];
      setTeams(teamsData);
      
      if (selectedTeamIdForDetailView) {
        const detailTeam = teamsData.find(t => t.id === selectedTeamIdForDetailView) || results[1];
        setTeamForDetail(detailTeam);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load team data.");
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, selectedTeamIdForDetailView]);

  // 🚀 REALTIME SUBSCRIPTIONS
  const { isConnected: isTeamRealtimeConnected } = useTeamRealtime(
    selectedTeamIdForDetailView, 
    fetchData
  );
  
  const { isConnected: isUserTeamsConnected } = useUserTeamsRealtime(
    currentUser?.id || null,
    fetchData
  );

  const { linkProject, isLinking } = useOptimisticProjectLink();

  useEffect(() => {
    setIsLoading(isLoadingParent);
    setTeams(initialTeams);
  }, [isLoadingParent, initialTeams]);

  useEffect(() => {
    if (selectedTeamIdForDetailView) {
      const foundTeam = teams.find(t => t.id === selectedTeamIdForDetailView);
      setTeamForDetail(foundTeam || null);
      if (!foundTeam && !isLoading) { // Fetch if not found in current list
        teamService.getTeamById(selectedTeamIdForDetailView).then(setTeamForDetail).catch(console.error);
      }
    } else {
      setTeamForDetail(null);
    }
  }, [selectedTeamIdForDetailView, teams, isLoading]);

  const handleCreateTeam = async (name: string, description?: string, iconSeed?: TeamIconName, photoFile?: File) => {
    try {
      await teamService.createTeam(name, description, iconSeed, photoFile);
      if (onDataRefreshNeeded) await onDataRefreshNeeded();
      else await fetchData();
    } catch (e: any) { 
        alert(`Error: ${e.message}`); 
        throw e;
    }
  };
  
  const handleCreateDepartment = async (teamId: string, name: string, description?: string) => {
    try {
        await teamService.createDepartment(teamId, name, description);
        setCreateDeptModalTeam(null);
        if (onDataRefreshNeeded) await onDataRefreshNeeded();
        else await fetchData();
    } catch (e: any) { alert(`Error: ${e.message}`); throw e; }
  };

  const handleDeleteDepartment = async (departmentId: string) => {
    if(window.confirm("Are you sure you want to delete this department?")) {
        await teamService.deleteDepartment(departmentId);
    }
  };
  
  const handleLinkProject = async (projectId: string, teamId: string) => {
    return await projectService.linkProjectToTeam(projectId, teamId);
  }
  const handleUnlinkProject = async (projectId: string) => {
     return await projectService.unlinkProjectFromTeam(projectId);
  }

  if (teamForDetail && currentUser && onViewDepartmentDetails && onViewTeamChat) {
    return (
      <>
        <SelectedTeamView 
          team={teamForDetail}
          currentUser={currentUser}
          onBack={() => onReturnToDashboard && onReturnToDashboard()}
          onAddDepartment={(teamId) => setCreateDeptModalTeam(teams.find(t => t.id === teamId) || null)}
          onDeleteDepartment={handleDeleteDepartment}
          onLinkProjects={(teamId) => setLinkProjectsModalTeam(teams.find(t => t.id === teamId) || null)}
          onOpenAddMemberModal={() => { setTeamForMembersModal(teamForDetail); setIsMembersModalOpen(true); }}
          onOpenEditMemberModal={() => { /* This is handled inside TeamMembersManagementModal now */ }}
          onMajorDataChange={onDataRefreshNeeded || fetchData}
          onOpenSettings={(team) => {setTeamForSettings(team); setIsSettingsModalOpen(true);}}
          onViewDepartmentDetails={onViewDepartmentDetails}
          onViewChat={onViewTeamChat}
          isRealtimeConnected={isTeamRealtimeConnected}
        />
        {teamForMembersModal && (
          <TeamMembersManagementModal
              isOpen={isMembersModalOpen}
              onClose={() => { setIsMembersModalOpen(false); setTeamForMembersModal(null);}}
              team={teamForMembersModal}
              currentUser={currentUser}
              onRefresh={onDataRefreshNeeded || fetchData}
          />
        )}
        
        {teamForSettings && (
           <TeamSettingsModal
              isOpen={isSettingsModalOpen}
              onClose={() => setIsSettingsModalOpen(false)}
              team={teamForSettings}
              currentUserMember={teamForSettings.members.find(m => m.id === currentUser.id)}
              onTeamUpdated={async (updatedTeam) => {
                  if (onDataRefreshNeeded) await onDataRefreshNeeded();
                  else await fetchData();
                  setTeamForDetail(updatedTeam);
                  setIsSettingsModalOpen(false);
              }}
              onTeamDeleted={async () => {
                  setIsSettingsModalOpen(false);
                  if (onReturnToDashboard) onReturnToDashboard();
                  if (onDataRefreshNeeded) await onDataRefreshNeeded();
                  else await fetchData();
              }}
          />
        )}

        {createDeptModalTeam && (
          <CreateDepartmentModal
            isOpen={!!createDeptModalTeam}
            onClose={() => setCreateDeptModalTeam(null)}
            onSave={(name, desc) => handleCreateDepartment(createDeptModalTeam.id, name, desc)}
            teamName={createDeptModalTeam.name}
          />
        )}

        {linkProjectsModalTeam && (
          <LinkProjectModal
            isOpen={!!linkProjectsModalTeam}
            onClose={() => setLinkProjectsModalTeam(null)}
            teamId={linkProjectsModalTeam.id}
            teamName={linkProjectsModalTeam.name}
            onLinkProject={handleLinkProject}
            onUnlinkProject={handleUnlinkProject}
            onProjectsUpdated={onDataRefreshNeeded || fetchData}
          />
        )}
      </>
    );
  }
  
  if (isLoading && teams.length === 0) return <div className="p-6 text-center text-muted dark:text-muted-dark">Loading teams...</div>;
  if (error && teams.length === 0) return <div className="p-6 text-center text-red-500">Error: {error}</div>;

  return (
    <div className="p-4 sm:p-6 bg-background dark:bg-background-dark">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text dark:text-text-dark">Teams</h1>
          <p className="text-muted dark:text-muted-dark">Collaborate with your teams.</p>
        </div>
        <Button onClick={() => setIsCreateTeamModalOpen(true)} leftIcon={<PlusIcon />}>
          New Team
        </Button>
      </div>

      {teams.length === 0 && !isLoading ? (
        <Card className="text-center p-10">
            <TeamMembersIcon className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
            <h3 className="text-xl font-semibold mb-2 text-text dark:text-text-dark">No Teams Yet</h3>
            <p className="text-muted dark:text-muted-dark mb-6">Create your first team to start collaborating.</p>
            <Button onClick={() => setIsCreateTeamModalOpen(true)} leftIcon={<PlusIcon />}>
                Create Team
            </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.map(team => (
            <TeamCard key={team.id} team={team} onSelectTeam={(teamId) => onViewTeamDetails && onViewTeamDetails(teamId)} />
          ))}
        </div>
      )}

      <CreateTeamModal isOpen={isCreateTeamModalOpen} onClose={() => setIsCreateTeamModalOpen(false)} onSave={handleCreateTeam} />
    </div>
  );
};
