import { supabase } from './supabaseClient';
import {
    Project as ProjectType,
    ProjectMember,
    UserPublicProfile,
    TaskStatus,
    UserRole,
    TaskPriority,
    ProjectUpdate,
    ProjectResource,
    ResourceItem,
    GlobalSearchResultItem,
    // --> ADDED these types for the new features
    Team as TeamType,
    Department as DepartmentType,
    FrontendUser,
    DepartmentMemberRole,
    TeamPermission
} from './types';
import { Database } from './types_db';
import { teamService } from './teamService';
import { resourceService } from './resourceService';
import { BriefcaseIcon } from './constants';
import { notificationService } from './notificationService';

// Database type aliases
type DbProject = Database['public']['Tables']['projects']['Row'];
type DbUserProfile = Database['public']['Tables']['user_profiles']['Row'];
type DbProjectUpdate = Database['public']['Tables']['project_updates']['Row'];
type DbProjectResource = Database['public']['Tables']['project_resources']['Row'];

// --- NEW & ENHANCED TYPE DEFINITIONS ---
// NOTE: These should be in your types.ts file but are included here for completeness.

/**
 * Defines the scoping and visibility rules for a project.
 */
interface ProjectScope {
    type: 'individual' | 'department' | 'team' | 'cross_department';
    teamId?: string;
    departmentIds?: string[];
    visibility: 'private' | 'team_visible' | 'department_visible' | 'public';
}

/**
 * Extends the base ProjectType with scope and assignment details.
 */
interface EnhancedProjectType extends ProjectType {
    scope?: ProjectScope;
    assignedDepartments?: Array<{
        id: string;
        name: string;
    }>;
    teamInfo?: {
        teamId: string;
        teamName: string;
    };
}

/**
 * Extends the base DepartmentType with information about assigned projects.
 */
interface EnhancedDepartmentType extends DepartmentType {
    assignedProjects?: Array<{
        id: string;
        name: string;
        ownerName: string;
        dueDate?: string;
        photoUrl?: string;
    }>;
    projectCount?: number;
}

// --- HELPER FUNCTIONS ---

const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    console.error("Error getting current user:", error.message);
    throw new Error(`Authentication error: ${error.message}`);
  }
  if (!user) {
    throw new Error("User not authenticated. Please sign in.");
  }
  return user;
};

const formatSupabaseError = (error: any, context: string): string => {
    let message = `An unknown error occurred in ${context}.`;
    if (error && typeof error === 'object') {
        message = `Error in ${context}: ${error.message || 'No message'}${error.details ? ` - Details: ${error.details}` : ''}${error.hint ? ` - Hint: ${error.hint}` : ''}`;
    } else if (typeof error === 'string') {
        message = `Error in ${context}: ${error}`;
    }
    console.error(message, error);
    return message;
};

const mapUserProfileToPublicProfile = (profile: DbUserProfile | UserPublicProfile): UserPublicProfile => ({
  id: profile.id,
  full_name: profile.full_name || (profile as DbUserProfile).email?.split('@')[0] || 'User',
  email: (profile as DbUserProfile).email || 'No email provided',
  avatar_url: profile.avatar_url || null,
});

const mapDbProjectUpdateToFrontend = (dbUpdate: DbProjectUpdate, authorProfile?: UserPublicProfile): ProjectUpdate => ({
    id: dbUpdate.id,
    projectId: dbUpdate.project_id,
    authorId: dbUpdate.author_id,
    authorName: authorProfile?.full_name || 'Unknown User',
    authorAvatar: authorProfile?.avatar_url || undefined,
    content: dbUpdate.content,
    timestamp: dbUpdate.created_at,
    type: dbUpdate.type as ProjectUpdate['type'],
    relatedTaskId: dbUpdate.related_task_id || undefined,
});

const mapDbProjectResourceEntryToFrontend = (dbEntry: DbProjectResource, uploaderProfile?: UserPublicProfile): ProjectResource => ({
    id: dbEntry.id,
    projectId: dbEntry.project_id,
    name: dbEntry.name,
    type: dbEntry.type as ProjectResource['type'],
    url: dbEntry.url,
    uploadedBy: dbEntry.uploaded_by_user_id,
    uploadedByName: uploaderProfile?.full_name || 'Unknown User',
    uploadedAt: dbEntry.created_at,
    description: dbEntry.description || undefined,
    size: dbEntry.size_bytes ?? undefined,
    originalResourceId: dbEntry.original_resource_id || undefined,
});

const checkProjectAccessInternal = async (projectId: string, userId: string): Promise<{ hasAccess: boolean; userRole?: UserRole }> => {
  if (!projectId || !userId) return { hasAccess: false };

  try {
    const { data, error } = await supabase.rpc('get_project_user_role', {
      p_project_id: projectId,
      p_user_id: userId,
    });

    if (error) {
      console.error('Error checking project access via RPC:', error);
      return { hasAccess: false };
    }

    if (data) {
        return { hasAccess: true, userRole: data as UserRole };
    }

    return { hasAccess: false };
  } catch (err) {
    console.error('Exception in checkProjectAccessInternal RPC call:', err);
    return { hasAccess: false };
  }
};

const checkProjectManageAccessInternal = async (projectId: string, userId: string): Promise<{ canManage: boolean; userRole?: UserRole; }> => {
  const { hasAccess, userRole } = await checkProjectAccessInternal(projectId, userId);
  if (!hasAccess) return { canManage: false };

  const canManage = userRole === UserRole.OWNER || userRole === UserRole.ADMIN;
  return { canManage, userRole };
};

// --- PROJECT SERVICE ---

