import { supabase } from './supabaseClient';
import { TeamType as AppTeamType, TeamMember, DepartmentType, UserPublicProfile, UserRole, TeamIconName, TaskStatus, TeamPermission, GlobalSearchResultItem, TeamInviteWithTeamDetails, TeamUpdate, TeamChatMessage, DepartmentUpdate, DepartmentChatMessage, DepartmentMemberRole, Project, TeamInvite } from './types';
import { Database } from './types_db';
import { TEAM_PERMISSIONS, TeamIcon } from './constants';
import { RealtimeChannel } from '@supabase/supabase-js';
import { projectService } from './projectService';
import { notificationService } from './notificationService';

type DbTeam = Database['public']['Tables']['teams']['Row'];
type DbTeamMember = Database['public']['Tables']['team_members']['Row'];
type DbDepartment = Database['public']['Tables']['departments']['Row'];
type DbDepartmentMember = Database['public']['Tables']['department_members']['Row'] & { role: DepartmentMemberRole };
type DbUserProfile = Database['public']['Tables']['user_profiles']['Row'];
type DbProject = Database['public']['Tables']['projects']['Row'];
type DbTask = Database['public']['Tables']['tasks']['Row'];
type DbTeamUpdate = Database['public']['Tables']['team_updates']['Row'];
type DbTeamChatMessage = Database['public']['Tables']['team_chat_messages']['Row'];
type DbDepartmentUpdate = Database['public']['Tables']['department_updates']['Row'];
type DbDepartmentChatMessage = Database['public']['Tables']['department_chat_messages']['Row'];
type DbTeamInvite = Database['public']['Tables']['team_invites']['Row'];

