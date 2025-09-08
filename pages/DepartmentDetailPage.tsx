import React, { useState, useEffect, useCallback, useMemo, FormEvent, useRef } from 'react';
import { Card, Button, Modal, Checkbox, RadioGroup, Input, Textarea } from '../components';
import { DepartmentType, TeamType, User as FrontendUser, TeamMember, UserRole, UserPublicProfile, TeamPermission, DepartmentUpdate, DepartmentMemberRole, Project } from '../types';
import { teamService } from '../teamService';
// Assuming a projectService exists for fetching project-specific data
import { projectService } from '../projectService'; 
import { ArrowLeftIcon, Building2Icon, UsersIcon, CogIcon, UserPlusIcon, MessageCircleIcon, VideoCameraIcon as VideoIcon, SendIcon, ChatBubbleLeftIcon, PlusIcon, BriefcaseIcon, LinkIcon, XMarkIcon } from '../constants';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';
import { TeamChatPage } from './TeamChatPage';

const hasPermission = (member: TeamMember | undefined, permission: TeamPermission): boolean => {
    if (!member) return false;
    if (member.role === UserRole.OWNER) return true; // Owner has all permissions implicitly
    return member.permissions?.includes(permission) ?? false;
};

// --- Child Component: DepartmentActivityFeed ---
interface DepartmentActivityFeedProps {
    department: DepartmentType;
}
const DepartmentActivityFeed: React.FC<DepartmentActivityFeedProps> = ({ department }) => {
    const [updates, setUpdates] = useState<DepartmentUpdate[]>([]);
    const [newUpdate, setNewUpdate] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        teamService.getDepartmentUpdates(department.id)
            .then(setUpdates)
            .catch(error => {
                console.error("Failed to load department updates:", error);
                setUpdates([]);
            })
            .finally(() => setIsLoading(false));
    }, [department.id]);

    const handlePostUpdate = async (e: FormEvent) => {
        e.preventDefault();
        if (!newUpdate.trim()) return;
        setIsSubmitting(true);
        try {
            const createdUpdate = await teamService.addDepartmentUpdate(department.id, newUpdate);
            setUpdates(prev => [createdUpdate, ...prev]);
            setNewUpdate('');
        } catch (error: any) {
            console.error("Failed to post department update:", error);
            alert(`Failed to post department update: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    return (
        <div className="space-y-4">
            <form onSubmit={handlePostUpdate} className="space-y-2">
                <Textarea value={newUpdate} onChange={e => setNewUpdate(e.target.value)} placeholder="Share an update with the department..." className="input-style" rows={3} label="New Update"/>
                <div className="flex justify-end">
                    <Button type="submit" loading={isSubmitting} size="sm" disabled={!newUpdate.trim()}>Post Update</Button>
                </div>
            </form>
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2 scrollbar-thin">
                {isLoading && <p className="text-center text-muted dark:text-muted-dark">Loading updates...</p>}
                {updates.length === 0 && !isLoading && <p className="text-center text-muted dark:text-muted-dark py-4">No updates yet for this department.</p>}
                {updates.map(update => (
                    <div key={update.id} className="flex gap-3 p-3 border rounded-lg dark:border-border-dark hover:bg-surface dark:hover:bg-surface-dark/50 transition-colors">
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

// --- Child Component: ManageDepartmentMembersModal ---
interface ManageDepartmentMembersModalProps {
    isOpen: boolean;
    onClose: () => void;
    team: TeamType;
    department: DepartmentType;
    onMemberUpdate: () => Promise<void>;
    currentUser: FrontendUser;
}

const ManageDepartmentMembersModal: React.FC<ManageDepartmentMembersModalProps> = ({ 
    isOpen, 
    onClose, 
    team, 
    department, 
    onMemberUpdate, 
    currentUser 
}) => {
    const [isLoadingOp, setIsLoadingOp] = useState<Record<string, boolean>>({});
    const [currentDeptMembers, setCurrentDeptMembers] = useState(new Map(department.members.map((m: any) => [m.id, m.departmentRole])));

    // Check if current user is team owner
    const currentUserTeamMember = team.members.find(m => m.id === currentUser.id);
    const isTeamOwner = currentUserTeamMember?.role === UserRole.OWNER;

    useEffect(() => {
        setCurrentDeptMembers(new Map(department.members.map((m: any) => [m.id, m.departmentRole])));
    }, [isOpen, department.members]);

    const handleMemberToggle = async (member: TeamMember) => {
        // Only team owner can manage department members
        if (!isTeamOwner) {
            alert("Only the team owner can manage department members.");
            return;
        }

        const isInDept = currentDeptMembers.has(member.id);
        setIsLoadingOp(prev => ({ ...prev, [member.id]: true }));
        try {
            if (isInDept) {
                await teamService.removeMemberFromDepartment(department.id, member.id);
                setCurrentDeptMembers(prev => {
                    const newMap = new Map(prev);
                    newMap.delete(member.id);
                    return newMap;
                });
            } else {
                await teamService.addMemberToDepartment(department.id, member.id, DepartmentMemberRole.MEMBER);
                setCurrentDeptMembers(prev => {
                    const newMap = new Map(prev);
                    newMap.set(member.id, DepartmentMemberRole.MEMBER);
                    return newMap;
                });
            }
            await onMemberUpdate();
        } catch (e: any) {
            alert(`Error: ${e.message}`);
        } finally {
            setIsLoadingOp(prev => ({ ...prev, [member.id]: false }));
        }
    };

    const handleRoleChange = async (memberId: string, newRole: DepartmentMemberRole) => {
        // Only team owner can change roles
        if (!isTeamOwner) {
            alert("Only the team owner can change member roles.");
            return;
        }

        setIsLoadingOp(prev => ({ ...prev, [`role-${memberId}`]: true }));
        try {
            await teamService.updateDepartmentMemberRole(department.id, memberId, newRole);
            setCurrentDeptMembers(prev => {
                const newMap = new Map(prev);
                newMap.set(memberId, newRole);
                return newMap;
            });
            await onMemberUpdate();
        } catch (e: any) {
            alert(`Error: ${e.message}`);
        } finally {
            setIsLoadingOp(prev => ({ ...prev, [`role-${memberId}`]: false }));
        }
    };

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title={`Manage Members for ${department.name}`} 
            showSaveButton={false} 
            size="lg"
        >
            <div className="mb-4">
                <p className="text-sm text-muted dark:text-muted-dark">
                    Select team members to add or remove from this department. 
                    {isTeamOwner ? " You can assign multiple admins and members as needed." : " Only the team owner can manage department members."}
                </p>
                {!isTeamOwner && (
                    <div className="mt-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                        <p className="text-sm text-yellow-700 dark:text-yellow-300">
                            <strong>Note:</strong> You need to be the team owner to manage department members and roles.
                        </p>
                    </div>
                )}
            </div>

            <div className="max-h-96 overflow-y-auto space-y-2 pr-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
                {team.members.map(member => (
                    <div 
                        key={member.id} 
                        className="flex items-center justify-between p-3 bg-surface dark:bg-surface-dark rounded-lg hover:bg-surface dark:hover:bg-surface-dark/70 transition-colors"
                    >
                        <div className="flex items-center space-x-3">
                            <Checkbox
                                id={`member-toggle-${member.id}`}
                                checked={currentDeptMembers.has(member.id)}
                                onChange={() => handleMemberToggle(member)}
                                disabled={isLoadingOp[member.id] || !isTeamOwner}
                            />
                            <img 
                                src={member.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.full_name || 'U')}`} 
                                alt={member.full_name || 'Member'} 
                                className="w-9 h-9 rounded-full object-cover" 
                            />
                            <div>
                                <p className="text-sm font-medium text-text dark:text-text-dark">
                                    {member.full_name}
                                    {member.id === currentUser.id && <span className="text-xs text-muted ml-1">(You)</span>}
                                    {member.role === UserRole.OWNER && <span className="text-xs text-primary ml-1">(Team Owner)</span>}
                                </p>
                                <p className="text-xs text-muted dark:text-muted-dark">{member.email}</p>
                            </div>
                        </div>
                        
                        {currentDeptMembers.has(member.id) && (
                            <div className="flex items-center space-x-2">
                                <select
                                    value={currentDeptMembers.get(member.id) as string}
                                    onChange={(e) => handleRoleChange(member.id, e.target.value as DepartmentMemberRole)}
                                    disabled={isLoadingOp[`role-${member.id}`] || !isTeamOwner}
                                    className="text-sm border border-gray-300 dark:border-border-dark rounded-md px-2 py-1 bg-white dark:bg-card-dark text-text dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                                >
                                    <option value={DepartmentMemberRole.MEMBER}>Member</option>
                                    <option value={DepartmentMemberRole.ADMIN}>Admin</option>
                                </select>
                                
                                {isLoadingOp[`role-${member.id}`] && (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Summary section */}
            {currentDeptMembers.size > 0 && (
                <div className="mt-4 p-3 bg-gray-50 dark:bg-surface-dark rounded-lg">
                    <h4 className="text-sm font-medium text-text dark:text-text-dark mb-2">Department Summary:</h4>
                    <div className="text-xs text-muted dark:text-muted-dark space-y-1">
                        <p>Total Members: {currentDeptMembers.size}</p>
                        <p>Admins: {Array.from(currentDeptMembers.values()).filter(role => role === DepartmentMemberRole.ADMIN).length}</p>
                        <p>Members: {Array.from(currentDeptMembers.values()).filter(role => role === DepartmentMemberRole.MEMBER).length}</p>
                    </div>
                </div>
            )}
        </Modal>
    );
};


// --- Child Component: ProjectAssignmentModal ---
interface ProjectAssignmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    department: DepartmentType;
    team: TeamType;
    currentUser: FrontendUser;
    onProjectsUpdated: () => Promise<void>;
}

const ProjectAssignmentModal: React.FC<ProjectAssignmentModalProps> = ({
    isOpen, onClose, department, team, currentUser, onProjectsUpdated
}) => {
    const [availableProjects, setAvailableProjects] = useState<Project[]>([]);
    const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [scopeFilter, setScopeFilter] = useState<'team' | 'all' | 'my'>('team');

    const currentUserTeamMember = team.members.find(m => m.id === currentUser.id);
    const currentUserDeptMember = department.members.find((m:any) => m.id === currentUser.id);
    
    const isTeamOwnerOrAdmin = currentUserTeamMember?.role === UserRole.OWNER || 
                              currentUserTeamMember?.role === UserRole.ADMIN;
    const isDeptAdmin = currentUserDeptMember?.departmentRole === DepartmentMemberRole.ADMIN;
    
    const canAssignProjects = isTeamOwnerOrAdmin || isDeptAdmin;

    useEffect(() => {
        const loadAvailableProjects = async () => {
            if (!isOpen || !canAssignProjects) return;
            
            setIsLoading(true);
            try {
                let projects: Project[] = [];
                
                // Get projects based on scope
                switch (scopeFilter) {
                    case 'team':
                        if (team.id) {
                            projects = await teamService.getTeamProjects(team.id);
                        }
                        break;
                    case 'my':
                        projects = await projectService.getUserOwnedProjects(currentUser.id);
                        break;
                    case 'all':
                        projects = await projectService.getAllAccessibleProjects(currentUser.id);
                        break;
                }
                
                // Filter out projects already assigned to this department
                const currentDeptProjects = await teamService.getDepartmentProjects(department.id);
                const currentDeptProjectIds = new Set(currentDeptProjects.map(p => p.id));
                
                const unassignedProjects = projects.filter(p => !currentDeptProjectIds.has(p.id));
                setAvailableProjects(unassignedProjects);
            } catch (error) {
                console.error('Error loading available projects:', error);
                setAvailableProjects([]);
            } finally {
                setIsLoading(false);
            }
        };

        loadAvailableProjects();
    }, [isOpen, scopeFilter, team.id, department.id, currentUser.id, canAssignProjects]);

    const filteredProjects = availableProjects.filter(project =>
        project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleProjectToggle = (projectId: string) => {
        const newSelected = new Set(selectedProjects);
        if (newSelected.has(projectId)) {
            newSelected.delete(projectId);
        } else {
            newSelected.add(projectId);
        }
        setSelectedProjects(newSelected);
    };

    const handleAssignProjects = async () => {
        if (selectedProjects.size === 0) return;
        
        setIsSubmitting(true);
        try {
            // Using Promise.all for concurrent assignments
            await Promise.all(
                Array.from(selectedProjects).map(projectId =>
                    teamService.assignProjectToDepartment(department.id, projectId)
                )
            );
            
            await onProjectsUpdated();
            setSelectedProjects(new Set());
            onClose();
        } catch (error) {
            console.error('Error assigning projects:', error);
            alert('Failed to assign projects. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!canAssignProjects) {
        return null;
    }

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title={`Assign Projects to ${department.name}`}
            showSaveButton={false}
            size="xl"
        >
            <div className="space-y-6">
                <div className="text-sm text-muted dark:text-muted-dark">
                    Select existing projects to assign to this department. Only unassigned projects are shown.
                </div>
                
                {/* Filters and Search */}
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                        <Input
                            placeholder="Search projects..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            label="Search"
                        />
                    </div>
                    <div className="sm:w-48">
                         <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Scope</label>
                        <select
                            value={scopeFilter}
                            onChange={(e) => setScopeFilter(e.target.value as any)}
                            className="input-style w-full"
                        >
                            <option value="team">Team Projects</option>
                            <option value="my">My Projects</option>
                            <option value="all">All Accessible</option>
                        </select>
                    </div>
                </div>

                {/* Project List */}
                <div className="max-h-96 overflow-y-auto space-y-2 pr-2 scrollbar-thin">
                    {isLoading ? (
                        <div className="text-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto"></div>
                            <p className="text-sm text-muted dark:text-muted-dark mt-2">Loading projects...</p>
                        </div>
                    ) : filteredProjects.length === 0 ? (
                        <div className="text-center py-8 text-muted dark:text-muted-dark">
                            <BriefcaseIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            {searchTerm ? (
                                <p>No projects found matching "{searchTerm}"</p>
                            ) : (
                                <p>No projects available for assignment in the selected scope.</p>
                            )}
                        </div>
                    ) : (
                        filteredProjects.map(project => (
                            <div key={project.id} className="flex items-center justify-between p-3 border rounded-lg dark:border-border-dark hover:bg-surface dark:hover:bg-surface-dark/50 transition-colors">
                                <div className="flex items-center space-x-3 flex-1 min-w-0">
                                    <Checkbox
                                        id={`assign-project-${project.id}`}
                                        checked={selectedProjects.has(project.id)}
                                        onChange={() => handleProjectToggle(project.id)}
                                    />
                                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                                        {project.photoUrl ? (
                                            <img src={project.photoUrl} alt={project.name} className="w-8 h-8 rounded object-cover" />
                                        ) : (
                                            <div className="w-8 h-8 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                                                <BriefcaseIcon className="w-4 h-4 text-gray-500" />
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-text dark:text-text-dark truncate">{project.name}</p>
                                            <div className="flex items-center space-x-2 text-xs text-muted dark:text-muted-dark flex-wrap">
                                                <span>by {project.ownerName}</span>
                                                {project.teamName && (
                                                    <>
                                                        <span>•</span>
                                                        <span>{project.teamName}</span>
                                                    </>
                                                )}
                                                {project.dueDate && (
                                                    <>
                                                        <span>•</span>
                                                        <span>Due {new Date(project.dueDate).toLocaleDateString()}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Actions */}
                <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-border-dark">
                    <div className="text-sm text-muted dark:text-muted-dark">
                        {selectedProjects.size} project(s) selected
                    </div>
                    <div className="flex space-x-3">
                        <Button variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button 
                            onClick={handleAssignProjects}
                            disabled={selectedProjects.size === 0 || isSubmitting}
                            loading={isSubmitting}
                        >
                            Assign Selected
                        </Button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};


// --- Child Component: DepartmentSettingsTab ---
interface DepartmentSettingsTabProps {
    department: DepartmentType;
    canEdit: boolean;
    canDelete: boolean;
    onDepartmentUpdate: () => Promise<void>;
    onDepartmentDelete: () => void;
}
const DepartmentSettingsTab: React.FC<DepartmentSettingsTabProps> = ({ department, canEdit, canDelete, onDepartmentUpdate, onDepartmentDelete }) => {
    const [name, setName] = useState(department.name);
    const [description, setDescription] = useState(department.description || '');
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    const hasChanges = name !== department.name || description !== (department.description || '');

    const handleSaveChanges = async (e: FormEvent) => {
        e.preventDefault();
        if (!name.trim()) { alert("Department name cannot be empty."); return; }
        if (!canEdit) { alert("You don't have permission to perform this action. Only the team owner can edit departments."); return; }
        
        setIsSaving(true);
        try {
            await teamService.updateDepartment(department.id, { name, description });
            await onDepartmentUpdate();
            alert("Department updated successfully!");
        } catch (error: any) {
            console.error("Failed to update department:", error);
            alert(`Error updating department: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleDeleteDepartment = async () => {
        if (!canDelete) { alert("You don't have permission to perform this action. Only the team owner can delete departments."); return; }
        if (deleteConfirmationText !== `delete ${department.name}`) {
            alert("Confirmation text does not match.");
            return;
        }

        setIsDeleting(true);
        try {
            await teamService.deleteDepartment(department.id);
            alert("Department deleted successfully.");
            onDepartmentDelete(); // This will trigger the onBack navigation
        } catch (error: any) {
            console.error("Failed to delete department:", error);
            alert(`Error deleting department: ${error.message}`);
        } finally {
            setIsDeleting(false);
            setIsDeleteModalOpen(false);
            setDeleteConfirmationText('');
        }
    };
    
    useEffect(() => {
        setName(department.name);
        setDescription(department.description || '');
    }, [department]);

    return (
        <div className="space-y-8">
            <Card className="p-6">
                <h3 className="text-lg font-semibold text-text dark:text-text-dark mb-1">Department Details</h3>
                <p className="text-sm text-muted dark:text-muted-dark mb-4">Update the name and description of your department.</p>
                {canEdit ? (
                    <form onSubmit={handleSaveChanges} className="space-y-4">
                        <Input label="Department Name" value={name} onChange={e => setName(e.target.value)} required />
                        <Textarea label="Description" value={description} onChange={e => setDescription(e.target.value)} rows={4} />
                        <div className="flex justify-end">
                            <Button type="submit" loading={isSaving} disabled={!hasChanges || !name.trim()}>
                                Save Changes
                            </Button>
                        </div>
                    </form>
                ) : (
                    <div className="p-4 bg-gray-100 dark:bg-surface-dark rounded-md text-sm text-muted dark:text-muted-dark">
                        Only the team owner can edit department details.
                    </div>
                )}
            </Card>

            <Card className="p-6 border-red-500/50 dark:border-red-500/30">
                <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-1">Delete Department</h3>
                <p className="text-sm text-muted dark:text-muted-dark mb-4">
                    This action is irreversible. All associated projects will be unlinked, and all members, updates, and chat messages will be permanently removed.
                </p>
                {canDelete ? (
                     <Button variant="danger" onClick={() => setIsDeleteModalOpen(true)}>
                        Delete this Department
                    </Button>
                ) : (
                    <div className="p-4 bg-red-100/50 dark:bg-red-900/20 rounded-md text-sm text-red-700 dark:text-red-300">
                       Only the team owner can delete departments.
                    </div>
                )}
            </Card>

            <Modal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                title="Are you absolutely sure?"
                onSave={handleDeleteDepartment}
                saveLabel="Delete Department"
                saveButtonVariant="danger"
                isSaving={isDeleting}
                saveDisabled={deleteConfirmationText !== `delete ${department.name}`}
            >
                <div className="space-y-4">
                    <p className="text-sm text-text dark:text-text-dark">
                        This is a destructive action. To confirm, please type the following text in the box below:
                    </p>
                    <p className="text-center font-semibold text-red-600 dark:text-red-400 bg-red-100/50 dark:bg-red-900/20 p-2 rounded-md">
                        delete {department.name}
                    </p>
                    <Input
                        label="Confirmation Text"
                        value={deleteConfirmationText}
                        onChange={e => setDeleteConfirmationText(e.target.value)}
                        placeholder={`Type 'delete ${department.name}'`}
                    />
                </div>
            </Modal>
        </div>
    );
};

// --- Main DepartmentDetailPage Component ---
interface DepartmentDetailPageProps {
    teamId: string;
    departmentId: string;
    currentUser: FrontendUser | null;
    onBack: () => void;
}

export const DepartmentDetailPage: React.FC<DepartmentDetailPageProps> = ({ teamId, departmentId, currentUser, onBack }) => {
    const [team, setTeam] = useState<TeamType | null>(null);
    const [department, setDepartment] = useState<DepartmentType | null>(null);
    const [departmentProjects, setDepartmentProjects] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isManageMembersModalOpen, setIsManageMembersModalOpen] = useState(false);
    const [isAssignProjectModalOpen, setIsAssignProjectModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'settings'>('overview');
    const [isChatView, setIsChatView] = useState(false);
    const navigate = useNavigate();

    const fetchData = useCallback(async () => {
        if (!currentUser) return;
        // Don't set loading to true here on refetch, to avoid screen flicker
        setError(null);
        try {
            const fetchedTeam = await teamService.getTeamById(teamId, currentUser.id);
            if (!fetchedTeam) {
                throw new Error("Team not found or you don't have access.");
            }
            const fetchedDept = fetchedTeam.departments.find(d => d.id === departmentId);
            if (!fetchedDept) {
                onBack();
                return;
            }
            setTeam(fetchedTeam);
            setDepartment(fetchedDept);
        } catch (err: any) {
            setError(err.message);
        }
    }, [teamId, departmentId, currentUser, onBack]);

    const fetchDepartmentProjects = useCallback(async () => {
        if (!department?.id) return;
        try {
            const projects = await teamService.getDepartmentProjects(department.id);
            setDepartmentProjects(projects);
        } catch (error) {
            console.error("Failed to load department projects:", error);
            setDepartmentProjects([]);
        }
    }, [department?.id]);
    
    useEffect(() => {
        const initialLoad = async () => {
            setIsLoading(true);
            await fetchData();
            setIsLoading(false);
        };
        initialLoad();
    }, [fetchData]);

    useEffect(() => {
        if (department) {
            fetchDepartmentProjects();
        }
    }, [department, fetchDepartmentProjects]);

    const { isTeamOwner, canManageProjects } = useMemo(() => {
        if (!team || !department || !currentUser) {
            return { isTeamOwner: false, canManageProjects: false };
        }
        const teamMembership = team.members.find(m => m.id === currentUser.id);
        const deptMembership = department.members.find((m: any) => m.id === currentUser.id);
        
        const isDeptAdmin = deptMembership?.departmentRole === DepartmentMemberRole.ADMIN;
        const isTeamOwnerCheck = teamMembership?.role === UserRole.OWNER;
        const isTeamAdmin = teamMembership?.role === UserRole.ADMIN;
    
        return { 
            isTeamOwner: isTeamOwnerCheck || false,
            canManageProjects: isTeamOwnerCheck || isTeamAdmin || isDeptAdmin || false,
        };
    }, [team, department, currentUser]);
    
    const handleUnlinkProject = async (projectId: string) => {
        if (!canManageProjects || !department) return;
        
        const project = departmentProjects.find(p => p.id === projectId);
        if (!project) return;
    
        const confirmMessage = `Remove "${project.name}" from ${department.name}? The project will still exist but will no longer be assigned to this department.`;
        
        if (window.confirm(confirmMessage)) {
            try {
                await teamService.unlinkProjectFromDepartment(department.id, projectId);
                setDepartmentProjects(prev => prev.filter(p => p.id !== projectId));
                // No full refresh needed, just update the project list locally
            } catch (error: any) {
                console.error('Error unlinking project:', error);
                alert(`Failed to remove project from department: ${error.message}`);
            }
        }
    };

    const MemberCard = ({ member }: { member: any }) => (
        <Card className="p-3 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <img src={member.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.full_name || 'U')}`} alt={member.full_name || 'Member'} className="w-10 h-10 rounded-full object-cover" />
                    <div>
                        <p className="text-sm font-semibold text-text dark:text-text-dark">{member.full_name}</p>
                        <p className="text-xs text-muted dark:text-muted-dark">{member.email}</p>
                    </div>
                </div>
                {member.departmentRole === DepartmentMemberRole.ADMIN && (
                    <span className="text-xs font-bold text-primary dark:text-primary-light bg-primary/10 dark:bg-primary-dark/20 px-2 py-1 rounded-full">ADMIN</span>
                )}
            </div>
        </Card>
    );
    
    const TabButton = ({ label, isActive, onClick }: { label: string, isActive: boolean, onClick: () => void }) => (
        <button
            onClick={onClick}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2 ${
                isActive 
                    ? 'border-primary text-primary dark:text-primary-light' 
                    : 'border-transparent text-muted dark:text-muted-dark hover:text-text dark:hover:text-text-dark'
            }`}
        >
            {label}
        </button>
    );

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                <span className="ml-3 text-muted dark:text-muted-dark">Loading department details...</span>
            </div>
        );
    }

    if (error) {
        return <div className="p-6 text-center text-red-500">Error: {error}</div>;
    }

    if (!department || !team || !currentUser) {
        return <div className="p-6 text-center text-muted dark:text-muted-dark">Department or Team data could not be loaded.</div>;
    }
    
    // Reroute to TeamChatPage for the department
    if (isChatView) {
        const departmentAsTeamMock = {
            ...department,
            id: `department-${department.id}`, // Unique channel ID
            name: `${team.name} - ${department.name}`,
            members: department.members.map(m => ({
                id: m.id,
                full_name: m.full_name,
                email: m.email,
                avatar_url: m.avatar_url,
                role: m.role,
                joinedAt: m.joinedAt,
            }))
        } as unknown as AppTeamType;

        return <TeamChatPage team={departmentAsTeamMock} currentUser={currentUser} onBack={() => setIsChatView(false)} />
    }

    return (
        <div className="flex flex-col bg-background dark:bg-black text-text dark:text-text-dark h-full">
            <header className="flex items-center justify-between p-4 border-b dark:border-border-dark flex-shrink-0">
                <Button onClick={onBack} variant="ghost" leftIcon={<ArrowLeftIcon />} className="text-sm hover:bg-surface dark:hover:bg-surface-dark transition-colors">
                    Back to {team.name}
                </Button>
                <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-md flex items-center justify-center bg-primary/10 dark:bg-primary-dark/20">
                        <Building2Icon className="w-5 h-5 text-primary dark:text-primary-light" />
                    </div>
                    <h2 className="text-xl font-semibold truncate" title={department.name}>{department.name}</h2>
                </div>
                <div className="flex items-center space-x-2">
                    <Button onClick={() => setIsChatView(true)} size="sm" variant="outline" leftIcon={<MessageCircleIcon className="w-4 h-4"/>} className="hover:bg-primary/10 dark:hover:bg-primary-dark/20">Chat</Button>
                    <Button onClick={() => navigate(`/app/call/department-${department.id}`)} size="sm" variant="outline" leftIcon={<VideoIcon className="w-4 h-4"/>} className="hover:bg-primary/10 dark:hover:bg-primary-dark/20">Meet</Button>
                    {isTeamOwner && <Button onClick={() => setIsManageMembersModalOpen(true)} size="sm" variant="outline" leftIcon={<UserPlusIcon className="w-4 h-4"/>} className="hover:bg-primary/10 dark:hover:bg-primary-dark/20">Manage Members</Button>}
                </div>
            </header>
            
            <div className="px-4 sm:px-6 border-b dark:border-border-dark flex-shrink-0">
                <div className="flex items-center space-x-2">
                    <TabButton label="Overview" isActive={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
                    {isTeamOwner && (
                        <TabButton label="Settings" isActive={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
                    )}
                </div>
            </div>

            <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
                {activeTab === 'overview' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Left Column */}
                        <div className="lg:col-span-2 space-y-6">
                            <Card className="p-6">
                                <h3 className="text-lg font-semibold text-text dark:text-text-dark mb-2">About this Department</h3>
                                <p className="text-sm text-muted dark:text-muted-dark">
                                    {department.description || "No description provided."}
                                </p>
                            </Card>

                            <Card className="p-6">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-semibold text-text dark:text-text-dark">
                                        Assigned Projects ({departmentProjects.length})
                                    </h3>
                                    {canManageProjects && (
                                        <Button 
                                            onClick={() => setIsAssignProjectModalOpen(true)} 
                                            size="sm" 
                                            leftIcon={<LinkIcon />}
                                            className="hover:bg-primary/10 dark:hover:bg-primary-dark/20"
                                        >
                                            Assign Projects
                                        </Button>
                                    )}
                                </div>
                                {departmentProjects.length > 0 ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-2 scrollbar-thin">
                                        {departmentProjects.map(project => (
                                            <Card key={project.id} className="p-3 hover:bg-surface dark:hover:bg-surface-dark/50 transition-colors group">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                                                        {project.photoUrl ? (
                                                            <img src={project.photoUrl} alt={project.name} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                                                        ) : (
                                                            <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                                                                <BriefcaseIcon className="w-4 h-4 text-gray-500" />
                                                            </div>
                                                        )}
                                                        <div className="flex-1 min-w-0">
                                                            <h4 className="font-semibold text-text dark:text-text-dark truncate">{project.name}</h4>
                                                            <div className="flex items-center space-x-1 text-xs text-muted dark:text-muted-dark">
                                                                <span className="truncate">by {project.ownerName}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {canManageProjects && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleUnlinkProject(project.id);
                                                            }}
                                                            className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 p-1"
                                                            title="Remove from department"
                                                        >
                                                            <XMarkIcon className="w-4 h-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                                {project.description && (
                                                    <p className="text-xs text-muted dark:text-muted-dark line-clamp-2 mt-2">{project.description}</p>
                                                )}
                                            </Card>
                                        ))}
                                    </div>
                                ) : (
                                     <div className="text-center py-8">
                                         <BriefcaseIcon className="w-12 h-12 text-muted dark:text-muted-dark mx-auto mb-3 opacity-50" />
                                         <h4 className="text-md font-medium text-text dark:text-text-dark mb-1">No projects assigned</h4>
                                         <p className="text-sm text-muted dark:text-muted-dark mb-4">Assign existing projects to organize work for this department.</p>
                                         {canManageProjects && (
                                             <Button onClick={() => setIsAssignProjectModalOpen(true)} size="sm" leftIcon={<LinkIcon />}>Assign First Project</Button>
                                         )}
                                     </div>
                                )}
                            </Card>

                            <Card className="p-6">
                                <h3 className="text-lg font-semibold text-text dark:text-text-dark mb-4">Department Updates</h3>
                                <DepartmentActivityFeed department={department} />
                            </Card>
                        </div>
                        
                        {/* Right Column */}
                        <div className="lg:col-span-1 space-y-6">
                             <Card className="p-4 flex flex-col items-center justify-center text-center hover:shadow-lg transition-shadow">
                                 <UsersIcon className="w-10 h-10 text-primary mb-2" />
                                 <p className="text-4xl font-bold text-text dark:text-text-dark">{department.members.length}</p>
                                 <p className="text-sm text-muted dark:text-muted-dark">Member{department.members.length !== 1 ? 's' : ''}</p>
                            </Card>
                            
                            <Card className="p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-semibold text-text dark:text-text-dark">Members</h3>
                                    {isTeamOwner && (
                                        <Button onClick={() => setIsManageMembersModalOpen(true)} size="sm" variant="ghost" leftIcon={<UserPlusIcon className="w-4 h-4"/>} className="text-xs">Manage</Button>
                                    )}
                                </div>
                                {department.members.length > 0 ? (
                                   <div className="space-y-3 max-h-96 overflow-y-auto pr-2 scrollbar-thin">
                                        {department.members.map((member: any) => (
                                            <MemberCard key={member.id} member={member} />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8">
                                        <UsersIcon className="w-12 h-12 text-muted dark:text-muted-dark mx-auto mb-3" />
                                        <p className="text-sm text-muted dark:text-muted-dark mb-3">No members have been assigned to this department yet.</p>
                                        {isTeamOwner && (
                                            <Button onClick={() => setIsManageMembersModalOpen(true)} size="sm" leftIcon={<UserPlusIcon />}>Add Members</Button>
                                        )}
                                    </div>
                                )}
                            </Card>
                        </div>
                    </div>
                )}
                {activeTab === 'settings' && isTeamOwner && (
                    <div className="max-w-3xl mx-auto">
                        <DepartmentSettingsTab 
                            department={department}
                            canEdit={isTeamOwner}
                            canDelete={isTeamOwner}
                            onDepartmentUpdate={fetchData}
                            onDepartmentDelete={onBack}
                        />
                    </div>
                )}
            </main>

            {/* All modals are rendered here */}
            {isTeamOwner && team &&
              <ManageDepartmentMembersModal
                  isOpen={isManageMembersModalOpen}
                  onClose={() => setIsManageMembersModalOpen(false)}
                  team={team}
                  department={department}
                  onMemberUpdate={fetchData}
                  currentUser={currentUser}
              />
            }
            {canManageProjects && team && (
                <ProjectAssignmentModal
                    isOpen={isAssignProjectModalOpen}
                    onClose={() => setIsAssignProjectModalOpen(false)}
                    department={department}
                    team={team}
                    currentUser={currentUser}
                    onProjectsUpdated={async () => {
                        await fetchDepartmentProjects();
                    }}
                />
            )}
        </div>
    );
};