export const projectService = {

  checkProjectAccess: async (projectId: string, userId?: string): Promise<{ hasAccess: boolean; userRole?: UserRole; }> => {
    const user = userId ? { id: userId } : await getCurrentUser();
    return checkProjectAccessInternal(projectId, user.id);
  },

  checkProjectManageAccess: async (projectId: string, userId?: string): Promise<{ canManage: boolean; userRole?: UserRole; }> => {
    const user = userId ? { id: userId } : await getCurrentUser();
    return checkProjectManageAccessInternal(projectId, user.id);
  },

  async getUserProfile(userId: string): Promise<UserPublicProfile | null> {
    const { data, error } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, avatar_url')
        .eq('id', userId)
        .single();
    if (error && error.code !== 'PGRST116') {
        console.error(`Error fetching profile for user ${userId}:`, formatSupabaseError(error, 'projectService.getUserProfile'));
        return null;
    }
    return data ? mapUserProfileToPublicProfile(data) : null;
  },

  async getProjectById(projectId: string): Promise<ProjectType | null> {
    try {
      if (!projectId?.trim()) return null;

      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (projectError) {
        if (projectError.code === 'PGRST116') return null;
        throw new Error(formatSupabaseError(projectError, `projectService.getProjectById (project fetch for ${projectId})`));
      }
      if (!projectData) return null;

      // Fetch project members
      const { data: rawMembersData, error: rawMembersError } = await supabase
        .from('project_members')
        .select('user_id, role, joined_at')
        .eq('project_id', projectId);

      if (rawMembersError) {
        console.warn("Warning fetching raw project members:", formatSupabaseError(rawMembersError, `getProjectById raw members for ${projectId}`));
      }

      let members: ProjectMember[] = [];
      if (rawMembersData && rawMembersData.length > 0) {
        const memberUserIds = rawMembersData.map(m => m.user_id);

        const { data: profilesData, error: profilesError } = await supabase
          .from('user_profiles')
          .select('id, full_name, email, avatar_url')
          .in('id', memberUserIds);

        if (profilesError) {
          console.warn("Warning fetching member profiles:", formatSupabaseError(profilesError, `getProjectById member profiles for ${projectId}`));
        }

        const profilesMap = new Map<string, UserPublicProfile>();
        profilesData?.forEach(p => profilesMap.set(p.id, mapUserProfileToPublicProfile(p as DbUserProfile)));

        members = rawMembersData.map(rawMember => {
          const profile = profilesMap.get(rawMember.user_id);
          return {
            id: rawMember.user_id,
            full_name: profile?.full_name || 'Unknown User',
            email: profile?.email || 'No email',
            avatar_url: profile?.avatar_url || null,
            role: rawMember.role as UserRole,
            joinedAt: rawMember.joined_at,
          };
        });
      }

      // Fetch tasks for progress calculation
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('id, status')
        .eq('project_id', projectId);

      if (tasksError) {
        console.warn(`Warning fetching tasks for project stats: ${formatSupabaseError(tasksError, `getProjectById tasks for ${projectId}`)}`);
      }

      const totalTasks = (tasks || []).length;
      const completedTasks = (tasks || []).filter(t => t.status === TaskStatus.COMPLETED).length;
      const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      // Fetch owner's profile
      let ownerProfileDetails: UserPublicProfile | null = members.find(m => m.id === projectData.owner_id) || null;
      if (!ownerProfileDetails && projectData.owner_id) {
          ownerProfileDetails = await this.getUserProfile(projectData.owner_id);
      }

      // Fetch team name if team_id exists
      let teamName: string | undefined;
      if (projectData.team_id) {
          const team = await teamService.getTeamById(projectData.team_id);
          teamName = team?.name;
      }

      let photoUrl: string | null = projectData.photo_url || null;

      if (!photoUrl) {
        try {
          const { data: photoResource } = await supabase
            .from('project_resources')
            .select('url')
            .eq('project_id', projectId)
            .eq('description', '__project_photo__')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(); 
      
          if (photoResource) {
            photoUrl = photoResource.url;
          }
        } catch (photoFetchError) {

        }
      }

      return {
        id: projectData.id,
        name: projectData.name,
        description: projectData.description || undefined,
        ownerId: projectData.owner_id,
        ownerName: ownerProfileDetails?.full_name || 'Unknown Owner',
        members,
        teamId: projectData.team_id || undefined,
        teamName: teamName,
        dueDate: projectData.due_date || undefined,
        priority: projectData.priority as TaskPriority || undefined,
        progress,
        totalTasks,
        completedTasks,
        userId: projectData.user_id || undefined,
        createdAt: projectData.created_at,
        photoUrl: photoUrl,
      };
    } catch (error: any) {
      const errorMessage = error.message || `Failed to get project by ID ${projectId}.`;
      console.error(`Critical error in projectService.getProjectById: ${errorMessage}`, error);
      throw new Error(errorMessage);
    }
  },

  async getProjectByIdSimple(projectId: string): Promise<ProjectType | null> {
    try {
      const { data: project, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (error) {
        throw error;
      }

      if (!project) {
        return null;
      }

      return {
        id: project.id,
        name: project.name,
        description: project.description,
        ownerId: project.owner_id,
        ownerName: '',
        teamId: project.team_id,
        teamName: '',
        dueDate: project.due_date,
        priority: project.priority,
        photoUrl: project.photo_url,
        createdAt: project.created_at,
        updatedAt: project.updated_at,
        members: [],

        scope: {
          type: project.scope_type || 'individual',
          teamId: project.team_id,
          departmentIds: [],
          visibility: project.visibility || 'private'
        },
        assignedDepartments: [],
        teamInfo: undefined
      };

    } catch (error) {
      console.error('Error in getProjectByIdSimple:', error);
      throw error;
    }
  },

  async getAllProjectsForUser(currentUserId?: string): Promise<EnhancedProjectType[]> {
    try {
      const user = currentUserId ? { id: currentUserId } : await getCurrentUser();

      const { data: teamMemberships, error: teamError } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id);

      if (teamError) {
        throw new Error(formatSupabaseError(teamError, "getAllProjectsForUser (team memberships)"));
      }
      const teamIds = teamMemberships.map(tm => tm.team_id);

      const { data: projectMemberships, error: memberError } = await supabase
        .from('project_members')
        .select('project_id')
        .eq('user_id', user.id);

      if (memberError) {
        throw new Error(formatSupabaseError(memberError, "getAllProjectsForUser (project memberships)"));
      }
      const directProjectIds = projectMemberships.map(pm => pm.project_id);

      let teamProjectIds: string[] = [];
      if (teamIds.length > 0) {
        const { data: projectsInTeams, error: projectsInTeamsError } = await supabase
          .from('projects')
          .select('id')
          .in('team_id', teamIds);

        if (projectsInTeamsError) {
          console.warn(formatSupabaseError(projectsInTeamsError, "getAllProjectsForUser (fetch projects in teams)"));
        }
        teamProjectIds = projectsInTeams?.map(p => p.id) || [];
      }

      const allRelevantProjectIds = Array.from(new Set([
        ...directProjectIds,
        ...teamProjectIds
      ]));

      if (allRelevantProjectIds.length === 0) return [];

      const projectsWithDetailsPromises = allRelevantProjectIds.map(id => this.getProjectById(id));
      const projectsWithDetails = (await Promise.all(projectsWithDetailsPromises))
                                    .filter(p => p !== null) as EnhancedProjectType[];

      return projectsWithDetails;

    } catch (error: any) {
      const errorMessage = error.message || "Failed to get all projects.";
      console.error(`Critical error in projectService.getAllProjectsForUser: ${errorMessage}`, error);
      throw new Error(errorMessage);
    }
  },

  async createProject(projectData: Partial<ProjectType> & { memberIds?: string[], teamId?: string, photoFile?: File }): Promise<ProjectType> {
  try {
    if (!projectData.name?.trim()) throw new Error("Project name is required.");
    const user = await getCurrentUser();

    let photoUrl: string | null = null;

    if (projectData.photoFile && projectData.photoFile.size > 0) {
      try {
        const uploadedResource = await resourceService.uploadFile(
          projectData.photoFile,
          user.id,
          undefined,
          undefined
        );
        photoUrl = uploadedResource.publicUrl;
      } catch (uploadError) {
        console.error('Error uploading project photo:', uploadError);
        console.warn('Project will be created without photo due to upload error');
      }
    }

    const projectToInsert: Database['public']['Tables']['projects']['Insert'] = {
      name: projectData.name.trim(),
      description: projectData.description?.trim() || null,
      owner_id: user.id,
      user_id: user.id,
      due_date: projectData.dueDate || null,
      priority: projectData.priority || null,
      team_id: projectData.teamId || null,
      photo_url: photoUrl,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from('projects').insert([projectToInsert]).select().single();
    if (error) {
        throw new Error(formatSupabaseError(error, "projectService.createProject (DB insert)"));
    }

    const memberInserts: Database['public']['Tables']['project_members']['Insert'][] = [
      { project_id: data.id, user_id: user.id, role: UserRole.OWNER }
    ];

    if (projectData.memberIds && projectData.memberIds.length > 0) {
      projectData.memberIds.forEach(memberId => {
          if (memberId !== user.id) {
              memberInserts.push({ project_id: data.id, user_id: memberId, role: UserRole.MEMBER });
          }
      });
    }
    const uniqueMemberInserts = memberInserts.filter((v,i,a)=>a.findIndex(t=>(t.user_id === v.user_id))===i);

    if(uniqueMemberInserts.length > 0) {
      const { error: memberError } = await supabase.from('project_members').insert(uniqueMemberInserts);
      if (memberError) {
          console.warn(`Warning: Project created, but failed to add some members for project ${data.id}:`, formatSupabaseError(memberError, 'createProject add members'));
      }
    }

    if (projectData.photoFile && projectData.photoFile.size > 0 && photoUrl) {
      try {
        await this.addProjectListedResource(data.id, {
          name: `Project Photo - ${projectData.photoFile.name}`,
          type: 'file',
          file: projectData.photoFile,
          description: '__project_photo__'
        });
      } catch (resourceError) {
        console.warn('Project created successfully, but failed to add photo as resource:', resourceError);
      }
    }

    const fullProject = await this.getProjectById(data.id);
    if (!fullProject) throw new Error("Project created, but failed to retrieve it.");

    return fullProject;
  } catch (error: any) {
    throw new Error(error.message || "Failed to create project.");
  }
 },

  async updateProject(projectId: string, updates: Partial<ProjectType> & { memberIds?: string[], teamId?: string, photoFile?: File }): Promise<ProjectType> {
    try {
      if (!projectId?.trim()) throw new Error("Project ID is required for update.");
      const user = await getCurrentUser();

      const { canManage } = await checkProjectManageAccessInternal(projectId, user.id);
      if (!canManage) {
          throw new Error("Unauthorized: Only project owner or admin can update project settings.");
      }

      const projectToUpdate: Database['public']['Tables']['projects']['Update'] = {
        updated_at: new Date().toISOString()
      };

      if (updates.name !== undefined) {
        if(!updates.name.trim()) throw new Error("Project name cannot be empty.");
        projectToUpdate.name = updates.name.trim();
      }
      if (updates.description !== undefined) projectToUpdate.description = updates.description?.trim() || null;
      if (updates.dueDate !== undefined) projectToUpdate.due_date = updates.dueDate || null;
      if (updates.priority !== undefined) projectToUpdate.priority = updates.priority || null;
      if (updates.teamId !== undefined) projectToUpdate.team_id = updates.teamId || null;

      if (updates.photoFile) {
        try {
          const uploadedResource = await resourceService.uploadFile(
            updates.photoFile,
            user.id,
            undefined,
            projectId
          );
          projectToUpdate.photo_url = uploadedResource.publicUrl;

          try {
            const { data: existingPhotos, error: fetchPhotoError } = await supabase
                .from('project_resources')
                .select('id')
                .eq('project_id', projectId)
                .eq('description', '__project_photo__');

            if (!fetchPhotoError && existingPhotos && existingPhotos.length > 0) {
                for (const photo of existingPhotos) {
                    await this.deleteProjectListedResource(projectId, photo.id);
                }
            }
          } catch (cleanupError) {
            console.warn("Could not clean up old project photos:", cleanupError);
          }

          try {
            await this.addProjectListedResource(projectId, {
                name: `Project Photo - ${updates.photoFile.name}`,
                type: 'file',
                file: updates.photoFile,
                description: '__project_photo__'
            });
          } catch (resourceError) {
            console.warn("Photo updated successfully, but failed to add as resource:", resourceError);
          }

        } catch (uploadError) {
          console.error('Error uploading new project photo:', uploadError);
          console.warn('Project will be updated without photo due to upload error');
        }
      }

      const { data: updatedDbProject, error: updateError } = await supabase
        .from('projects')
        .update(projectToUpdate)
        .eq('id', projectId)
        .select()
        .single();

      if (updateError) {
        throw new Error(formatSupabaseError(updateError, `projectService.updateProject (DB update for project ${projectId})`));
      }

      const project = await this.getProjectById(projectId);
      if (updates.memberIds !== undefined && project?.ownerId === user.id) {
        const currentMemberIds = new Set(project.members.map(m => m.id));
        const newMemberIds = new Set(updates.memberIds);

        const toAdd = updates.memberIds.filter(id => !currentMemberIds.has(id) && id !== project.ownerId);
        const toRemove = project.members.filter(m => !newMemberIds.has(m.id) && m.role !== UserRole.OWNER).map(m => m.id);

        if (toRemove.length > 0) {
            await supabase.from('project_members').delete().eq('project_id', projectId).in('user_id', toRemove);
        }
        if (toAdd.length > 0) {
            const newMemberInserts = toAdd.map(userId => ({
              project_id: projectId,
              user_id: userId,
              role: UserRole.MEMBER as string
            }));
            const { error: memberError } = await supabase.from('project_members').insert(newMemberInserts);
            if (memberError) {
              console.warn("Warning updating project members:", formatSupabaseError(memberError, 'updateProject members'));
            }
        }
      }

      const fullProject = await this.getProjectById(projectId);
      if (!fullProject) throw new Error("Project updated, but failed to retrieve it.");
      return fullProject;
    } catch (error: any) {
      throw new Error(error.message || `Failed to update project ${projectId}.`);
    }
  },

  // =============================================
  // FIXED: deleteProject METHOD
  // =============================================
  async deleteProject(projectId: string): Promise<boolean> {
    try {
      const user = await getCurrentUser();
      const project = await this.getProjectById(projectId);
      if (!project) {
        throw new Error("Project not found or you do not have access.");
      }
      
      // Authorization Check: Only the project owner can delete the project.
      if (project.ownerId !== user.id) {
        throw new Error("Unauthorized: Only the project owner can delete the project.");
      }

      // Step 1: Delete associated files from storage via project_resources
      // This step is important to avoid orphaned files in your storage bucket.
      const projectResources = await this.getProjectResources(projectId);
      for (const res of projectResources) {
        if (res.originalResourceId) {
          const { data: mainResource } = await supabase
            .from('resources')
            .select('file_path')
            .eq('id', res.originalResourceId)
            .single();
            
          if (mainResource?.file_path) {
            await resourceService.deleteFile(res.originalResourceId, mainResource.file_path);
          }
        }
      }
      
      // Step 2: Delete records from all tables that reference the project.
      // This must be done before deleting the project itself to satisfy foreign key constraints.
      // The order of these deletions doesn't matter relative to each other.
      const deletionPromises = [
        supabase.from('project_resources').delete().eq('project_id', projectId),
        supabase.from('project_updates').delete().eq('project_id', projectId),
        supabase.from('project_members').delete().eq('project_id', projectId),
        supabase.from('tasks').delete().eq('project_id', projectId),
        // Also delete from the main 'resources' table if it has a direct link
        supabase.from('resources').delete().eq('project_id', projectId),
      ];
      
      const results = await Promise.all(deletionPromises);

      // Check for errors during the cascade delete.
      for (const result of results) {
        if (result.error) {
          throw new Error(formatSupabaseError(result.error, `deleteProject (cascade delete for project ${projectId})`));
        }
      }

      // Step 3: Once all dependencies are removed, delete the project from the 'projects' table.
      const { error: projectError } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (projectError) {
        throw new Error(formatSupabaseError(projectError, `deleteProject (final delete for project ${projectId})`));
      }

      return true;
    } catch (error: any) {
      // Catch and re-throw any errors that occur during the process.
      const errorMessage = error.message || `An unknown error occurred while deleting project ${projectId}.`;
      console.error(errorMessage, error);
      throw new Error(errorMessage);
    }
  },

  async addProjectMember(projectId: string, userIdToAdd: string, role: UserRole = UserRole.MEMBER): Promise<ProjectMember | null> {
    const user = await getCurrentUser();

    const { canManage } = await checkProjectManageAccessInternal(projectId, user.id);
    if (!canManage) {
        throw new Error("Unauthorized: Only project owner or admin can add members.");
    }

    const project = await this.getProjectById(projectId) as EnhancedProjectType;
    const existingMember = project?.members.find(m => m.id === userIdToAdd);
    if (existingMember) {
        if (existingMember.role !== role) {
            return await this.updateProjectMemberRole(projectId, userIdToAdd, role);
        }
        console.warn("User is already a member of this project with the same role.");
        return existingMember;
    }

    const { data, error } = await supabase.from('project_members').insert({ project_id: projectId, user_id: userIdToAdd, role }).select().single();
    if (error) throw new Error(formatSupabaseError(error, "addProjectMember"));

    // Send notification to the added user
    try {
      const actorProfile = await this.getUserProfile(user.id);
      const actorName = actorProfile?.full_name || 'Someone';
      const projectName = project?.name || 'Unknown Project';
      
      await notificationService.createProjectManagementNotification(
        userIdToAdd,
        'project_member_added',
        projectName,
        projectId,
        actorName
      );
    } catch (notificationError) {
      console.warn('Failed to send project member added notification:', notificationError);
    }

    const profile = await this.getUserProfile(userIdToAdd);
    if (!profile) return null;

    return { ...profile, role: data.role as UserRole, joinedAt: data.joined_at };
  },

  async removeProjectMember(projectId: string, userIdToRemove: string): Promise<boolean> {
    const user = await getCurrentUser();

    const { canManage } = await checkProjectManageAccessInternal(projectId, user.id);
    if (!canManage) {
        throw new Error("Unauthorized: Only project owner or admin can remove members.");
    }

    const project = await this.getProjectById(projectId) as EnhancedProjectType;
    const memberToRemove = project?.members.find(m => m.id === userIdToRemove);
    if (!memberToRemove) throw new Error("User is not a member of this project.");
    if (memberToRemove.role === UserRole.OWNER) throw new Error("Cannot remove the project owner. Transfer ownership first.");

    const currentUserIsOwner = project?.ownerId === user.id;
    const currentUserIsAdmin = project?.members.some(m => m.id === user.id && m.role === UserRole.ADMIN);

    if (currentUserIsAdmin && !currentUserIsOwner && (memberToRemove.role === UserRole.ADMIN)) {
        throw new Error("Unauthorized: Admins cannot remove other admins.");
    }

    const { error } = await supabase.from('project_members').delete().eq('project_id', projectId).eq('user_id', userIdToRemove);
    if (error) throw new Error(formatSupabaseError(error, "removeProjectMember"));
    
    // Send notification to the removed user
    try {
      const actorProfile = await this.getUserProfile(user.id);
      const actorName = actorProfile?.full_name || 'Someone';
      const projectName = project?.name || 'Unknown Project';
      
      await notificationService.createProjectManagementNotification(
        userIdToRemove,
        'project_member_removed',
        projectName,
        projectId,
        actorName
      );
    } catch (notificationError) {
      console.warn('Failed to send project member removed notification:', notificationError);
    }
    
    return true;
  },

  async getProjectMembers(projectId: string): Promise<ProjectMember[]> {
    const user = await getCurrentUser();

    const { hasAccess } = await checkProjectAccessInternal(projectId, user.id);
    if (!hasAccess) {
        throw new Error("Unauthorized: You don't have access to this project.");
    }

    const { data: rawMembersData, error: rawMembersError } = await supabase
      .from('project_members')
      .select('user_id, role, joined_at')
      .eq('project_id', projectId);

    if (rawMembersError) {
      throw new Error(formatSupabaseError(rawMembersError, `getProjectMembers raw members for ${projectId}`));
    }
    if (!rawMembersData || rawMembersData.length === 0) return [];

    const memberUserIds = rawMembersData.map(m => m.user_id);
    const { data: profilesData, error: profilesError } = await supabase
      .from('user_profiles')
      .select('id, full_name, email, avatar_url')
      .in('id', memberUserIds);

    if (profilesError) {
      throw new Error(formatSupabaseError(profilesError, `getProjectMembers member profiles for ${projectId}`));
    }
    if (!profilesData) return [];

    const profilesMap = new Map<string, UserPublicProfile>();
    profilesData.forEach(p => profilesMap.set(p.id, mapUserProfileToPublicProfile(p as DbUserProfile)));

    return rawMembersData.map(rawMember => {
      const profile = profilesMap.get(rawMember.user_id);
      return {
        id: rawMember.user_id,
        full_name: profile?.full_name || 'Unknown User',
        email: profile?.email || 'No email',
        avatar_url: profile?.avatar_url || null,
        role: rawMember.role as UserRole,
        joinedAt: rawMember.joined_at,
      };
    });
  },

  async updateProjectMemberRole(projectId: string, memberId: string, newRole: UserRole): Promise<ProjectMember | null> {
    const user = await getCurrentUser();

    const { canManage } = await checkProjectManageAccessInternal(projectId, user.id);
    if (!canManage) {
        throw new Error("Unauthorized: Only project owner or admin can update member roles.");
    }

    const project = await this.getProjectById(projectId) as EnhancedProjectType;
    const memberToUpdate = project?.members.find(m => m.id === memberId);
    if (!memberToUpdate) throw new Error("Member not found in project.");

    const currentUserIsOwner = project?.ownerId === user.id;
    const currentUserIsAdmin = project?.members.some(m => m.id === user.id && m.role === UserRole.ADMIN);

    if (!currentUserIsOwner) {
      if(currentUserIsAdmin && memberToUpdate.role === UserRole.MEMBER && (newRole === UserRole.ADMIN || newRole === UserRole.MEMBER)) {
        // Admin can promote member to admin or demote admin to member
      } else if (currentUserIsAdmin && memberToUpdate.role === UserRole.ADMIN && newRole === UserRole.MEMBER) {
        // Admin can demote another admin
      } else {
        throw new Error("Unauthorized: Insufficient permissions to change member role.");
      }
    }

    if (memberToUpdate.role === UserRole.OWNER && newRole !== UserRole.OWNER) {
        throw new Error("Project owner's role cannot be changed from Owner directly.");
    }
    if (memberToUpdate.role !== UserRole.OWNER && newRole === UserRole.OWNER) {
        throw new Error("Cannot promote to Owner. Transfer ownership separately.");
    }

    const { data, error } = await supabase
      .from('project_members')
      .update({ role: newRole })
      .eq('project_id', projectId)
      .eq('user_id', memberId)
      .select()
      .single();

    if (error) throw new Error(formatSupabaseError(error, "updateProjectMemberRole"));

    const profile = await this.getUserProfile(memberId);
    if (!profile) return null;

    return { ...profile, role: data.role as UserRole, joinedAt: data.joined_at };
  },

  async transferProjectOwnership(projectId: string, newOwnerId: string): Promise<EnhancedProjectType> {
    const user = await getCurrentUser();

    const project = await this.getProjectById(projectId) as EnhancedProjectType;
    if (!project) throw new Error("Project not found.");
    if (project.ownerId !== user.id) throw new Error("Unauthorized: Only current owner can transfer ownership.");

    const newOwnerMember = project.members.find(m => m.id === newOwnerId);
    if (!newOwnerMember) throw new Error("New owner must be a project member first.");

    await supabase.rpc('transfer_project_ownership', { p_project_id: projectId, p_new_owner_id: newOwnerId });

    const updatedProject = await this.getProjectById(projectId);
    if (!updatedProject) throw new Error("Project ownership transferred, but failed to retrieve updated project.");

    return updatedProject as EnhancedProjectType;
  },

  async getProjectUpdates(projectId: string): Promise<ProjectUpdate[]> {
    const user = await getCurrentUser();

    const { hasAccess } = await checkProjectAccessInternal(projectId, user.id);
    if (!hasAccess) {
        throw new Error("Unauthorized: You don't have access to this project.");
    }

    const { data: updatesData, error: updatesError } = await supabase
      .from('project_updates')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (updatesError) {
      throw new Error(formatSupabaseError(updatesError, `getProjectUpdates for ${projectId}`));
    }
    if (!updatesData || updatesData.length === 0) return [];

    const authorIds = [...new Set(updatesData.map(u => u.author_id))];
    const { data: authorsData, error: authorsError } = await supabase
      .from('user_profiles')
      .select('id, full_name, email, avatar_url')
      .in('id', authorIds);

    if (authorsError) {
      console.warn("Warning fetching update authors:", formatSupabaseError(authorsError, `getProjectUpdates authors for ${projectId}`));
    }

    const authorsMap = new Map<string, UserPublicProfile>();
    authorsData?.forEach(a => authorsMap.set(a.id, mapUserProfileToPublicProfile(a as DbUserProfile)));

    return updatesData.map(dbUpdate =>
      mapDbProjectUpdateToFrontend(dbUpdate as DbProjectUpdate, authorsMap.get(dbUpdate.author_id))
    );
  },

  async addProjectUpdate(projectId: string, updateData: Omit<Partial<ProjectUpdate>, 'id' | 'timestamp' | 'projectId' | 'authorName' | 'authorAvatar' | 'authorId'>): Promise<ProjectUpdate> {
    const user = await getCurrentUser();

    const { hasAccess } = await checkProjectAccessInternal(projectId, user.id);
    if (!hasAccess) {
        throw new Error("Unauthorized: You don't have access to this project.");
    }

    if (!updateData.content?.trim()) throw new Error("Update content is required.");

    const updateToInsert: Database['public']['Tables']['project_updates']['Insert'] = {
      project_id: projectId,
      author_id: user.id,
      content: updateData.content.trim(),
      type: updateData.type || 'general',
      related_task_id: updateData.relatedTaskId || null,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('project_updates')
      .insert([updateToInsert])
      .select()
      .single();

    if (error) throw new Error(formatSupabaseError(error, "addProjectUpdate"));

    const authorProfile = await this.getUserProfile(user.id);

    return mapDbProjectUpdateToFrontend(data as DbProjectUpdate, authorProfile);
  },

  async deleteProjectUpdate(projectId: string, updateId: string): Promise<boolean> {
    const user = await getCurrentUser();

    const { hasAccess } = await checkProjectAccessInternal(projectId, user.id);
    if (!hasAccess) {
        throw new Error("Unauthorized: You don't have access to this project.");
    }

    const { data: updateData, error: fetchError } = await supabase
      .from('project_updates')
      .select('author_id')
      .eq('id', updateId)
      .eq('project_id', projectId)
      .single();

    if (fetchError) throw new Error(formatSupabaseError(fetchError, "deleteProjectUpdate fetch"));
    if (!updateData) throw new Error("Update not found.");

    const { canManage } = await checkProjectManageAccessInternal(projectId, user.id);
    const isAuthor = updateData.author_id === user.id;

    if (!isAuthor && !canManage) {
        throw new Error("Unauthorized: You can only delete your own updates unless you're an admin/owner.");
    }

    const { error } = await supabase
      .from('project_updates')
      .delete()
      .eq('id', updateId)
      .eq('project_id', projectId);

    if (error) throw new Error(formatSupabaseError(error, "deleteProjectUpdate"));

    return true;
  },

  async getProjectResources(projectId: string): Promise<ProjectResource[]> {
    const user = await getCurrentUser();

    const { hasAccess } = await checkProjectAccessInternal(projectId, user.id);
    if (!hasAccess) {
        throw new Error("Unauthorized: You don't have access to this project.");
    }

    const { data: resourcesData, error: resourcesError } = await supabase
      .from('project_resources')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (resourcesError) {
      throw new Error(formatSupabaseError(resourcesError, `getProjectResources for ${projectId}`));
    }
    if (!resourcesData || resourcesData.length === 0) return [];

    const uploaderIds = [...new Set(resourcesData.map(r => r.uploaded_by_user_id))];
    const { data: uploadersData, error: uploadersError } = await supabase
      .from('user_profiles')
      .select('id, full_name, email, avatar_url')
      .in('id', uploaderIds);

    if (uploadersError) {
      console.warn("Warning fetching resource uploaders:", formatSupabaseError(uploadersError, `getProjectResources uploaders for ${projectId}`));
    }

    const uploadersMap = new Map<string, UserPublicProfile>();
    uploadersData?.forEach(u => uploadersMap.set(u.id, mapUserProfileToPublicProfile(u as DbUserProfile)));

    return resourcesData.map(dbResource =>
      mapDbProjectResourceEntryToFrontend(dbResource as DbProjectResource, uploadersMap.get(dbResource.uploaded_by_user_id))
    );
  },

  async addProjectListedResource(projectId: string, resourceData: { name: string; type: ProjectResource['type']; url?: string; file?: File; description?: string }): Promise<ProjectResource> {
    const user = await getCurrentUser();

    const { hasAccess } = await checkProjectAccessInternal(projectId, user.id);
    if (!hasAccess) {
        throw new Error("Unauthorized: You don't have access to this project.");
    }

    if (!resourceData.name?.trim()) throw new Error("Resource name is required.");
    if (!resourceData.url && !resourceData.file) throw new Error("Either URL or file is required.");

    let finalUrl = resourceData.url;
    let sizeBytes: number | undefined;
    let originalResourceId: string | undefined;

    if (resourceData.file) {
      const uploadedResource = await resourceService.uploadFile(resourceData.file, user.id, undefined, projectId);

      finalUrl = uploadedResource.publicUrl;
      sizeBytes = uploadedResource.sizeBytes;
      originalResourceId = uploadedResource.id;
    }

    if (!finalUrl) throw new Error("Failed to determine resource URL.");

    const resourceToInsert: Database['public']['Tables']['project_resources']['Insert'] = {
      project_id: projectId,
      name: resourceData.name.trim(),
      type: resourceData.type,
      url: finalUrl,
      uploaded_by_user_id: user.id,
      description: resourceData.description?.trim() || null,
      size_bytes: sizeBytes || null,
      original_resource_id: originalResourceId || null,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('project_resources')
      .insert([resourceToInsert])
      .select()
      .single();

    if (error) throw new Error(formatSupabaseError(error, "addProjectListedResource"));

    const uploaderProfile = await this.getUserProfile(user.id);

    return mapDbProjectResourceEntryToFrontend(data as DbProjectResource, uploaderProfile);
  },

  async deleteProjectListedResource(projectId: string, resourceId: string): Promise<boolean> {
    const user = await getCurrentUser();

    const { hasAccess } = await checkProjectAccessInternal(projectId, user.id);
    if (!hasAccess) {
        throw new Error("Unauthorized: You don't have access to this project.");
    }

    const { data: resourceData, error: fetchError } = await supabase
      .from('project_resources')
      .select('uploaded_by_user_id, original_resource_id')
      .eq('id', resourceId)
      .eq('project_id', projectId)
      .single();

    if (fetchError) throw new Error(formatSupabaseError(fetchError, "deleteProjectListedResource fetch"));
    if (!resourceData) throw new Error("Resource not found.");

    const { canManage } = await checkProjectManageAccessInternal(projectId, user.id);
    const isUploader = resourceData.uploaded_by_user_id === user.id;

    if (!isUploader && !canManage) {
        throw new Error("Unauthorized: You can only delete resources you uploaded unless you're an admin/owner.");
    }

    if (resourceData.original_resource_id) {
      try {
        const mainResource = await supabase.from('resources').select('file_path').eq('id', resourceData.original_resource_id).maybeSingle();
        if (mainResource.data) {
          await resourceService.deleteFile(resourceData.original_resource_id, mainResource.data.file_path);
        }
      } catch (error) {
        console.warn("Warning: Could not delete main resource file:", error);
      }
    }

    const { error } = await supabase
      .from('project_resources')
      .delete()
      .eq('id', resourceId)
      .eq('project_id', projectId);

    if (error) throw new Error(formatSupabaseError(error, "deleteProjectListedResource"));

    return true;
  },

  async search(query: string, currentUserId?: string): Promise<GlobalSearchResultItem[]> {
    if (!query?.trim()) return [];

    try {
      const user = currentUserId ? { id: currentUserId } : await getCurrentUser();
      const userProjects = await this.getAllProjectsForUser();

      const searchTerms = query.toLowerCase().trim().split(/\s+/);

      const matchingProjects = userProjects.filter(project => {
        if(!project) return false;
        const searchableText = [
          project.name,
          project.description || '',
          project.ownerName,
          project.teamName || '',
          ...project.members.map(m => m.full_name || ''),
          ...project.members.map(m => m.email || '')
        ].join(' ').toLowerCase();

        return searchTerms.every(term => searchableText.includes(term));
      });

      return matchingProjects.map(project => ({
        id: project.id,
        title: project.name,
        description: project.description || `Project owned by ${project.ownerName}`,
        type: 'project' as const,
        path: `/app/collaboration`,
        state: { openProjectDetail: true, projectId: project.id },
        icon: BriefcaseIcon,
        metadata: {
          owner: project.ownerName,
          memberCount: project.members.length,
          progress: (project as any).progress,
          dueDate: project.dueDate
        }
      }));
    } catch (error) {
      console.error("Error searching projects:", error);
      return [];
    }
  },

  async getProjectStats(projectId: string): Promise<{
    totalTasks: number;
    completedTasks: number;
    overdueTasks: number;
    progress: number;
    memberCount: number;
    recentUpdates: number;
  }> {
    const user = await getCurrentUser();

    const { hasAccess } = await checkProjectAccessInternal(projectId, user.id);
    if (!hasAccess) {
        throw new Error("Unauthorized: You don't have access to this project.");
    }

    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('id, status, due_date')
      .eq('project_id', projectId);

    if (tasksError) {
      console.warn("Error fetching tasks for stats:", formatSupabaseError(tasksError, "getProjectStats tasks"));
    }

    const totalTasks = tasks?.length || 0;
    const completedTasks = tasks?.filter(t => t.status === TaskStatus.COMPLETED).length || 0;
    const overdueTasks = tasks?.filter(t =>
      t.due_date && new Date(t.due_date) < new Date() && t.status !== TaskStatus.COMPLETED
    ).length || 0;
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const { count: memberCount, error: memberCountError } = await supabase
      .from('project_members')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId);

    if (memberCountError) {
      console.warn("Error fetching member count:", formatSupabaseError(memberCountError, "getProjectStats members"));
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { count: recentUpdates, error: updatesError } = await supabase
      .from('project_updates')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .gte('created_at', sevenDaysAgo.toISOString());

    if (updatesError) {
      console.warn("Error fetching recent updates count:", formatSupabaseError(updatesError, "getProjectStats updates"));
    }

    return {
      totalTasks,
      completedTasks,
      overdueTasks,
      progress,
      memberCount: memberCount || 0,
      recentUpdates: recentUpdates || 0
    };
  },

  async getProjectsForTeam(teamId: string): Promise<EnhancedProjectType[]> {
    if (!teamId) return [];
    const { data, error } = await supabase.from('projects').select('id').eq('team_id', teamId);
    if (error) {
      console.error(formatSupabaseError(error, 'getProjectsForTeam'));
      return [];
    }
    const projectIds = data.map(p => p.id);
    const projects = await Promise.all(projectIds.map(id => this.getProjectById(id)));
    return projects.filter(p => p !== null) as EnhancedProjectType[];
  },

  async getProjectsAvailableForLinking(teamId: string): Promise<EnhancedProjectType[]> {
    const user = await getCurrentUser();
    const { data, error } = await supabase.from('projects').select('id').is('team_id', null).eq('owner_id', user.id);
    if (error) {
      console.error(formatSupabaseError(error, 'getProjectsAvailableForLinking'));
      return [];
    }
    const projectIds = data.map(p => p.id);
    const projects = await Promise.all(projectIds.map(id => this.getProjectById(id)));
    return projects.filter(p => p !== null) as EnhancedProjectType[];
  },

  async linkProjectToTeam(projectId: string, teamId: string): Promise<EnhancedProjectType | null> {
    const { data, error } = await supabase.from('projects').update({ team_id: teamId }).eq('id', projectId).select().single();
    if (error) {
        throw new Error(formatSupabaseError(error, 'linkProjectToTeam'));
    }

    const teamMembers = await teamService.getTeamMembers(teamId);
    const project = await this.getProjectById(projectId);

    if (project && teamMembers) {
        for (const member of teamMembers) {
            if (member.id !== project.ownerId) {
                await this.addProjectMember(projectId, member.id, UserRole.MEMBER);
            }
        }
    }

    return this.getProjectById(data.id) as Promise<EnhancedProjectType | null>;
  },

  async unlinkProjectFromTeam(projectId: string): Promise<EnhancedProjectType | null> {
    const { data, error } = await supabase.from('projects').update({ team_id: null }).eq('id', projectId).select().single();
    if (error) {
      throw new Error(formatSupabaseError(error, 'unlinkProjectFromTeam'));
    }
    return this.getProjectById(data.id) as Promise<EnhancedProjectType | null>;
  },

  async getUserOwnedProjects(userId: string): Promise<EnhancedProjectType[]> {
    try {
        const { data, error } = await supabase
            .from('projects')
            .select('id')
            .eq('owner_id', userId);

        if (error) {
            throw new Error(formatSupabaseError(error, 'getUserOwnedProjects'));
        }

        const projectIds = data.map(p => p.id);
        const projects = await Promise.all(projectIds.map(id => this.getProjectById(id)));
        return projects.filter(p => p !== null) as EnhancedProjectType[];
    } catch (error: any) {
        console.error('Error fetching user owned projects:', error);
        throw error;
    }
  },

  async getAllAccessibleProjects(userId: string): Promise<EnhancedProjectType[]> {
      try {
          return this.getAllProjectsForUser(userId);
      } catch (error) {
          console.error('Error fetching accessible projects:', error);
          throw error;
      }
  },

  async getProjectsByScope(
      userId: string,
      scope: 'my' | 'team' | 'department' | 'all',
      teamId?: string,
      departmentId?: string
  ): Promise<EnhancedProjectType[]> {
      try {
          if (scope === 'all') {
              return this.getAllAccessibleProjects(userId);
          }

          let query = supabase.from('projects').select('id');
          switch (scope) {
              case 'my':
                  query = query.eq('owner_id', userId);
                  break;
              case 'team':
                  if (!teamId) throw new Error("Team ID is required for 'team' scope.");
                  query = query.eq('team_id', teamId);
                  break;
              case 'department':
                  if (!departmentId) throw new Error("Department ID is required for 'department' scope.");
                  query = query.contains('department_ids', [departmentId]);
                  break;
          }

          const { data, error } = await query;
          if (error) {
              throw new Error(formatSupabaseError(error, `getProjectsByScope (${scope})`));
          }

          const projectIds = data.map(p => p.id);
          const projects = await Promise.all(projectIds.map(id => this.getProjectById(id)));
          return projects.filter(p => p !== null) as EnhancedProjectType[];
      } catch (error) {
          console.error('Error fetching projects by scope:', error);
          throw error;
      }
  },

  async updateProjectScope(projectId: string, scopeUpdate: {
      departmentIds?: string[];
      teamId?: string;
      visibility?: 'private' | 'team_visible' | 'department_visible' | 'public';
  }): Promise<EnhancedProjectType> {
      try {
          const user = await getCurrentUser();
          const { canManage } = await checkProjectManageAccessInternal(projectId, user.id);
          if (!canManage) {
              throw new Error("Unauthorized: You do not have permission to update this project's scope.");
          }

          const updatePayload: { [key: string]: any } = { updated_at: new Date().toISOString() };
          if (scopeUpdate.departmentIds !== undefined) updatePayload.department_ids = scopeUpdate.departmentIds;
          if (scopeUpdate.teamId !== undefined) updatePayload.team_id = scopeUpdate.teamId;
          if (scopeUpdate.visibility !== undefined) updatePayload.visibility = scopeUpdate.visibility;

          const { error } = await supabase
              .from('projects')
              .update(updatePayload)
              .eq('id', projectId);

          if (error) {
              const errorMessage = formatSupabaseError(error, 'updateProjectScope');
              throw new Error(errorMessage || 'Failed to update project scope');
          }

          const updatedProject = await this.getProjectById(projectId);
          if (!updatedProject) {
              throw new Error("Scope updated, but failed to retrieve the project afterwards.");
          }
          return updatedProject as EnhancedProjectType;
      } catch (error) {
          console.error('Error updating project scope:', error);
          throw error;
      }
  },
};

export const ProjectPermissions = {
    canAssignProjects(user: FrontendUser, team: TeamType, department?: DepartmentType): boolean {
        const teamMembership = team.members.find(m => m.id === user.id);

        if (teamMembership?.role === UserRole.OWNER || teamMembership?.role === UserRole.ADMIN) {
            return true;
        }

        if(department) {
          const deptMembership = department.members.find((m: any) => m.id === user.id);
          if (deptMembership?.departmentRole === DepartmentMemberRole.ADMIN) {
              return true;
          }
        }

        return false;
    },

    canCreateTeamProjects(user: FrontendUser, team: TeamType): boolean {
        const teamMembership = team.members.find(m => m.id === user.id);

        return !!(teamMembership && (
               teamMembership.role === UserRole.OWNER ||
               teamMembership.role === UserRole.ADMIN ||
               (teamMembership.permissions as any)?.includes('CAN_MANAGE_PROJECTS' as TeamPermission)
        ));
    },

    canViewTeamProjects(user: FrontendUser, team: TeamType): boolean {
        return team.members.some(m => m.id === user.id);
    },

    canViewDepartmentProjects(user: FrontendUser, department: DepartmentType): boolean {
        return department.members.some((m: any) => m.id === user.id);
    },
};
// Add this to the END of your projectService.js file (after the export)

// DEBUG FUNCTION - Add this temporarily to your projectService.js
// Add this to your projectService.js to test the actual functions that might be failing

export const testActualFunctionality = async () => {

  try {
    // Test 1: Test the actual getTeamById function

    const teams = await teamService.getAllTeamsForUser();

    if (teams.length > 0) {
      const firstTeam = teams[0];

      // Test the specific team that was failing
      const teamDetail = await teamService.getTeamById(firstTeam.id);

    }
    
    // Test 2: Test project functionality

    const projects = await projectService.getAllProjectsForUser();

    if (projects.length > 0) {
      const firstProject = projects[0];

      // Test specific project that was failing
      const projectDetail = await projectService.getProjectById(firstProject.id);

    }
    
    // Test 3: Check if any of the photo URLs are working

    // Find any resources with team photos
    const { data: teamPhotos } = await supabase
      .from('resources')
      .select('file_path, team_id')
      .eq('is_team_photo', true)
      .limit(3);

    if (teamPhotos && teamPhotos.length > 0) {
      for (const photo of teamPhotos) {
        const { data: urlData } = supabase.storage.from('resources').getPublicUrl(photo.file_path);

        // Test if the URL is accessible
        try {
          const response = await fetch(urlData.publicUrl, { method: 'HEAD' });

        } catch (fetchError) {

        }
      }
    }
    
  } catch (error) {
    console.error('Functionality test error:', error);
  }
};