const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    console.error("Error getting current user for team service:", error.message);
    throw new Error(`Authentication error: ${error.message}`);
  }
  if (!user) {
    throw new Error("User not authenticated for team operations.");
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

const mapUserProfileToPublicProfile = (profile: DbUserProfile): UserPublicProfile => ({
  id: profile.id,
  full_name: profile.full_name || (profile as any).email?.split('@')[0] || 'User',
  email: profile.email || 'No email provided',
  avatar_url: profile.avatar_url || null,
});

const mapDbDepartmentToFrontend = (dbDept: DbDepartment, members: (TeamMember & { departmentRole: DepartmentMemberRole })[] = [], projects: Project[] = []): DepartmentType => ({
    id: dbDept.id,
    name: dbDept.name,
    teamId: dbDept.team_id,
    description: dbDept.description || undefined,
    members: members, // Now includes role
    admins: members.filter(m => m.departmentRole === DepartmentMemberRole.ADMIN),
    projects: projects,
});

const getDefaultPermissionsForRole = (role: UserRole): TeamPermission[] => {
  switch (role) {
    case UserRole.OWNER:
      return Object.keys(TEAM_PERMISSIONS) as TeamPermission[];
    case UserRole.ADMIN:
      return (Object.keys(TEAM_PERMISSIONS) as TeamPermission[]).filter(p => p !== 'CAN_DELETE_TEAM');
    case UserRole.MEMBER:
      return ['CAN_MANAGE_PROJECTS']; // Base permission, can be overridden
    default:
      return [];
  }
};

const fetchProfilesForIds = async (userIds: string[]): Promise<Map<string, UserPublicProfile>> => {
    if (userIds.length === 0) return new Map();
    const uniqueIds = [...new Set(userIds)];
    
    // First try to get profiles from user_profiles table
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, full_name, email, avatar_url')
      .in('id', uniqueIds);

    if (error) {
      console.warn("Failed to fetch some user profiles:", error);
      return new Map();
    }

    const profileMap = new Map<string, UserPublicProfile>();
    
    // Add found profiles to map
    if (data) {
        data.forEach(profile => {
            profileMap.set(profile.id, mapUserProfileToPublicProfile(profile as DbUserProfile));
        });
    }

    // For any missing profiles, create basic ones (users might not have profiles yet)
    const foundIds = new Set(data?.map(p => p.id) || []);
    uniqueIds.forEach(id => {
        if (!foundIds.has(id)) {
            profileMap.set(id, {
                id,
                full_name: 'Unknown User',
                email: 'No email provided',
                avatar_url: null,
            });
        }
    });

    return profileMap;
};

// Helper function to validate and fix ownership consistency
const validateTeamOwnership = async (teamId: string): Promise<{ isConsistent: boolean; fixed?: boolean; error?: string }> => {
  try {
    // Get team owner_id
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('owner_id')
      .eq('id', teamId)
      .single();

    if (teamError || !team) {
      return { isConsistent: false, error: "Team not found" };
    }

    // Get all members with OWNER role
    const { data: ownerMembers, error: ownersError } = await supabase
      .from('team_members')
      .select('user_id, role')
      .eq('team_id', teamId)
      .eq('role', UserRole.OWNER);

    if (ownersError) {
      return { isConsistent: false, error: "Failed to check team members" };
    }

    const ownerCount = ownerMembers?.length || 0;
    const teamOwnerHasOwnerRole = ownerMembers?.some(m => m.user_id === team.owner_id);

    // Check for inconsistencies
    if (ownerCount === 0) {
      console.log(`🔧 Team ${teamId} has no owner members. Fixing silently...`);
      // Fix: Make team owner_id have OWNER role
      const { error: fixError } = await supabase
        .from('team_members')
        .update({ 
          role: UserRole.OWNER,
          permissions: Object.keys(TEAM_PERMISSIONS) as TeamPermission[]
        })
        .eq('team_id', teamId)
        .eq('user_id', team.owner_id);
      
      if (fixError) {
        console.error(`❌ Failed to fix team ${teamId} ownership:`, fixError);
        return { isConsistent: false, error: "Failed to fix ownership" };
      }
      
      console.log(`✅ Fixed team ${teamId} ownership successfully`);
      return { isConsistent: false, fixed: true };
    }

    if (ownerCount > 1) {
      console.log(`🔧 Team ${teamId} has multiple owners. Fixing silently...`);
      // Fix: Remove OWNER role from everyone except team.owner_id
      const { error: fixError } = await supabase
        .from('team_members')
        .update({ 
          role: UserRole.ADMIN,
          permissions: (Object.keys(TEAM_PERMISSIONS) as TeamPermission[]).filter(p => p !== 'CAN_DELETE_TEAM')
        })
        .eq('team_id', teamId)
        .eq('role', UserRole.OWNER)
        .neq('user_id', team.owner_id);
      
      if (fixError) {
        console.error(`❌ Failed to fix team ${teamId} multiple owners:`, fixError);
        return { isConsistent: false, error: "Failed to fix multiple owners" };
      }
      
      console.log(`✅ Fixed team ${teamId} multiple owners successfully`);
      return { isConsistent: false, fixed: true };
    }

    if (!teamOwnerHasOwnerRole) {
      console.log(`🔧 Team ${teamId} owner doesn't have OWNER role. Fixing silently...`);
      // Fix: Update team.owner_id to have OWNER role and update teams table if needed
      const currentOwner = ownerMembers[0];
      const { error: fixError } = await supabase
        .from('teams')
        .update({ owner_id: currentOwner.user_id })
        .eq('id', teamId);
      
      if (fixError) {
        console.error(`❌ Failed to fix team ${teamId} owner role:`, fixError);
        return { isConsistent: false, error: "Failed to fix owner role" };
      }
      
      console.log(`✅ Fixed team ${teamId} owner role successfully`);
      return { isConsistent: false, fixed: true };
    }

    return { isConsistent: true };
  } catch (error: any) {
    return { isConsistent: false, error: error.message };
  }
};

export const teamService = {
  // Ownership validation helper
  validateTeamOwnership,

  // **FIXED FUNCTION**
  async testInviteQuery(inviteCode: string): Promise<any> {

    try {
        // Test 1: Basic query to see if table is accessible
        const { data: allInvites, error: allError } = await supabase
            .from('team_invites')
            .select('invite_code, team_id')
            .limit(5);

        // Test 2: Query for specific invite code
        const { data: specificInvite, error: specificError } = await supabase
            .from('team_invites')
            .select('*')
            .eq('invite_code', inviteCode)
            .single();

        // Test 3: Query with teams join
        const { data: joinedQuery, error: joinError } = await supabase
            .from('team_invites')
            .select(`
                id,
                team_id,
                invite_code,
                teams!inner (
                    id,
                    name
                )
            `)
            .eq('invite_code', inviteCode)
            .single();

        return {
            allInvites: { data: allInvites, error: allError },
            specificInvite: { data: specificInvite, error: specificError },
            joinedQuery: { data: joinedQuery, error: joinError }
        };
        
    } catch (error) {
        console.error('Test query exception:', error);
        return { exception: error };
    }
  },
  async findOrCreateTeamRootFolder(teamId: string, teamName: string, userId: string): Promise<{ id: string }> {
    // 1. Check if a root folder for the team already exists.
    const { data: existingFolder, error: findError } = await supabase
        .from('resources')
        .select('id')
        .eq('team_id', teamId)
        .is('parent_folder_id', null)
        .eq('resource_type', 'folder')
        .limit(1)
        .single();

    if (findError && findError.code !== 'PGRST116') {
        throw new Error(formatSupabaseError(findError, 'findOrCreateTeamRootFolder (find)'));
    }

    // 2. If it exists, return it.
    if (existingFolder) {
        return existingFolder;
    }

    // 3. If it doesn't exist, create it with a defined file_path.
    // This path is a logical representation of the folder's location.
    const folderPath = `public/${userId}/teams/${teamId}/`; // The path for the folder itself

    const { data: newFolder, error: insertError } = await supabase
        .from('resources')
        .insert({
            team_id: teamId,
            file_name: teamName, // The folder is displayed with the team's name
            file_path: folderPath, // **CRITICAL FIX**: Assign a path to the folder resource
            resource_type: 'folder',
            uploaded_by: userId,
            bucket_name: 'resources',
            size_bytes: 0,
            mime_type: 'application/x-directory', // A conventional MIME type for folders
            parent_folder_id: null,
        })
        .select('id')
        .single();
    
    if (insertError) throw new Error(formatSupabaseError(insertError, 'findOrCreateTeamRootFolder (insert)'));
    if (!newFolder) throw new Error('Failed to create team root folder.');

    return newFolder;
  },

  async getUserProfile(userId: string): Promise<UserPublicProfile | null> {
    const { data, error } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, avatar_url, updated_at')
        .eq('id', userId)
        .single();
    if (error && error.code !== 'PGRST116') {
        console.error(`Error fetching profile for user ${userId}:`, formatSupabaseError(error, 'teamService.getUserProfile'));
        return null;
    }
    return data ? mapUserProfileToPublicProfile(data) : null;
  },

  async createTeam(name: string, description?: string, iconSeed?: TeamIconName, photoFile?: File): Promise<AppTeamType> {
    const user = await getCurrentUser();
    const teamToInsert: Database['public']['Tables']['teams']['Insert'] = {
      name: name.trim(),
      description: description?.trim() || null,
      owner_id: user.id,
      icon_seed: iconSeed || 'Users',
    };

    const { data: teamData, error: teamError } = await supabase
      .from('teams')
      .insert(teamToInsert)
      .select('id')
      .single();

    if (teamError) throw new Error(formatSupabaseError(teamError, "teamService.createTeam (insert)"));
    if (!teamData) throw new Error("Failed to create team: No data returned after insert.");

    // Add owner as team member first
    const ownerPermissions = getDefaultPermissionsForRole(UserRole.OWNER);
    const { error: memberError } = await supabase.from('team_members').insert({
        team_id: teamData.id,
        user_id: user.id,
        role: UserRole.OWNER,
        permissions: ownerPermissions,
    });
    if (memberError) console.error(`CRITICAL: Team created but failed to add owner as member: ${formatSupabaseError(memberError, "createTeam add owner")}`);

    // Create team root folder first. This now happens after the team is successfully created.
    const teamRootFolder = await this.findOrCreateTeamRootFolder(teamData.id, name.trim(), user.id);

    if (photoFile) {
        const fileExt = photoFile.name.split('.').pop()?.toLowerCase() || 'png';
        const uniqueFileName = `team-photo-${Date.now()}.${fileExt}`;
        
        // The file path is now correctly nested inside the folder's path
        const filePath = `public/${user.id}/teams/${teamData.id}/${uniqueFileName}`;
        
        const { error: uploadError } = await supabase.storage.from('resources').upload(filePath, photoFile);

        if (uploadError) {
            console.warn(`Team was created, but photo upload failed: ${uploadError.message}`);
        } else {
            // Save the photo as a resource INSIDE the team's root folder
            const { error: resourceError } = await supabase.from('resources').insert({
                bucket_name: 'resources',
                file_name: `${name.trim()} Team Photo.${fileExt}`,
                file_path: filePath,
                mime_type: photoFile.type || 'application/octet-stream',
                size_bytes: photoFile.size,
                resource_type: 'image',
                uploaded_by: user.id,
                team_id: teamData.id,
                parent_folder_id: teamRootFolder.id,
                is_team_photo: true, // KEY CHANGE: Place inside team folder
            });
            
            if (resourceError) {
                console.warn(`Team photo uploaded, but failed to save resource metadata: ${resourceError.message}`);
                await supabase.storage.from('resources').remove([filePath]);
            }
        }
    }

    const newTeam = await this.getTeamById(teamData.id);
    if (!newTeam) throw new Error("Team created, but failed to retrieve its details.");
    return newTeam;
  },

  async getTeamById(teamId: string, forUserId?: string): Promise<AppTeamType | null> {
    const { data: teamData, error: teamError } = await supabase
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .single();

    if (teamError) {
      if (teamError.code === 'PGRST116') return null;
      throw new Error(formatSupabaseError(teamError, `teamService.getTeamById (team fetch for ${teamId})`));
    }
    if (!teamData) return null;

    // Validate and fix ownership consistency
    try {
      const ownershipCheck = await validateTeamOwnership(teamId);
      if (!ownershipCheck.isConsistent && ownershipCheck.fixed) {

      } else if (!ownershipCheck.isConsistent && ownershipCheck.error) {
        console.warn(`Could not fix ownership for team ${teamId}: ${ownershipCheck.error}`);
      }
    } catch (ownershipError) {
      console.warn(`Ownership validation failed for team ${teamId}:`, ownershipError);
    }

    const { data: teamMembersData, error: teamMembersError } = await supabase
        .from('team_members')
        .select('user_id, role, joined_at, tags, permissions')
        .eq('team_id', teamId);

    if (teamMembersError) console.warn(`Warning fetching team members for team ${teamId}: ${formatSupabaseError(teamMembersError, "getTeamById team members")}`);

    let members: TeamMember[] = [];
    let currentUserTeamRole: UserRole | undefined;

    if (teamMembersData && teamMembersData.length > 0) {
      const userIds = teamMembersData.map(tm => tm.user_id);
      const profilesMap = await fetchProfilesForIds(userIds);

      teamMembersData.forEach(member => {
        const profile = profilesMap.get(member.user_id);
        if (profile) {
            members.push({
                ...profile,
                role: member.role as UserRole,
                joinedAt: member.joined_at,
                tags: member.tags || [],
                permissions: (member.permissions as TeamPermission[]) || getDefaultPermissionsForRole(member.role as UserRole),
            });
            if (forUserId && member.user_id === forUserId) {
                currentUserTeamRole = member.role as UserRole;
            }
        }
      });
    }

    // Fetch departments with proper visibility filtering
    const { data: departmentsData, error: deptsError } = await supabase.from('departments').select('*').eq('team_id', teamId);
    let departments: DepartmentType[] = [];
    if (!deptsError && departmentsData) {
        // Decide which departments to show
        let visibleDepartments = departmentsData;
        if (forUserId && currentUserTeamRole && ![UserRole.OWNER, UserRole.ADMIN].includes(currentUserTeamRole)) {
            // Filter departments for regular members
            const { data: memberDepts } = await supabase.from('department_members').select('department_id').eq('user_id', forUserId);
            const memberDeptIds = new Set(memberDepts?.map(d => d.department_id) || []);
            visibleDepartments = departmentsData.filter(d => memberDeptIds.has(d.id));
        }

        const departmentPromises = visibleDepartments.map(async (dept) => {
            const { data: deptMemberLinks, error: deptMembersError } = await supabase
                .from('department_members')
                .select('user_id, role')
                .eq('department_id', dept.id);

            let memberProfilesWithDeptRole: (TeamMember & { departmentRole: DepartmentMemberRole })[] = [];
            if (deptMemberLinks && deptMemberLinks.length > 0) {
                const memberUserIds = deptMemberLinks.map(link => link.user_id);
                // We can reuse the already fetched team members' profiles to be more efficient
                memberProfilesWithDeptRole = members
                    .filter(m => memberUserIds.includes(m.id))
                    .map(m => ({
                        ...m,
                        departmentRole: deptMemberLinks.find(link => link.user_id === m.id)!.role as DepartmentMemberRole,
                    }));
            }
            if (deptMembersError) console.error(`Failed to fetch department member links for dept ${dept.id}:`, deptMembersError);

            // Fetch projects for this department
            const { data: projectsData } = await supabase.from('projects').select('*').eq('department_id', dept.id);

            return mapDbDepartmentToFrontend(dept, memberProfilesWithDeptRole, (projectsData as Project[]) || []);
        });
        departments = await Promise.all(departmentPromises);
    }

    const ownerProfile = members.find(m => m.id === teamData.owner_id) || await this.getUserProfile(teamData.owner_id);

    let photoUrl: string | null = null;
    // Look for team photos specifically - only images explicitly marked as team profile photos
    const { data: photoResource } = await supabase
        .from('resources')
        .select('file_path')
        .eq('team_id', teamId)
        .eq('resource_type', 'image')
        .eq('is_team_photo', true) // Only get images explicitly marked as team photos
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (photoResource) {
        const { data: urlData } = supabase.storage.from('resources').getPublicUrl(photoResource.file_path);
        photoUrl = urlData.publicUrl;
    }
    
    // **FIXED LOGIC**: Calculate project count directly from the projects table for accuracy
    const { count: projectsCount, error: projectsError } = await supabase
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('team_id', teamId);
    
    if (projectsError) {
        console.warn(`Could not accurately count projects for team ${teamId}:`, projectsError);
    }

    // Calculate task counts (if task tracking is needed)
    // Calculate task counts correctly through projects relationship
    // First get all project IDs for this team
    const { data: teamProjects } = await supabase
    .from('projects')
    .select('id')
    .eq('team_id', teamId);

    let tasksCount = 0;
    let completedTasksCount = 0;

    if (!projectsError && teamProjects && teamProjects.length > 0) {
    const projectIds = teamProjects.map(p => p.id);

    // Count total tasks in team projects
    const { count: totalTasks } = await supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .in('project_id', projectIds);

    // Count completed tasks in team projects
    const { count: completedTasks } = await supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .in('project_id', projectIds)
        .eq('status', 'Completed');

    tasksCount = totalTasks || 0;
    completedTasksCount = completedTasks || 0;
    } else {
    // If no projects or error fetching projects, default to 0
    if (projectsError) {
        console.warn(`Could not fetch projects for team ${teamId}:`, projectsError);
      }
    }
    // Calculate resources count
    const { count: resourcesCount } = await supabase
        .from('resources')
        .select('id', { count: 'exact', head: true })
        .eq('team_id', teamId)
        .neq('resource_type', 'folder');

    const teamResult: AppTeamType = {
      id: teamData.id,
      name: teamData.name,
      description: teamData.description || '',
      iconSeed: (teamData.icon_seed as TeamIconName | null) || 'Users',
      ownerId: teamData.owner_id,
      ownerName: ownerProfile?.full_name || 'Unknown Owner',
      members,
      departments,
      membersCount: members.length,
      projectsCount: projectsCount || 0, // Use the accurate count
      completedTasksCount: completedTasksCount || 0,
      tasksCount: tasksCount || 0,
      resourcesCount: resourcesCount || 0,
      photoUrl: photoUrl,
      efficiency: completedTasksCount && tasksCount ? Math.round((completedTasksCount / tasksCount) * 100) : 90
    };
    return teamResult;
  },

  async getAllTeamsForUser(): Promise<AppTeamType[]> {
    const user = await getCurrentUser();
    const { data: teamIdsData, error: teamIdsError } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', user.id);

    if (teamIdsError) throw new Error(formatSupabaseError(teamIdsError, "teamService.getAllTeamsForUser (fetch team_members)"));
    if (!teamIdsData || teamIdsData.length === 0) return [];

    const teamIds = teamIdsData.map(tm => tm.team_id);
    // Pass the user ID to getTeamById to apply department visibility rules
    const teamsPromises = teamIds.map(id => this.getTeamById(id, user.id));
    const teams = (await Promise.all(teamsPromises)).filter(Boolean) as AppTeamType[];

    return teams;
  },

  async getTeamMembers(teamId: string): Promise<TeamMember[]> {
    // Get team members first
    const { data: teamMembersData, error: teamMembersError } = await supabase
      .from('team_members')
      .select('user_id, role, joined_at, tags, permissions')
      .eq('team_id', teamId);

    if (teamMembersError) {
      throw new Error(formatSupabaseError(teamMembersError, "getTeamMembers"));
    }

    if (!teamMembersData || teamMembersData.length === 0) {
      return [];
    }

    // Get user profiles separately
    const userIds = teamMembersData.map(member => member.user_id);
    const { data: profilesData, error: profilesError } = await supabase
      .from('user_profiles')
      .select('id, full_name, email, avatar_url')
      .in('id', userIds);

    if (profilesError) {
      throw new Error(formatSupabaseError(profilesError, "getTeamMembers - profiles"));
    }

    // Create a map for quick profile lookup
    const profilesMap = new Map(profilesData?.map(profile => [profile.id, profile]) || []);

    // Combine team member data with profiles
    return teamMembersData.map(member => {
      const profile = profilesMap.get(member.user_id);
      if (!profile) {
        console.warn(`Profile not found for user ${member.user_id}`);
        return null;
      }
      
      return {
        id: profile.id,
        full_name: profile.full_name,
        email: profile.email,
        avatar_url: profile.avatar_url,
        role: member.role as UserRole,
        joinedAt: member.joined_at,
        tags: member.tags || [],
        permissions: (member.permissions as TeamPermission[]) || getDefaultPermissionsForRole(member.role as UserRole),
      };
    }).filter(member => member !== null) as TeamMember[];
  },

  async updateTeam(teamId: string, updates: Partial<Pick<AppTeamType, 'name' | 'description' | 'iconSeed'>> & { photoFile?: File }): Promise<AppTeamType | null> {
    const user = await getCurrentUser();
    
    // Check permissions - ONLY TEAM OWNER CAN UPDATE TEAM
    const { data: memberData } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', user.id)
        .single();

    if (!memberData) throw new Error("You are not a member of this team.");

    if (memberData.role !== UserRole.OWNER) {
        throw new Error("You do not have permission to edit team details. Only the team owner can.");
    }

    if (updates.photoFile) {
        // Get team name for folder operations
        const { data: teamInfo } = await supabase
            .from('teams')
            .select('name')
            .eq('id', teamId)
            .single();

        // Find or create team root folder
        const teamRootFolder = await this.findOrCreateTeamRootFolder(
            teamId, 
            teamInfo?.name || 'Team', 
            user.id
        );

        // Remove old photo resources (check both loose files and files in folder)
        const { data: oldResources, error: findError } = await supabase
            .from('resources')
            .select('id, file_path')
            .eq('team_id', teamId)
            .eq('resource_type', 'image')
            .ilike('file_name', '%team photo%'); // More specific search for team photos
            
        if (findError) {
            console.warn("Could not fetch old team photo for deletion. Old photo may be orphaned.", findError);
        } else if (oldResources && oldResources.length > 0) {
            await supabase.storage.from('resources').remove(oldResources.map(r => r.file_path));
            await supabase.from('resources').delete().in('id', oldResources.map(r => r.id));
        }

        // Upload new photo to team folder
        const photoFile = updates.photoFile;
        const fileExt = photoFile.name.split('.').pop()?.toLowerCase() || 'png';
        const uniqueFileName = `team-photo-${Date.now()}.${fileExt}`;
        const filePath = `public/${user.id}/teams/${teamId}/${uniqueFileName}`;
        
        const { error: uploadError } = await supabase.storage.from('resources').upload(filePath, photoFile);
        if (uploadError) throw new Error(`Failed to upload new team photo: ${uploadError.message}`);

        // Save new photo inside team folder structure
        const { error: resourceError } = await supabase.from('resources').insert({
            bucket_name: 'resources',
            file_name: `${teamInfo?.name || 'Team'} Photo.${fileExt}`,
            file_path: filePath,
            mime_type: photoFile.type,
            size_bytes: photoFile.size,
            resource_type: 'image',
            uploaded_by: user.id,
            team_id: teamId,
            parent_folder_id: teamRootFolder.id,
            is_team_photo: true, // KEY CHANGE: Place inside team folder
        });
        
        if (resourceError) {
            console.warn(`New team photo uploaded, but failed to save resource metadata: ${resourceError.message}`);
        }
    }

    // Update team details
    const teamUpdatePayload: Database['public']['Tables']['teams']['Update'] = {
        name: updates.name,
        description: updates.description,
        icon_seed: updates.iconSeed,
        updated_at: new Date().toISOString()
    };

    const { error: updateError } = await supabase
        .from('teams')
        .update(teamUpdatePayload)
        .eq('id', teamId);

    if (updateError) throw new Error(formatSupabaseError(updateError, `teamService.updateTeam (${teamId})`));

    return this.getTeamById(teamId);
  },

  async deleteTeam(teamId: string): Promise<boolean> {
    const user = await getCurrentUser();
    
    // Check permissions - ONLY TEAM OWNER CAN DELETE TEAM
    const { data: memberData } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', user.id)
        .single();

    if (!memberData) throw new Error("You are not a member of this team.");

    if (memberData.role !== UserRole.OWNER) {
        throw new Error("You do not have permission to delete this team. Only the team owner can.");
    }
    
    // Clean up all related data in the correct order to avoid foreign key constraint violations
    
    // 1. Delete team chat messages
    await supabase.from('team_chat_messages').delete().eq('team_id', teamId);
    
    // 2. Delete team updates
    await supabase.from('team_updates').delete().eq('team_id', teamId);
    
    // 3. Delete team invites
    await supabase.from('team_invites').delete().eq('team_id', teamId);
    
    // 4. Delete department chat messages for all departments in this team
    const { data: departments } = await supabase
        .from('departments')
        .select('id')
        .eq('team_id', teamId);
    
    if (departments && departments.length > 0) {
        const departmentIds = departments.map(d => d.id);
        
        // Delete department chat messages
        await supabase.from('department_chat_messages').delete().in('department_id', departmentIds);
        
        // Delete department updates
        await supabase.from('department_updates').delete().in('department_id', departmentIds);
        
        // Delete department members
        await supabase.from('department_members').delete().in('department_id', departmentIds);
        
        // Delete departments
        await supabase.from('departments').delete().in('id', departmentIds);
    }
    
    // 5. Clean up resources and storage files
    const { data: resources } = await supabase
        .from('resources')
        .select('file_path')
        .eq('team_id', teamId);

    if (resources && resources.length > 0) {
        // Remove files from storage
        await supabase.storage.from('resources').remove(resources.map(r => r.file_path));
        // Delete resource records
        await supabase.from('resources').delete().eq('team_id', teamId);
    }
    
    // 6. Delete team members
    await supabase.from('team_members').delete().eq('team_id', teamId);
    
    // 7. Update projects to unlink them from the team (instead of deleting them)
    await supabase.from('projects').update({ team_id: null }).eq('team_id', teamId);
    
    // 8. Finally delete the team
    const { error } = await supabase.from('teams').delete().eq('id', teamId);
    if (error) throw new Error(formatSupabaseError(error, `teamService.deleteTeam (${teamId})`));
    
    return true;
  },

  async addTeamMember(teamId: string, userIdToAdd: string, role: UserRole = UserRole.MEMBER, tags: string[] = []): Promise<TeamMember | null> {
    const user = await getCurrentUser();
    
    // Check permissions
    const { data: currentTeam } = await supabase
        .from('teams')
        .select('owner_id')
        .eq('id', teamId)
        .single();

    const { data: currentUserMember } = await supabase
        .from('team_members')
        .select('role, permissions')
        .eq('team_id', teamId)
        .eq('user_id', user.id)
        .single();

    if (!currentUserMember) throw new Error("You are not a member of this team.");

    // Cannot add someone as owner (use transfer ownership instead)
    if (role === UserRole.OWNER) {
        throw new Error("Cannot add someone as Owner. Use transfer ownership instead.");
    }

    // Permission logic:
    // - Owner can add anyone with any role (except owner)
    // - Admin can add members but cannot add other admins
    // - Members cannot add anyone
    const isCurrentUserOwner = currentTeam?.owner_id === user.id;
    const isCurrentUserAdmin = currentUserMember.role === UserRole.ADMIN;

    if (!isCurrentUserOwner) {
        if (!isCurrentUserAdmin) {
            throw new Error("You do not have permission to add members to this team.");
        }
        
        if (role === UserRole.ADMIN) {
            throw new Error("Admins cannot add other admins. Only the team owner can.");
        }
    }

    const defaultPermissions = getDefaultPermissionsForRole(role);
    const memberInsertPayload: Database['public']['Tables']['team_members']['Insert'] = {
      team_id: teamId,
      user_id: userIdToAdd,
      role,
      tags: tags,
      permissions: defaultPermissions,
    };

    const { data, error } = await supabase.from('team_members').insert(memberInsertPayload).select().single();
    if (error) {
        if (error.code === '23505') throw new Error("User is already a member of this team.");
        throw new Error(formatSupabaseError(error, "teamService.addTeamMember"));
    }

    // Send notification to the added user
    try {
      const actorProfile = await this.getUserProfile(user.id);
      const teamProfile = await supabase.from('teams').select('name').eq('id', teamId).single();
      const actorName = actorProfile?.full_name || 'Someone';
      const teamName = teamProfile.data?.name || 'Unknown Team';
      
      if (role === UserRole.ADMIN) {
        await notificationService.createTeamManagementNotification(
          userIdToAdd,
          'team_admin_added',
          teamName,
          teamId,
          actorName
        );
      } else {
        await notificationService.createTeamManagementNotification(
          userIdToAdd,
          'team_member_added',
          teamName,
          teamId,
          actorName
        );
      }
    } catch (notificationError) {
      console.warn('Failed to send team member added notification:', notificationError);
    }

    const profile = await this.getUserProfile(userIdToAdd);
    if (!profile || !data) return null;
    return {
      ...profile,
      role: data.role as UserRole,
      joinedAt: data.joined_at,
      tags: data.tags || [],
      permissions: (data.permissions as TeamPermission[]) || defaultPermissions
    };
  },

  async removeTeamMember(teamId: string, userIdToRemove: string): Promise<boolean> {
    const user = await getCurrentUser();
    
    // Check permissions
    const { data: currentTeam } = await supabase
        .from('teams')
        .select('owner_id')
        .eq('id', teamId)
        .single();

    const { data: currentUserMember } = await supabase
        .from('team_members')
        .select('role, permissions')
        .eq('team_id', teamId)
        .eq('user_id', user.id)
        .single();

    if (!currentUserMember) throw new Error("You are not a member of this team.");

    // Check if trying to remove owner
    const { data: targetMember } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', userIdToRemove)
        .single();

    if (!targetMember) throw new Error("Target member not found in this team.");

    if (targetMember.role === UserRole.OWNER) {
        throw new Error("Cannot remove the team owner. Transfer ownership first if needed.");
    }

    // Permission logic:
    // - Owner can remove anyone (except other owners)
    // - Admin can remove members but not other admins
    // - Members cannot remove anyone
    const isCurrentUserOwner = currentTeam?.owner_id === user.id;
    const isCurrentUserAdmin = currentUserMember.role === UserRole.ADMIN;
    const isTargetAdmin = targetMember.role === UserRole.ADMIN;

    if (!isCurrentUserOwner) {
        if (!isCurrentUserAdmin) {
            throw new Error("You do not have permission to remove members from this team.");
        }
        
        if (isTargetAdmin) {
            throw new Error("Admins cannot remove other admins. Only the team owner can.");
        }
    }

    const { error } = await supabase.from('team_members').delete().eq('team_id', teamId).eq('user_id', userIdToRemove);
    if (error) throw new Error(formatSupabaseError(error, "teamService.removeTeamMember"));

    // Remove from all departments in this team
    const {data: depts} = await supabase.from('departments').select('id').eq('team_id', teamId);
    if (depts && depts.length > 0) {
        await supabase.from('department_members').delete().in('department_id', depts.map(d => d.id)).eq('user_id', userIdToRemove);
    }
    return true;
  },

  async leaveTeam(teamId: string): Promise<boolean> {
    const user = await getCurrentUser();
    
    // Check if user is a member of this team
    const { data: memberData } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', user.id)
        .single();

    if (!memberData) throw new Error("You are not a member of this team.");

    // Owner cannot leave team - must transfer ownership first
    if (memberData.role === UserRole.OWNER) {
        throw new Error("Team owners cannot leave the team. Please transfer ownership to another member first.");
    }

    // Remove user from team
    const { error } = await supabase.from('team_members').delete()
        .eq('team_id', teamId)
        .eq('user_id', user.id);

    if (error) throw new Error(formatSupabaseError(error, "teamService.leaveTeam"));

    // Remove from all departments in this team
    const { data: depts } = await supabase.from('departments').select('id').eq('team_id', teamId);
    if (depts && depts.length > 0) {
        await supabase.from('department_members').delete()
            .in('department_id', depts.map(d => d.id))
            .eq('user_id', user.id);
    }

    return true;
  },

  async updateTeamMemberRole(teamId: string, memberId: string, newRole: UserRole): Promise<TeamMember | null> {
    const user = await getCurrentUser();
    
    // Check permissions
    const { data: currentTeam } = await supabase
        .from('teams')
        .select('owner_id')
        .eq('id', teamId)
        .single();

    const { data: currentUserMember } = await supabase
        .from('team_members')
        .select('role, permissions')
        .eq('team_id', teamId)
        .eq('user_id', user.id)
        .single();

    if (!currentUserMember) throw new Error("You are not a member of this team.");

    // Check if trying to change owner role
    const { data: targetMember } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', memberId)
        .single();

    if (!targetMember) throw new Error("Target member not found in this team.");

    // Permission checks
    const isCurrentUserOwner = currentTeam?.owner_id === user.id;
    const isCurrentUserAdmin = currentUserMember.role === UserRole.ADMIN;
    const isTargetOwner = targetMember.role === UserRole.OWNER;

    // Cannot change owner's role
    if (isTargetOwner) {
        throw new Error("Cannot change the owner's role. Transfer ownership first if needed.");
    }

    // Cannot promote someone to owner (use transfer ownership instead)
    if (newRole === UserRole.OWNER) {
        throw new Error("Cannot promote to Owner role. Use transfer ownership instead.");
    }

    // Permission logic:
    // - Owner can change anyone's role (except other owners)
    // - Admin can only promote members to admin or demote admins to members
    // - Members cannot change roles
    if (!isCurrentUserOwner) {
        if (!isCurrentUserAdmin) {
            throw new Error("You do not have permission to manage member roles.");
        }
        
        // Admin restrictions
        if (targetMember.role === UserRole.ADMIN && newRole !== UserRole.MEMBER) {
            throw new Error("Admins can only demote other admins to members.");
        }
        
        if (targetMember.role === UserRole.MEMBER && newRole !== UserRole.ADMIN) {
            throw new Error("Admins can only promote members to admins.");
        }
    }

    const defaultPermissions = getDefaultPermissionsForRole(newRole);
    const updatePayload: Database['public']['Tables']['team_members']['Update'] = {
      role: newRole,
      permissions: defaultPermissions,
    };

    const { data, error } = await supabase
        .from('team_members')
        .update(updatePayload)
        .eq('team_id', teamId)
        .eq('user_id', memberId)
        .select()
        .single();

    if (error) throw new Error(formatSupabaseError(error, "updateTeamMemberRole"));
    if (!data) return null;

    // Send notification about role change
    try {
      const actorProfile = await this.getUserProfile(user.id);
      const teamProfile = await supabase.from('teams').select('name').eq('id', teamId).single();
      const actorName = actorProfile?.full_name || 'Someone';
      const teamName = teamProfile.data?.name || 'Unknown Team';
      
      if (targetMember.role === UserRole.MEMBER && newRole === UserRole.ADMIN) {
        // Promoted to admin
        await notificationService.createTeamManagementNotification(
          memberId,
          'team_admin_added',
          teamName,
          teamId,
          actorName
        );
      } else if (targetMember.role === UserRole.ADMIN && newRole === UserRole.MEMBER) {
        // Demoted from admin
        await notificationService.createTeamManagementNotification(
          memberId,
          'team_admin_removed',
          teamName,
          teamId,
          actorName
        );
      }
    } catch (notificationError) {
      console.warn('Failed to send team role change notification:', notificationError);
    }

    const profile = await this.getUserProfile(memberId);
    if (!profile) return null;
    return {
      ...profile,
      role: data.role as UserRole,
      joinedAt: data.joined_at,
      tags: data.tags || [],
      permissions: (data.permissions as TeamPermission[]) || defaultPermissions
    };
  },
  
  // Function to get invite details by code (publicly callable - no auth required)
  async getInviteDetailsByCode(inviteCode: string): Promise<TeamInviteWithTeamDetails> {
    // Note: This function intentionally does NOT call getCurrentUser() 
    // because it needs to be accessible to logged-out users

    if (!inviteCode || !inviteCode.trim()) {
        throw new Error("Invite code is required.");
    }
    
    try {
        const { data: inviteData, error: inviteError } = await supabase
          .from('team_invites')
          .select(`
            id,
            team_id,
            expires_at,
            uses_left,
            created_at,
            invite_code,
            teams!inner (
              id,
              name,
              description,
              icon_seed
            )
          `)
          .eq('invite_code', inviteCode.trim())
          .single();

        if (inviteError) {
          console.error('Supabase error details:', inviteError);
          if (inviteError.code === 'PGRST116') {
            throw new Error("This invitation code is invalid or does not exist.");
          }
          throw new Error(`Database error: ${inviteError.message}`);
        }

        if (!inviteData) {
          throw new Error("This invitation code is invalid or does not exist.");
        }

        // Check if invite has expired
        const now = new Date();
        const expiresAt = new Date(inviteData.expires_at);

        if (expiresAt < now) {
          throw new Error("This invitation has expired.");
        }

        // Check if invite has uses left (if uses_left is not null)
        if (inviteData.uses_left !== null && inviteData.uses_left <= 0) {
          throw new Error("This invitation has been used up and is no longer valid.");
        }

        // Get team photo URL if it exists - use a separate query to avoid auth issues
        let photoUrl: string | null = null;
        try {
            const { data: photoResource } = await supabase
                .from('resources')
                .select('file_path')
                .eq('team_id', inviteData.team_id)
                .eq('resource_type', 'image')
                .eq('is_team_photo', true)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle(); // ✅ USE .maybeSingle()

            if (photoResource) {
                const { data: urlData } = supabase.storage.from('resources').getPublicUrl(photoResource.file_path);
                photoUrl = urlData.publicUrl;
            }
        } catch (error) {
            console.warn(`Could not fetch team photo for team ${inviteData.team_id}:`, error);
        }

        // Get member count - use a separate query to avoid auth issues
        let memberCount = 0;
        try {
            const { count } = await supabase
              .from('team_members')
              .select('id', { count: 'exact', head: true })
              .eq('team_id', inviteData.team_id);
            memberCount = count || 0;
        } catch (countError) {

            // Don't throw error for count issues, just use 0
        }

        return {
          id: inviteData.id,
          teamId: inviteData.team_id,
          teamName: inviteData.teams.name,
          teamDescription: inviteData.teams.description || '',
          teamIconSeed: (inviteData.teams.icon_seed as TeamIconName) || 'Users',
          teamPhotoUrl: photoUrl,
          teamMemberCount: memberCount,
          expiresAt: inviteData.expires_at,
          createdAt: inviteData.created_at,
        };
        
    } catch (error) {
        console.error('Error in getInviteDetailsByCode:', error);
        // Re-throw the error but ensure it has a user-friendly message
        if (error instanceof Error) {
            throw error;
        } else {
            throw new Error("An unexpected error occurred while loading the invitation details.");
        }
    }
  },
  // Function to accept team invite (requires authentication)
  async acceptTeamInvite(inviteCode: string): Promise<AppTeamType> {
    const user = await getCurrentUser();
    
    // First, get the invite details to validate it
    const inviteDetails = await this.getInviteDetailsByCode(inviteCode);
    
    // Check if user is already a member of this team
    const { data: existingMember } = await supabase
      .from('team_members')
      .select('id')
      .eq('team_id', inviteDetails.teamId)
      .eq('user_id', user.id)
      .single();

    if (existingMember) {
      throw new Error("You are already a member of this team.");
    }

    // Use RPC function for secure invite acceptance
    const { data: result, error: rpcError } = await supabase.rpc('accept_team_invite', {
      p_invite_code: inviteCode,
      p_user_id: user.id
    });

    if (rpcError) {
      throw new Error(formatSupabaseError(rpcError, "acceptTeamInvite RPC"));
    }

    if (!result) {
      throw new Error("Failed to accept team invitation. The invite may have expired or been used up.");
    }

    // Return the team details
    const team = await this.getTeamById(inviteDetails.teamId);
    if (!team) {
      throw new Error("Successfully joined team, but failed to retrieve team details.");
    }

    return team;
  },

  // Search function for teams
  async search(query: string, userId: string): Promise<GlobalSearchResultItem[]> {
    const { data: teamMemberships } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', userId);

    if (!teamMemberships || teamMemberships.length === 0) {
      return [];
    }

    const teamIds = teamMemberships.map(tm => tm.team_id);
    
    const { data: teams, error } = await supabase
      .from('teams')
      .select('id, name, description')
      .in('id', teamIds)
      .ilike('name', `%${query}%`);

    if (error) {
      console.error('Error searching teams:', error);
      return [];
    }

    return (teams || []).map(team => ({
      id: team.id,
      title: team.name,
      description: team.description || '',
      type: 'team' as const,
      path: `/app/collaboration`,
      state: { teamId: team.id, openTeamDetail: true }
    }));
  },

  async updateTeamMemberDetails(teamId: string, memberId: string, updates: { role?: UserRole, tags?: string[], permissions?: TeamPermission[] }): Promise<TeamMember | null> {
    const user = await getCurrentUser();
    
    // Check permissions for role/permission changes
    if (updates.role || updates.permissions) {
        const { data: memberData } = await supabase
            .from('team_members')
            .select('role')
            .eq('team_id', teamId)
            .eq('user_id', user.id)
            .single();

        if (!memberData) throw new Error("You are not a member of this team.");

        // ONLY OWNER can manage roles and permissions
        if (memberData.role !== UserRole.OWNER) {
            throw new Error("You do not have permission to manage member roles or permissions. Only the team owner can.");
        }

        // Check if trying to change owner
        const { data: targetMember } = await supabase
            .from('team_members')
            .select('role')
            .eq('team_id', teamId)
            .eq('user_id', memberId)
            .single();

        if (targetMember?.role === UserRole.OWNER && (updates.role || updates.permissions)) {
            throw new Error("Cannot change the owner's role or permissions.");
        }
    }

    const updatePayload: Database['public']['Tables']['team_members']['Update'] = {};

    if (updates.role) {
      updatePayload.role = updates.role;
      if (updates.permissions === undefined) {
        updatePayload.permissions = getDefaultPermissionsForRole(updates.role);
      } else {
        updatePayload.permissions = updates.permissions;
      }
    } else if (updates.permissions !== undefined) {
      updatePayload.permissions = updates.permissions;
    }

    if (updates.tags !== undefined) {
      updatePayload.tags = updates.tags;
    }

    if (Object.keys(updatePayload).length === 0) {
      const currentMemberData = await supabase.from('team_members').select('*').eq('team_id', teamId).eq('user_id', memberId).single();
      if (currentMemberData.data) {
        const profile = await this.getUserProfile(memberId);
        if (profile) {
          return {
            ...profile,
            role: currentMemberData.data.role as UserRole,
            joinedAt: currentMemberData.data.joined_at,
            tags: currentMemberData.data.tags || [],
            permissions: (currentMemberData.data.permissions as TeamPermission[]) || getDefaultPermissionsForRole(currentMemberData.data.role as UserRole)
          };
        }
      }
      return null;
    }

    const { data, error } = await supabase
        .from('team_members')
        .update(updatePayload)
        .eq('team_id', teamId)
        .eq('user_id', memberId)
        .select()
        .single();

    if (error) throw new Error(formatSupabaseError(error, "updateTeamMemberDetails"));
    if (!data) return null;

    const profile = await this.getUserProfile(memberId);
    if (!profile) return null;
    return {
      ...profile,
      role: data.role as UserRole,
      joinedAt: data.joined_at,
      tags: data.tags || [],
      permissions: (data.permissions as TeamPermission[]) || getDefaultPermissionsForRole(data.role as UserRole)
    };
  },

  async createDepartment(teamId: string, name: string, description?: string): Promise<DepartmentType> {
    const user = await getCurrentUser();
    
    // Check permissions - ONLY TEAM OWNER CAN CREATE DEPARTMENTS
    const { data: memberData } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', user.id)
        .single();

    if (!memberData) throw new Error("You are not a member of this team.");

    if (memberData.role !== UserRole.OWNER) {
        throw new Error("You do not have permission to create departments. Only the team owner can.");
    }

    // 1. Create the department
    const { data: departmentData, error: deptError } = await supabase.from('departments').insert({
        team_id: teamId,
        name: name.trim(),
        description: description?.trim() || null,
    }).select().single();

    if (deptError) throw new Error(formatSupabaseError(deptError, "teamService.createDepartment"));
    if (!departmentData) throw new Error("Failed to create department: No data returned.");

    // 2. Add the creator as a department admin
    try {
        await this.addMemberToDepartment(departmentData.id, user.id, DepartmentMemberRole.ADMIN);
    } catch (error) {
        console.warn("Department created but failed to auto-add creator:", error);
        // Continue anyway - user can manually add themselves
    }

    // 3. Return the department (it will be refreshed when the parent component reloads)
    return mapDbDepartmentToFrontend(departmentData, [], []);
  },

    async updateDepartment(departmentId: string, updates: { name?: string, description?: string }): Promise<DepartmentType> {
        const user = await getCurrentUser();

        // 1. Get department to find its team
        const { data: deptData, error: deptError } = await supabase
            .from('departments')
            .select('team_id')
            .eq('id', departmentId)
            .single();
        if (deptError || !deptData) throw new Error("Department not found.");

        // 2. Check user's permissions - ONLY TEAM OWNER CAN UPDATE DEPARTMENTS
        const { data: teamMemberData } = await supabase
            .from('team_members')
            .select('role')
            .eq('team_id', deptData.team_id)
            .eq('user_id', user.id)
            .single();
        
        if (!teamMemberData || teamMemberData.role !== UserRole.OWNER) {
            throw new Error("You do not have permission to edit this department. Only the team owner can.");
        }

        // 3. Perform update
        const updatePayload: Database['public']['Tables']['departments']['Update'] = {
            name: updates.name?.trim(),
            description: updates.description?.trim(),
            updated_at: new Date().toISOString(),
        };
        
        const { data: updatedDept, error: updateError } = await supabase
            .from('departments')
            .update(updatePayload)
            .eq('id', departmentId)
            .select()
            .single();

        if (updateError) throw new Error(formatSupabaseError(updateError, "teamService.updateDepartment"));
        if (!updatedDept) throw new Error("Failed to update department: No data returned.");

        return mapDbDepartmentToFrontend(updatedDept);
    },

    async deleteDepartment(departmentId: string): Promise<boolean> {
        const user = await getCurrentUser();
        
        // 1. Get department and check permissions
        const { data: deptData } = await supabase
            .from('departments')
            .select('team_id')
            .eq('id', departmentId)
            .single();

        if (!deptData) throw new Error("Department not found.");

        const { data: memberData } = await supabase
            .from('team_members')
            .select('role')
            .eq('team_id', deptData.team_id)
            .eq('user_id', user.id)
            .single();

        if (!memberData || memberData.role !== UserRole.OWNER) {
            throw new Error("You do not have permission to delete this department. Only the team owner can.");
        }
        
        // 2. Clean up dependencies before deleting the department
        await supabase.from('department_chat_messages').delete().eq('department_id', departmentId);
        await supabase.from('department_updates').delete().eq('department_id', departmentId);
        await supabase.from('department_members').delete().eq('department_id', departmentId);
        // Unlink projects instead of deleting them
        await supabase.from('projects').update({ department_id: null }).eq('department_id', departmentId);
        
        // 3. Finally, delete the department
        const { error } = await supabase.from('departments').delete().eq('id', departmentId);
        if (error) throw new Error(formatSupabaseError(error, "teamService.deleteDepartment"));
        
        return true;
    },

  async addMemberToDepartment(departmentId: string, userId: string, role: DepartmentMemberRole = DepartmentMemberRole.MEMBER): Promise<void> {
    const user = await getCurrentUser();
    
    // Get department and check permissions
    const { data: deptData } = await supabase
        .from('departments')
        .select('team_id')
        .eq('id', departmentId)
        .single();

    if (!deptData) throw new Error("Department not found.");

    const { data: memberData } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', deptData.team_id)
        .eq('user_id', user.id)
        .single();

    if (!memberData || memberData.role !== UserRole.OWNER) {
        throw new Error("Only the team owner can manage department members.");
    }

    // Check if user is a team member
    const { data: teamMember } = await supabase
        .from('team_members')
        .select('user_id')
        .eq('team_id', deptData.team_id)
        .eq('user_id', userId)
        .single();

    if (!teamMember) {
        throw new Error("User must be a team member before being added to a department.");
    }

    const { error } = await supabase.from('department_members').insert({
        department_id: departmentId,
        user_id: userId,
        role: role,
    });

    if (error) {
        if (error.code === '23505') throw new Error("User is already a member of this department.");
        throw new Error(formatSupabaseError(error, "teamService.addMemberToDepartment"));
    }
    
    // Send notification to the added user
    try {
      const actorProfile = await this.getUserProfile(user.id);
      const departmentData = await supabase
        .from('departments')
        .select('name, team_id, teams(name)')
        .eq('id', departmentId)
        .single();
      const actorName = actorProfile?.full_name || 'Someone';
      const departmentName = departmentData.data?.name || 'Unknown Department';
      const teamName = (departmentData.data?.teams as any)?.name || 'Unknown Team';
      
      await notificationService.createDepartmentManagementNotification(
        userId,
        'department_member_added',
        departmentName,
        departmentId,
        teamName,
        deptData.team_id,
        actorName
      );
    } catch (notificationError) {
      console.warn('Failed to send department member added notification:', notificationError);
    }
},

async removeMemberFromDepartment(departmentId: string, userId: string): Promise<void> {
    const user = await getCurrentUser();
    
    // Get department and check permissions
    const { data: deptData } = await supabase
        .from('departments')
        .select('team_id')
        .eq('id', departmentId)
        .single();

    if (!deptData) throw new Error("Department not found.");

    const { data: memberData } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', deptData.team_id)
        .eq('user_id', user.id)
        .single();

    if (!memberData || memberData.role !== UserRole.OWNER) {
        throw new Error("Only the team owner can manage department members.");
    }

    const { error } = await supabase
        .from('department_members')
        .delete()
        .eq('department_id', departmentId)
        .eq('user_id', userId);

    if (error) throw new Error(formatSupabaseError(error, "teamService.removeMemberFromDepartment"));
},

  // Team Service Methods for Project Integration
  async getDepartmentProjects(departmentId: string): Promise<Project[]> {
    try {
      // Get project IDs assigned to this department
      const { data: assignments, error: assignmentError } = await supabase
        .from('project_department_assignments')
        .select('project_id')
        .eq('department_id', departmentId);
  
      if (assignmentError) {
        throw new Error(assignmentError.message);
      }
  
      if (!assignments || assignments.length === 0) {
        return [];
      }
  
      // Get the projects
      const projectIds = assignments.map(a => a.project_id);
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .in('id', projectIds)
        .order('created_at', { ascending: false });
  
      if (projectsError) {
        throw new Error(projectsError.message);
      }
  
      // Get owner names for each project
      const enhancedProjects = await Promise.all(
        projects.map(async (project) => {
          let ownerName = '';
          if (project.owner_id) {
            const { data: owner } = await supabase
              .from('user_profiles')
              .select('full_name')
              .eq('id', project.owner_id)
              .single();
            ownerName = owner?.full_name || '';
          }
  
          return {
            id: project.id,
            name: project.name,
            description: project.description,
            ownerId: project.owner_id,
            ownerName: ownerName,
            teamId: project.team_id,
            teamName: '',
            dueDate: project.due_date,
            priority: project.priority,
            photoUrl: project.photo_url,
            createdAt: project.created_at,
            updatedAt: project.updated_at,
            members: []
          };
        })
      );
  
      return enhancedProjects;
  
    } catch (error) {
      console.error('Error in teamService.getDepartmentProjects:', error);
      throw error;
    }
  },

  async assignProjectToDepartment(departmentId: string, projectId: string): Promise<void> {
    try {
        const { error } = await supabase
            .from('project_department_assignments')
            .insert({
                project_id: projectId,
                department_id: departmentId,
                assigned_by: (await supabase.auth.getUser()).data.user?.id
            });

        if (error && error.code !== '23505') { // Ignore duplicate constraint violations
            throw new Error(error.message);
        }

        const { data: departmentMembers, error: memberError } = await supabase
            .from('department_members')
            .select('user_id')
            .eq('department_id', departmentId);

        if (memberError) {
            throw new Error(formatSupabaseError(memberError, 'assignProjectToDepartment (fetch members)'));
        }

        const project = await projectService.getProjectById(projectId);

        if (project && departmentMembers) {
            for (const member of departmentMembers) {
                if (member.user_id !== project.ownerId) {
                    await projectService.addProjectMember(projectId, member.user_id, UserRole.MEMBER);
                }
            }
        }

    } catch (error) {
        console.error('Error in assignProjectToDepartment:', error);
        throw error;
    }
  },

  async unlinkProjectFromDepartment(departmentId: string, projectId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('project_department_assignments')
        .delete()
        .eq('project_id', projectId)
        .eq('department_id', departmentId);
  
      if (error) {
        throw new Error(error.message);
      }
    } catch (error) {
      console.error('Error in unlinkProjectFromDepartment:', error);
      throw error;
    }
  },

  async getTeamProjects(teamId: string): Promise<Project[]> {
    try {
      const { data: projects, error } = await supabase
        .from('projects')
        .select('*')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false });
  
      if (error) {
        throw new Error(error.message);
      }
  
      return projects.map(project => ({
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
        members: []
      }));
  
    } catch (error) {
      console.error('Error in getTeamProjects:', error);
      throw error;
    }
  },

    async getUnassignedTeamProjects(teamId: string): Promise<Project[]> {
        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .eq('team_id', teamId)
            .is('department_id', null);

        if (error) {
            throw new Error(formatSupabaseError(error, "teamService.getUnassignedTeamProjects"));
        }
        return (data as Project[]) || [];
    },

    async getDepartmentById(departmentId: string): Promise<DepartmentType | null> {
        const { data: deptData, error: deptError } = await supabase
            .from('departments')
            .select('*')
            .eq('id', departmentId)
            .single();

        if (deptError) {
            if (deptError.code === 'PGRST116') return null;
            throw new Error(formatSupabaseError(deptError, "teamService.getDepartmentById (dept fetch)"));
        }
        if (!deptData) return null;

        const { data: deptMemberLinks, error: deptMembersError } = await supabase
            .from('department_members')
            .select('user_id, role')
            .eq('department_id', deptData.id);

        if (deptMembersError) {
            console.error(`Failed to fetch members for department ${departmentId}:`, deptMembersError);
        }
        
        let memberProfilesWithDeptRole: (TeamMember & { departmentRole: DepartmentMemberRole })[] = [];
        if (deptMemberLinks && deptMemberLinks.length > 0) {
            const memberUserIds = deptMemberLinks.map(link => link.user_id);
            const profilesMap = await fetchProfilesForIds(memberUserIds);
            
            const { data: teamMembersData } = await supabase
                .from('team_members')
                .select('user_id, role, joined_at, tags, permissions')
                .in('user_id', memberUserIds)
                .eq('team_id', deptData.team_id);

            if (teamMembersData) {
                memberProfilesWithDeptRole = teamMembersData.map(tm => {
                    const profile = profilesMap.get(tm.user_id);
                    const deptLink = deptMemberLinks.find(link => link.user_id === tm.user_id);
                    if (!profile || !deptLink) return null;
                    return {
                        ...profile,
                        role: tm.role as UserRole,
                        joinedAt: tm.joined_at,
                        tags: tm.tags || [],
                        permissions: (tm.permissions as TeamPermission[]) || getDefaultPermissionsForRole(tm.role as UserRole),
                        departmentRole: deptLink.role as DepartmentMemberRole,
                    };
                }).filter(Boolean) as (TeamMember & { departmentRole: DepartmentMemberRole })[];
            }
        }

        const { data: projectsData, error: projectsError } = await supabase
            .from('projects')
            .select('*')
            .eq('department_id', deptData.id);

        if (projectsError) {
            console.error(`Failed to fetch projects for department ${departmentId}:`, projectsError);
        }

        return mapDbDepartmentToFrontend(deptData, memberProfilesWithDeptRole, (projectsData as Project[]) || []);
    },

    async createTeamInvite(teamId: string, expiresInDays: number = 7): Promise<TeamInvite> {
        const user = await getCurrentUser();
        
        // Check permissions
        const { data: memberData } = await supabase
            .from('team_members')
            .select('role, permissions')
            .eq('team_id', teamId)
            .eq('user_id', user.id)
            .single();
    
        if (!memberData) throw new Error("You are not a member of this team.");
    
        const hasInvitePermission = memberData.role === UserRole.OWNER || 
            (memberData.permissions as TeamPermission[])?.includes('CAN_ADD_MEMBERS');
    
        if (!hasInvitePermission) {
            throw new Error("You do not have permission to create team invites.");
        }
    
        // ✅ OPTIMIZATION: Check for existing valid invites first
        const { data: existingInvite, error: findError } = await supabase
            .from('team_invites')
            .select('id, team_id, created_by, expires_at, created_at, invite_code')
            .eq('team_id', teamId)
            .eq('created_by', user.id)
            .gte('expires_at', new Date().toISOString()) // Not expired
            .or('uses_left.is.null,uses_left.gt.0') // Has uses left or unlimited
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
    
        // If we found a valid existing invite, return it
        if (!findError && existingInvite) {

            return {
                id: existingInvite.invite_code,
                teamId: existingInvite.team_id,
                createdBy: existingInvite.created_by,
                expiresAt: existingInvite.expires_at,
                createdAt: existingInvite.created_at,
                isUsed: false,
            };
        }
    
        // If no valid invite exists, create a new one

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    
        const { data, error } = await supabase.from('team_invites').insert({
            team_id: teamId,
            created_by: user.id,
            expires_at: expiresAt.toISOString(),
            role: 'Member',
            uses_left: null, // Unlimited uses
        }).select('id, team_id, created_by, expires_at, created_at, invite_code').single();
    
        if (error) throw new Error(formatSupabaseError(error, "teamService.createTeamInvite"));
        if (!data) throw new Error("Failed to create team invite: No data returned.");

        return {
            id: data.invite_code,
            teamId: data.team_id,
            createdBy: data.created_by,
            expiresAt: data.expires_at,
            createdAt: data.created_at,
            isUsed: false,
        };
    },

  async getTeamUpdates(teamId: string): Promise<TeamUpdate[]> {
    const { data, error } = await supabase
        .from('team_updates')
        .select('id, content, created_at, author_id')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) throw new Error(formatSupabaseError(error, "teamService.getTeamUpdates"));

    if (!data || data.length === 0) return [];

    // Fetch author profiles separately
    const authorIds = [...new Set(data.map(update => update.author_id))];
    const profilesMap = await fetchProfilesForIds(authorIds);

    return data.map(update => {
        const authorProfile = profilesMap.get(update.author_id);
        return {
            id: update.id,
            content: update.content,
            createdAt: update.created_at,
            authorId: update.author_id,
            authorName: authorProfile?.full_name || 'Unknown User',
            authorAvatar: authorProfile?.avatar_url || null,
        };
    });
  },

  async addTeamUpdate(teamId: string, content: string): Promise<TeamUpdate> {
    const user = await getCurrentUser();
    
    // Check if user is a team member
    const { data: memberData } = await supabase
        .from('team_members')
        .select('user_id')
        .eq('team_id', teamId)
        .eq('user_id', user.id)
        .single();

    if (!memberData) throw new Error("You are not a member of this team.");

    const { data, error } = await supabase.from('team_updates').insert({
        team_id: teamId,
        author_id: user.id,
        content: content.trim(),
    }).select('id, content, created_at, author_id').single();

    if (error) throw new Error(formatSupabaseError(error, "teamService.addTeamUpdate"));
    if (!data) throw new Error("Failed to create team update: No data returned.");

    // Fetch author profile
    const authorProfile = await this.getUserProfile(user.id);

    return {
        id: data.id,
        content: data.content,
        createdAt: data.created_at,
        authorId: data.author_id,
        authorName: authorProfile?.full_name || 'Unknown User',
        authorAvatar: authorProfile?.avatar_url || null,
    };
  },

  async getTeamChatMessages(teamId: string, limit: number = 100): Promise<TeamChatMessage[]> {
    const { data, error } = await supabase
        .from('team_chat_messages')
        .select('id, content, created_at, sender_id')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) throw new Error(formatSupabaseError(error, "teamService.getTeamChatMessages"));

    if (!data || data.length === 0) return [];

    // Fetch author profiles separately
    const authorIds = [...new Set(data.map(message => message.sender_id))];
    const profilesMap = await fetchProfilesForIds(authorIds);

    return data.map(message => {
        const authorProfile = profilesMap.get(message.sender_id);
        return {
            id: message.id,
            content: message.content,
            createdAt: message.created_at,
            authorId: message.sender_id,
            authorName: authorProfile?.full_name || 'Unknown User',
            authorAvatar: authorProfile?.avatar_url || null,
        };
    }).reverse(); // Reverse to show oldest first
  },

  async addTeamChatMessage(teamId: string, content: string): Promise<TeamChatMessage> {
    const user = await getCurrentUser();
    
    // Check if user is a team member
    const { data: memberData } = await supabase
        .from('team_members')
        .select('user_id')
        .eq('team_id', teamId)
        .eq('user_id', user.id)
        .single();

    if (!memberData) throw new Error("You are not a member of this team.");

    const { data, error } = await supabase.from('team_chat_messages').insert({
        team_id: teamId,
        sender_id: user.id,
        content: content.trim(),
    }).select('id, content, created_at, sender_id').single();

    if (error) throw new Error(formatSupabaseError(error, "teamService.addTeamChatMessage"));
    if (!data) throw new Error("Failed to create team chat message: No data returned.");

    // Fetch author profile
    const authorProfile = await this.getUserProfile(user.id);

    return {
        id: data.id,
        content: data.content,
        createdAt: data.created_at,
        authorId: data.sender_id,
        authorName: authorProfile?.full_name || 'Unknown User',
        authorAvatar: authorProfile?.avatar_url || null,
    };
  },

  // DEPARTMENT-SPECIFIC FUNCTIONS

  async getDepartmentUpdates(departmentId: string): Promise<DepartmentUpdate[]> {
    const { data, error } = await supabase
        .from('department_updates')
        .select('id, content, created_at, author_id')
        .eq('department_id', departmentId)
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) throw new Error(formatSupabaseError(error, "teamService.getDepartmentUpdates"));
    if (!data || data.length === 0) return [];

    const authorIds = [...new Set(data.map(update => update.author_id))];
    const profilesMap = await fetchProfilesForIds(authorIds);

    return data.map(update => {
        const authorProfile = profilesMap.get(update.author_id);
        return {
            id: update.id,
            content: update.content,
            createdAt: update.created_at,
            authorId: update.author_id,
            authorName: authorProfile?.full_name || 'Unknown User',
            authorAvatar: authorProfile?.avatar_url || null,
            departmentId: departmentId,
        };
    });
  },

  async addDepartmentUpdate(departmentId: string, content: string): Promise<DepartmentUpdate> {
    const user = await getCurrentUser();
    
    // Check if user is a department member
    const { data: deptData } = await supabase
        .from('departments')
        .select('team_id')
        .eq('id', departmentId)
        .single();

    if (!deptData) throw new Error("Department not found.");

    const { data: memberData } = await supabase
        .from('team_members')
        .select('user_id')
        .eq('team_id', deptData.team_id)
        .eq('user_id', user.id)
        .single();

    if (!memberData) throw new Error("You are not a member of this team.");

    const { data, error } = await supabase.from('department_updates').insert({
        department_id: departmentId,
        author_id: user.id,
        content: content.trim(),
    }).select('id, content, created_at, author_id').single();

    if (error) throw new Error(formatSupabaseError(error, "teamService.addDepartmentUpdate"));
    if (!data) throw new Error("Failed to create department update: No data returned.");

    // Fetch author profile
    const authorProfile = await this.getUserProfile(user.id);

    return {
        id: data.id,
        content: data.content,
        createdAt: data.created_at,
        authorId: data.author_id,
        authorName: authorProfile?.full_name || 'Unknown User',
        authorAvatar: authorProfile?.avatar_url || null,
        departmentId: departmentId,
    };
  },

  async getDepartmentChatMessages(departmentId: string, limit: number = 100): Promise<DepartmentChatMessage[]> {
    const { data, error } = await supabase
        .from('department_chat_messages')
        .select('id, content, created_at, sender_id')
        .eq('department_id', departmentId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) throw new Error(formatSupabaseError(error, "teamService.getDepartmentChatMessages"));
    if (!data || data.length === 0) return [];

    const authorIds = [...new Set(data.map(message => message.sender_id))];
    const profilesMap = await fetchProfilesForIds(authorIds);

    return data.map(message => {
        const authorProfile = profilesMap.get(message.sender_id);
        return {
            id: message.id,
            content: message.content,
            createdAt: message.created_at,
            authorId: message.sender_id,
            authorName: authorProfile?.full_name || 'Unknown User',
            authorAvatar: authorProfile?.avatar_url || null,
        };
    }).reverse(); // Reverse to show oldest first
  },

  async addDepartmentChatMessage(departmentId: string, content: string): Promise<DepartmentChatMessage> {
    const user = await getCurrentUser();
    
    // Check if user is a department member
    const { data: deptMemberData } = await supabase
        .from('department_members')
        .select('user_id')
        .eq('department_id', departmentId)
        .eq('user_id', user.id)
        .single();

    if (!deptMemberData) throw new Error("You are not a member of this department.");

    const { data, error } = await supabase.from('department_chat_messages').insert({
        department_id: departmentId,
        sender_id: user.id,
        content: content.trim(),
    }).select('id, content, created_at, sender_id').single();

    if (error) throw new Error(formatSupabaseError(error, "teamService.addDepartmentChatMessage"));
    if (!data) throw new Error("Failed to create department chat message: No data returned.");

    // Fetch author profile
    const authorProfile = await this.getUserProfile(user.id);

    return {
        id: data.id,
        content: data.content,
        createdAt: data.created_at,
        authorId: data.sender_id,
        authorName: authorProfile?.full_name || 'Unknown User',
        authorAvatar: authorProfile?.avatar_url || null,
    };
  },

  async updateDepartmentMemberRole(departmentId: string, memberId: string, newRole: DepartmentMemberRole): Promise<void> {
    const user = await getCurrentUser();
    
    // Get department and check permissions
    const { data: deptData } = await supabase
        .from('departments')
        .select('team_id')
        .eq('id', departmentId)
        .single();

    if (!deptData) throw new Error("Department not found.");

    // Check if user is team owner
    const { data: teamMemberData } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', deptData.team_id)
        .eq('user_id', user.id)
        .single();

    if (!teamMemberData || teamMemberData.role !== UserRole.OWNER) {
        throw new Error("Only the team owner can change department member roles.");
    }

    const { error } = await supabase
        .from('department_members')
        .update({ role: newRole })
        .eq('department_id', departmentId)
        .eq('user_id', memberId);

    if (error) throw new Error(formatSupabaseError(error, "teamService.updateDepartmentMemberRole"));
},

  async createProjectForDepartment(departmentId: string, name: string, description?: string): Promise<Project> {
    const user = await getCurrentUser();
    
    // Get department and check permissions
    const { data: deptData } = await supabase
        .from('departments')
        .select('team_id')
        .eq('id', departmentId)
        .single();

    if (!deptData) throw new Error("Department not found.");

    // Check if user is team member and has project management permissions
    const { data: teamMemberData } = await supabase
        .from('team_members')
        .select('role, permissions')
        .eq('team_id', deptData.team_id)
        .eq('user_id', user.id)
        .single();

    const { data: deptMemberData } = await supabase
        .from('department_members')
        .select('role')
        .eq('department_id', departmentId)
        .eq('user_id', user.id)
        .single();

    const canCreateProject = teamMemberData?.role === UserRole.OWNER || 
                            teamMemberData?.role === UserRole.ADMIN ||
                            deptMemberData?.role === DepartmentMemberRole.ADMIN ||
                            (teamMemberData?.permissions as TeamPermission[])?.includes('CAN_MANAGE_PROJECTS');

    if (!canCreateProject) {
        throw new Error("You do not have permission to create projects in this department.");
    }

    const { data, error } = await supabase.from('projects').insert({
        name: name.trim(),
        description: description?.trim() || null,
        team_id: deptData.team_id,
        department_id: departmentId,
        created_by: user.id,
    }).select().single();

    if (error) throw new Error(formatSupabaseError(error, "teamService.createProjectForDepartment"));
    if (!data) throw new Error("Failed to create project: No data returned.");

    return data as Project;
  },

  // Realtime subscriptions
  async subscribeToTeamUpdates(teamId: string, callback: (update: TeamUpdate) => void): Promise<RealtimeChannel> {
    const channel = supabase
        .channel(`team-updates-${teamId}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'team_updates',
            filter: `team_id=eq.${teamId}`
        }, async (payload) => {
            // Fetch the complete update with author info
            const { data } = await supabase
                .from('team_updates')
                .select('id, content, created_at, author_id')
                .eq('id', payload.new.id)
                .single();

            if (data) {
                // Fetch author profile
                const authorProfile = await this.getUserProfile(data.author_id);
                
                callback({
                    id: data.id,
                    content: data.content,
                    createdAt: data.created_at,
                    authorId: data.author_id,
                    authorName: authorProfile?.full_name || 'Unknown User',
                    authorAvatar: authorProfile?.avatar_url || null,
                });
            }
        })
        .subscribe();

    return channel;
  },

  async subscribeToTeamChat(teamId: string, callback: (message: TeamChatMessage) => void): Promise<RealtimeChannel> {
    const channel = supabase
        .channel(`team-chat-${teamId}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'team_chat_messages',
            filter: `team_id=eq.${teamId}`
        }, async (payload) => {
            // Fetch the complete message with author info
            const { data } = await supabase
                .from('team_chat_messages')
                .select('id, content, created_at, sender_id')
                .eq('id', payload.new.id)
                .single();

            if (data) {
                // Fetch author profile
                const authorProfile = await this.getUserProfile(data.sender_id);
                
                callback({
                    id: data.id,
                    content: data.content,
                    createdAt: data.created_at,
                    authorId: data.sender_id,
                    authorName: authorProfile?.full_name || 'Unknown User',
                    authorAvatar: authorProfile?.avatar_url || null,
                });
            }
        })
        .subscribe();

    return channel;
  },

  async subscribeToDepartmentChat(departmentId: string, callback: (message: DepartmentChatMessage) => void): Promise<RealtimeChannel> {
    const channel = supabase
        .channel(`department-chat-${departmentId}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'department_chat_messages',
            filter: `department_id=eq.${departmentId}`
        }, async (payload) => {
            // Fetch the complete message with author info
            const { data } = await supabase
                .from('department_chat_messages')
                .select('id, content, created_at, sender_id')
                .eq('id', payload.new.id)
                .single();

            if (data) {
                // Fetch author profile
                const authorProfile = await this.getUserProfile(data.sender_id);
                
                callback({
                    id: data.id,
                    content: data.content,
                    createdAt: data.created_at,
                    authorId: data.sender_id,
                    authorName: authorProfile?.full_name || 'Unknown User',
                    authorAvatar: authorProfile?.avatar_url || null,
                });
            }
        })
        .subscribe();

    return channel;
  },

  async subscribeToDepartmentUpdates(departmentId: string, callback: (update: DepartmentUpdate) => void): Promise<RealtimeChannel> {
    const channel = supabase
        .channel(`department-updates-${departmentId}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'department_updates',
            filter: `department_id=eq.${departmentId}`
        }, async (payload) => {
            // Fetch the complete update with author info
            const { data } = await supabase
                .from('department_updates')
                .select('id, content, created_at, author_id')
                .eq('id', payload.new.id)
                .single();

            if (data) {
                // Fetch author profile
                const authorProfile = await this.getUserProfile(data.author_id);
                
                callback({
                    id: data.id,
                    content: data.content,
                    createdAt: data.created_at,
                    authorId: data.author_id,
                    authorName: authorProfile?.full_name || 'Unknown User',
                    authorAvatar: authorProfile?.avatar_url || null,
                    departmentId: departmentId,
                });
            }
        })
        .subscribe();

    return channel;
  },

  async unsubscribeFromChannel(channel: RealtimeChannel): Promise<void> {
    await supabase.removeChannel(channel);
  },

  async transferTeamOwnership(teamId: string, newOwnerId: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const user = await getCurrentUser();
    
    try {
      // 1. Verify current user is the owner
      const { data: currentTeam, error: teamError } = await supabase
        .from('teams')
        .select('owner_id')
        .eq('id', teamId)
        .single();

      if (teamError || !currentTeam) {
        return { success: false, error: "Team not found." };
      }

      if (currentTeam.owner_id !== user.id) {
        return { success: false, error: "Only the team owner can transfer ownership." };
      }

      // 2. Verify new owner is a member of the team
      const { data: newOwnerMember, error: newOwnerError } = await supabase
        .from('team_members')
        .select('role, user_id')
        .eq('team_id', teamId)
        .eq('user_id', newOwnerId)
        .single();

      if (newOwnerError || !newOwnerMember) {
        return { success: false, error: "The selected user is not a member of this team." };
      }

      // 3. Get user profile for team update message
      const { data: newOwnerProfile } = await supabase
        .from('user_profiles')
        .select('full_name')
        .eq('id', newOwnerId)
        .single();

      // 4. Use the database RPC function for atomic ownership transfer
      const { data: rpcResult, error: rpcError } = await supabase.rpc('transfer_team_ownership', {
        p_team_id: teamId,
        p_new_owner_id: newOwnerId,
        p_current_user_id: user.id
      });

      if (rpcError) {
        console.error('RPC ownership transfer failed:', rpcError);
        
        // Fallback to manual transfer if RPC fails

        // Update the teams table owner_id first (most critical)
        const { error: updateTeamOwnerError } = await supabase
          .from('teams')
          .update({ owner_id: newOwnerId })
          .eq('id', teamId)
          .eq('owner_id', user.id); // Additional safety check

        if (updateTeamOwnerError) {
          return { success: false, error: "Failed to update team owner. Transfer aborted." };
        }

        // Update new owner to OWNER role with all permissions
        const { error: updateNewOwnerError } = await supabase
          .from('team_members')
          .update({ 
            role: UserRole.OWNER,
            permissions: Object.keys(TEAM_PERMISSIONS) as TeamPermission[]
          })
          .eq('team_id', teamId)
          .eq('user_id', newOwnerId);

        if (updateNewOwnerError) {
          // Revert team owner change
          await supabase
            .from('teams')
            .update({ owner_id: user.id })
            .eq('id', teamId);
          return { success: false, error: "Failed to update new owner role. Transfer reverted." };
        }

        // Update current owner to ADMIN role
        const { error: updateCurrentOwnerError } = await supabase
          .from('team_members')
          .update({ 
            role: UserRole.ADMIN,
            permissions: (Object.keys(TEAM_PERMISSIONS) as TeamPermission[]).filter(p => p !== 'CAN_DELETE_TEAM')
          })
          .eq('team_id', teamId)
          .eq('user_id', user.id);

        if (updateCurrentOwnerError) {
          console.warn('Failed to update previous owner to admin, but ownership transfer succeeded:', updateCurrentOwnerError);
        }
      } else if (!rpcResult) {
        return { success: false, error: "Ownership transfer failed. Please try again." };
      }

      // 5. Add team update notification
      const updateMessage = `Team ownership has been transferred to ${newOwnerProfile?.full_name || 'Unknown User'}.`;
      try {
        await this.addTeamUpdate(teamId, updateMessage);
      } catch (updateError) {
        console.warn('Failed to add team update for ownership transfer:', updateError);
      }

      return {
        success: true,
        message: "Ownership transferred successfully. You are now an admin of this team."
      };

    } catch (error: any) {
      console.error('Ownership transfer error:', error);
      return {
        success: false,
        error: error.message || "Failed to transfer ownership"
      };
    }
  },
};
