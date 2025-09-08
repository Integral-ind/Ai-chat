import { supabase } from './supabaseClient';
import { ResourceItem, ResourceItemType, GlobalSearchResultItem } from './types';
import { Database } from './types_db';
import { FolderIcon, DocumentTextIcon, PhotoIcon, FilmIcon, ArchiveBoxIcon, DocumentDuplicateIcon } from './constants';

// --- MODIFIED: The type for a DB resource now includes the optional 'shared_by' field from our RPC
type DbResource = Database['public']['Tables']['resources']['Row'] & {
  shared_by?: { id: string, name: string } | null;
};

const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const BUCKET_NAME = 'resources';
const GENERAL_FILES_FOLDER = '_general_files_';

const getFileTypeFromMime = (mimeType: string): ResourceItemType => {
  if (!mimeType) return ResourceItemType.OTHER;
  if (mimeType.startsWith('image/')) return ResourceItemType.IMAGE;
  if (mimeType.startsWith('video/')) return ResourceItemType.VIDEO;
  if (mimeType === 'application/pdf') return ResourceItemType.PDF;
  if (
    mimeType.startsWith('application/zip') ||
    mimeType.startsWith('application/x-rar-compressed') ||
    mimeType.startsWith('application/x-tar') ||
    mimeType.startsWith('application/gzip') ||
    mimeType.startsWith('application/vnd.rar')
  ) return ResourceItemType.ARCHIVE;
  if (
    mimeType.startsWith('text/') ||
    mimeType.includes('document') ||
    mimeType.includes('msword') ||
    mimeType.includes('wordprocessingml') ||
    mimeType.includes('presentation') ||
    mimeType.includes('spreadsheetml') ||
    mimeType === 'application/rtf' ||
    mimeType === 'application/vnd.oasis.opendocument.text'
  ) return ResourceItemType.DOCUMENT;
  return ResourceItemType.OTHER;
};

// --- MODIFIED: mapDbResourceToFrontend now handles the new 'shared_by' property
const mapDbResourceToFrontend = (dbResource: DbResource): ResourceItem => {
  let publicUrl: string | undefined = undefined;
  if (dbResource.resource_type !== ResourceItemType.FOLDER) {
    const { data: publicUrlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(dbResource.file_path);
    publicUrl = publicUrlData?.publicUrl;
  }

  return {
    id: dbResource.id,
    name: dbResource.file_name,
    type: dbResource.resource_type as ResourceItemType,
    sizeBytes: Number(dbResource.size_bytes) || 0,
    createdAt: dbResource.created_at,
    uploadedBy: dbResource.uploaded_by || '',
    filePath: dbResource.file_path,
    mimeType: dbResource.mime_type || '',
    publicUrl: publicUrl,
    projectId: dbResource.project_id || undefined,
    teamId: dbResource.team_id || undefined,
    parentFolderId: dbResource.parent_folder_id || undefined,
    starred: dbResource.starred || false,
    lastAccessedAt: dbResource.last_accessed_at || undefined,
    updatedAt: dbResource.updated_at || undefined,
    // --- NEW ---
    sharedBy: dbResource.shared_by || undefined,
  };
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

const getIconForResourceType = (type: ResourceItemType) => {
    switch (type) {
        case ResourceItemType.FOLDER: return FolderIcon;
        case ResourceItemType.DOCUMENT: return DocumentTextIcon;
        case ResourceItemType.IMAGE: return PhotoIcon;
        case ResourceItemType.VIDEO: return FilmIcon;
        case ResourceItemType.PDF: return DocumentTextIcon;
        case ResourceItemType.ARCHIVE: return ArchiveBoxIcon;
        default: return DocumentDuplicateIcon;
    }
};

const formatBytesForSearch = (bytes?: number): string => {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const getCurrentUserId = async (): Promise<string> => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw new Error("User not authenticated.");
    return user.id;
};

export const resourceService = {
  async uploadFile(
    file: File,
    userId: string,
    onProgress?: (percentage: number) => void,
    projectId?: string,
    teamId?: string,
    parentFolderId?: string | null
  ): Promise<ResourceItem> {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new Error(`File size exceeds ${MAX_FILE_SIZE_MB}MB limit.`);
    }

    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const uniqueFileName = `${crypto.randomUUID()}.${fileExt}`;

    let storagePathPrefix = `public/${userId}/`;
    if (projectId) {
        storagePathPrefix += `projects/${projectId}/`;
    } else if (teamId) {
        storagePathPrefix += `teams/${teamId}/`;
    } else {
        storagePathPrefix += `${GENERAL_FILES_FOLDER}/`;
    }

    const filePathInBucket = `${storagePathPrefix}${uniqueFileName}`;

    onProgress?.(10);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePathInBucket, file, {
        cacheControl: '3600',
        upsert: false,
      });

    onProgress?.(50);

    if (uploadError) {
      throw new Error(formatSupabaseError(uploadError, `Upload to storage failed: ${uploadError.message}`));
    }

    onProgress?.(75);

    const resourceType = getFileTypeFromMime(file.type || 'application/octet-stream');

    const resourceToInsert: Database['public']['Tables']['resources']['Insert'] = {
      bucket_name: BUCKET_NAME,
      file_name: file.name,
      file_path: filePathInBucket,
      mime_type: file.type || 'application/octet-stream',
      size_bytes: file.size,
      resource_type: resourceType,
      uploaded_by: userId,
      project_id: projectId || null,
      team_id: teamId || null,
      parent_folder_id: parentFolderId || null,
    };

    const { data: dbResource, error: dbError } = await supabase
      .from('resources')
      .insert(resourceToInsert)
      .select()
      .single();

    if (dbError) {
      await supabase.storage.from(BUCKET_NAME).remove([filePathInBucket]).catch(err => console.error("Storage cleanup failed after DB error:", err));
      throw new Error(formatSupabaseError(dbError, `Failed to save file metadata`));
    }

    onProgress?.(100);

    return mapDbResourceToFrontend(dbResource as DbResource);
  },

  async createFolder(
    folderName: string,
    userId: string,
    parentFolderId?: string | null,
    projectId?: string | null,
    teamId?: string | null
  ): Promise<ResourceItem> {
    if (!folderName.trim()) {
      throw new Error("Folder name cannot be empty.");
    }

    const pathSegments = ['public', userId];
    if(projectId) pathSegments.push(`projects/${projectId}`);
    else if(teamId) pathSegments.push(`teams/${teamId}`);
    else pathSegments.push(GENERAL_FILES_FOLDER);

    if(parentFolderId) {
        pathSegments.push(`parent_${parentFolderId}`);
    } else {
        pathSegments.push('root');
    }
    pathSegments.push(folderName.trim());
    const logicalFolderPath = pathSegments.join('/') + '/';

    const resourceToInsert: Database['public']['Tables']['resources']['Insert'] = {
      bucket_name: BUCKET_NAME,
      file_name: folderName.trim(),
      file_path: logicalFolderPath,
      mime_type: 'inode/directory',
      size_bytes: 0,
      resource_type: ResourceItemType.FOLDER,
      uploaded_by: userId,
      project_id: projectId || null,
      team_id: teamId || null,
      parent_folder_id: parentFolderId || null,
    };

    const { data: dbResource, error: dbError } = await supabase
      .from('resources')
      .insert(resourceToInsert)
      .select()
      .single();

    if (dbError) {
      if (dbError.code === '23505') {
          throw new Error(`A folder named "${folderName.trim()}" already exists in this location.`);
      }
      throw new Error(formatSupabaseError(dbError, `Failed to create folder metadata`));
    }

    return mapDbResourceToFrontend(dbResource as DbResource);
  },

  async findOrCreateTeamRootFolder(teamId: string, teamName: string, userId: string): Promise<ResourceItem> {
    if (!teamId || !teamName || !userId) {
        throw new Error("Team ID, Team Name, and User ID are required to find or create a team folder.");
    }

    const { data: existingFolder, error: findError } = await supabase
        .from('resources')
        .select('*')
        .eq('team_id', teamId)
        .is('parent_folder_id', null)
        .eq('resource_type', ResourceItemType.FOLDER)
        .limit(1)
        .maybeSingle();

    if (findError && findError.code !== 'PGRST116') {
        throw new Error(formatSupabaseError(findError, 'Failed to check for existing team folder'));
    }

    if (existingFolder) {
        return mapDbResourceToFrontend(existingFolder as DbResource);
    }

    try {
        const newFolder = await this.createFolder(
            teamName,
            userId,
            null,
            null,
            teamId
        );
        return newFolder;
    } catch (createError: any) {
        if (createError.message.includes('already exists')) {
            const { data: retryFolder, error: retryError } = await supabase
                .from('resources')
                .select('*')
                .eq('team_id', teamId)
                .is('parent_folder_id', null)
                .eq('resource_type', ResourceItemType.FOLDER)
                .limit(1)
                .maybeSingle();
            if (retryError || !retryFolder) {
                throw new Error("Failed to create or find team folder after race condition.");
            }
            return mapDbResourceToFrontend(retryFolder as DbResource);
        }
        throw createError;
    }
  },

  // --- NEW: Function to share items with connected users ---
  async shareItems(itemIds: string[], recipientUserIds: string[]): Promise<boolean> {
    if (!itemIds.length || !recipientUserIds.length) {
      throw new Error("Items and recipients must be provided for sharing.");
    }
    const currentUserId = await getCurrentUserId();

    const sharesToInsert = itemIds.flatMap(itemId =>
      recipientUserIds.map(recipientId => ({
        resource_id: itemId,
        shared_by_user_id: currentUserId,
        shared_with_user_id: recipientId,
        permissions: 'view' // Default permission
      }))
    );

    const { error } = await supabase
      .from('resource_shares')
      .insert(sharesToInsert, {
         onConflict: 'resource_id,shared_with_user_id'
      });

    if (error) {
      throw new Error(formatSupabaseError(error, 'Failed to share items'));
    }

    return true;
  },

  async renameItem(itemId: string, newName: string): Promise<ResourceItem> {
    if (!itemId || !newName.trim()) {
      throw new Error("Item ID and new name are required.");
    }

    const { data: currentItem, error: fetchError } = await supabase
      .from('resources')
      .select('*')
      .eq('id', itemId)
      .single();

    if (fetchError) {
      throw new Error(formatSupabaseError(fetchError, 'Failed to fetch item for rename'));
    }

    if (!currentItem) {
      throw new Error('Item not found.');
    }

    const { data: updatedResource, error: updateError } = await supabase
      .from('resources')
      .update({
        file_name: newName.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', itemId)
      .select()
      .single();

    if (updateError) {
      if (updateError.code === '23505') {
        throw new Error(`An item named "${newName.trim()}" already exists in this location.`);
      }
      throw new Error(formatSupabaseError(updateError, 'Failed to rename item'));
    }

    return mapDbResourceToFrontend(updatedResource as DbResource);
  },

  async duplicateItem(itemId: string, newName?: string): Promise<ResourceItem> {
    if (!itemId) {
      throw new Error("Item ID is required.");
    }

    const { data: originalItem, error: fetchError } = await supabase
      .from('resources')
      .select('*')
      .eq('id', itemId)
      .single();

    if (fetchError || !originalItem) {
      throw new Error("Item not found or could not be accessed.");
    }

    const duplicateName = newName || `${originalItem.file_name} (Copy)`;

    if (originalItem.resource_type === ResourceItemType.FOLDER) {
      const resourceToInsert: Database['public']['Tables']['resources']['Insert'] = {
        bucket_name: originalItem.bucket_name,
        file_name: duplicateName,
        file_path: originalItem.file_path.replace(originalItem.file_name, duplicateName),
        mime_type: originalItem.mime_type,
        size_bytes: originalItem.size_bytes,
        resource_type: originalItem.resource_type as ResourceItemType,
        uploaded_by: originalItem.uploaded_by,
        project_id: originalItem.project_id,
        team_id: originalItem.team_id,
        parent_folder_id: originalItem.parent_folder_id,
      };

      const { data: duplicatedResource, error: duplicateError } = await supabase
        .from('resources')
        .insert(resourceToInsert)
        .select()
        .single();

      if (duplicateError) {
        throw new Error(formatSupabaseError(duplicateError, 'Failed to duplicate folder'));
      }

      return mapDbResourceToFrontend(duplicatedResource as DbResource);
    } else {
      const originalPath = originalItem.file_path;
      const fileExt = originalItem.file_name.split('.').pop()?.toLowerCase() || 'bin';
      const uniqueFileName = `${crypto.randomUUID()}.${fileExt}`;

      const pathParts = originalPath.split('/');
      pathParts[pathParts.length - 1] = uniqueFileName;
      const newFilePath = pathParts.join('/');

      const { error: copyError } = await supabase.storage
        .from(BUCKET_NAME)
        .copy(originalPath, newFilePath);

      if (copyError) {
        throw new Error(formatSupabaseError(copyError, 'Failed to copy file in storage'));
      }

      const resourceToInsert: Database['public']['Tables']['resources']['Insert'] = {
        bucket_name: originalItem.bucket_name,
        file_name: duplicateName,
        file_path: newFilePath,
        mime_type: originalItem.mime_type,
        size_bytes: originalItem.size_bytes,
        resource_type: originalItem.resource_type as ResourceItemType,
        uploaded_by: originalItem.uploaded_by,
        project_id: originalItem.project_id,
        team_id: originalItem.team_id,
        parent_folder_id: originalItem.parent_folder_id,
      };

      const { data: duplicatedResource, error: duplicateError } = await supabase
        .from('resources')
        .insert(resourceToInsert)
        .select()
        .single();

      if (duplicateError) {
        await supabase.storage.from(BUCKET_NAME).remove([newFilePath]).catch(err =>
          console.error("Storage cleanup failed after DB error:", err)
        );
        throw new Error(formatSupabaseError(duplicateError, 'Failed to duplicate file'));
      }

      return mapDbResourceToFrontend(duplicatedResource as DbResource);
    }
  },

  async moveItem(itemId: string, newParentFolderId: string | null): Promise<ResourceItem> {
    if (!itemId) {
      throw new Error("Item ID is required.");
    }

    const { data: updatedResource, error: updateError } = await supabase
      .from('resources')
      .update({
        parent_folder_id: newParentFolderId,
        updated_at: new Date().toISOString()
      })
      .eq('id', itemId)
      .select()
      .single();

    if (updateError) {
      throw new Error(formatSupabaseError(updateError, 'Failed to move item'));
    }

    return mapDbResourceToFrontend(updatedResource as DbResource);
  },

  // --- REFACTORED: getItemsByParent now uses our new database function ---
  async getItemsByParent(
    userId: string,
    parentFolderId: string | null = null,
    projectId?: string | null,
    teamId?: string | null
  ): Promise<ResourceItem[]> {
    if (!userId) throw new Error("User ID is required to fetch items.");

    const { data, error } = await supabase.rpc('get_user_resources', {
      p_user_id: userId,
      p_parent_folder_id: parentFolderId,
      p_project_id: projectId,
      p_team_id: teamId,
    });

    if (error) {
      throw new Error(formatSupabaseError(error, `Failed to fetch items`));
    }

    if (!data) {
        return [];
    }

    const mappedData = data.map(item => mapDbResourceToFrontend(item as DbResource));

    return mappedData.sort((a, b) => {
        if (a.type === b.type) {
            return a.name.localeCompare(b.name);
        }
        return a.type === ResourceItemType.FOLDER ? -1 : 1;
    });
  },

  async getFilesForProject(projectId: string): Promise<ResourceItem[]> {
    const user = await getCurrentUserId();
    if (!projectId) throw new Error("Project ID is required to fetch project files.");
    return this.getItemsByParent(user, null, projectId, null);
  },

  async getFilesForTeam(teamId: string): Promise<ResourceItem[]> {
    const user = await getCurrentUserId();
    if (!teamId) throw new Error("Team ID is required to fetch files.");
    return this.getItemsByParent(user, null, null, teamId);
  },

  async deleteFile(fileId: string, filePathInBucket?: string): Promise<boolean> {
    if (!fileId) throw new Error("File ID is required for deletion.");

    const {data: resourceMeta, error: metaError} = await supabase
        .from('resources')
        .select('resource_type, file_path')
        .eq('id', fileId)
        .single();

    if (metaError && metaError.code !== 'PGRST116') {
        throw new Error(formatSupabaseError(metaError, `Failed to get resource metadata for ${fileId}`));
    }

    if (resourceMeta && resourceMeta.resource_type !== ResourceItemType.FOLDER && resourceMeta.file_path) {
        const { error: storageError } = await supabase.storage
          .from(BUCKET_NAME)
          .remove([resourceMeta.file_path]);

        if (storageError && storageError.message !== 'The resource was not found' && storageError.message !== 'Bucket not found') {
           console.warn(formatSupabaseError(storageError, 'Storage Delete Warning (proceeding with DB deletion)'));
        }
    } else if (!resourceMeta && filePathInBucket && !filePathInBucket.endsWith('/')) {
      console.warn(`Resource metadata for ${fileId} not found. Attempting storage deletion with provided path: ${filePathInBucket}.`);
       const { error: storageError } = await supabase.storage.from(BUCKET_NAME).remove([filePathInBucket]);
        if (storageError && storageError.message !== 'The resource was not found' && storageError.message !== 'Bucket not found') {
           console.warn(formatSupabaseError(storageError, 'Fallback Storage Delete Warning'));
        }
    }

    const { error: dbError } = await supabase
      .from('resources')
      .delete()
      .eq('id', fileId);

    if (dbError) {
      throw new Error(formatSupabaseError(dbError, `Failed to delete resource metadata for ${fileId}`));
    }
    return true;
  },

  async bulkDelete(itemIds: string[]): Promise<boolean> {
    if (!itemIds.length) throw new Error("No items selected for deletion.");

    const { data: itemsToDelete, error: fetchError } = await supabase
      .from('resources')
      .select('id, resource_type, file_path')
      .in('id', itemIds);

    if (fetchError) {
      throw new Error(formatSupabaseError(fetchError, 'Failed to fetch items for bulk deletion'));
    }

    const filesToDelete = itemsToDelete?.filter(item =>
      item.resource_type !== ResourceItemType.FOLDER && item.file_path
    ).map(item => item.file_path) || [];

    if (filesToDelete.length > 0) {
      const { error: storageError } = await supabase.storage
        .from(BUCKET_NAME)
        .remove(filesToDelete);

      if (storageError) {
        console.warn(formatSupabaseError(storageError, 'Bulk storage deletion warning (proceeding with DB deletion)'));
      }
    }

    const { error: dbError } = await supabase
      .from('resources')
      .delete()
      .in('id', itemIds);

    if (dbError) {
      throw new Error(formatSupabaseError(dbError, 'Failed to bulk delete items'));
    }

    return true;
  },

  async toggleStar(itemId: string, isStarred: boolean): Promise<ResourceItem> {
    if (!itemId) throw new Error("Item ID is required.");

    const { data: updatedResource, error: updateError } = await supabase
      .from('resources')
      .update({
        starred: isStarred,
        updated_at: new Date().toISOString()
      })
      .eq('id', itemId)
      .select()
      .single();

    if (updateError) {
      throw new Error(formatSupabaseError(updateError, 'Failed to update star status'));
    }

    return mapDbResourceToFrontend(updatedResource as DbResource);
  },

  async generateShareLink(itemId: string, expiresIn?: number): Promise<string> {
    if (!itemId) throw new Error("Item ID is required.");

    const { data: item, error: fetchError } = await supabase
      .from('resources')
      .select('*')
      .eq('id', itemId)
      .single();

    if (fetchError || !item) {
      throw new Error("Item not found or could not be accessed.");
    }

    if (item.resource_type === ResourceItemType.FOLDER) {
      throw new Error("Cannot generate share links for folders.");
    }

    const expirationTime = expiresIn || 3600; // Default 1 hour
    const { data: signedUrlData, error: urlError } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(item.file_path, expirationTime);

    if (urlError || !signedUrlData) {
      throw new Error(formatSupabaseError(urlError, 'Failed to generate share link'));
    }

    return signedUrlData.signedUrl;
  },

  async getItemDetails(itemId: string): Promise<ResourceItem> {
    if (!itemId) throw new Error("Item ID is required.");

    const { data: item, error: fetchError } = await supabase
      .from('resources')
      .select('*')
      .eq('id', itemId)
      .single();

    if (fetchError) {
      throw new Error(formatSupabaseError(fetchError, 'Failed to fetch item details'));
    }

    if (!item) {
      throw new Error('Item not found.');
    }

    return mapDbResourceToFrontend(item as DbResource);
  },

  async getRecentFiles(userId: string, limit: number = 10): Promise<ResourceItem[]> {
    if (!userId) throw new Error("User ID is required.");

    const { data, error } = await supabase
      .from('resources')
      .select('*')
      .eq('uploaded_by', userId)
      .neq('resource_type', ResourceItemType.FOLDER)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(formatSupabaseError(error, 'Failed to fetch recent files'));
    }

    return data.map(item => mapDbResourceToFrontend(item as DbResource));
  },

  async getStarredItems(userId: string): Promise<ResourceItem[]> {
    if (!userId) throw new Error("User ID is required.");

    const { data, error } = await supabase
      .from('resources')
      .select('*')
      .eq('uploaded_by', userId)
      .eq('starred', true)
      .order('updated_at', { ascending: false });

    if (error) {
      throw new Error(formatSupabaseError(error, 'Failed to fetch starred items'));
    }

    return data.map(item => mapDbResourceToFrontend(item as DbResource));
  },

  async getStorageUsage(userId: string): Promise<{ totalBytes: number; itemCount: number }> {
    if (!userId) throw new Error("User ID is required.");

    const { data, error } = await supabase
      .from('resources')
      .select('size_bytes')
      .eq('uploaded_by', userId)
      .neq('resource_type', ResourceItemType.FOLDER);

    if (error) {
      throw new Error(formatSupabaseError(error, 'Failed to fetch storage usage'));
    }

    const totalBytes = data.reduce((sum, item) => sum + (item.size_bytes || 0), 0);
    return { totalBytes, itemCount: data.length };
  },

  async search(query: string, currentUserId?: string): Promise<GlobalSearchResultItem[]> {
    if (!query.trim()) return [];
    const userIdToQuery = currentUserId || (await getCurrentUserId());

    const { data: resourcesData, error } = await supabase
      .from('resources')
      .select('*')
      .eq('uploaded_by', userIdToQuery)
      .ilike('file_name', `%${query}%`)
      .limit(10);

    if (error) {
      console.error('Error searching resources:', formatSupabaseError(error, 'resourceService.search'));
      return [];
    }
    if (!resourcesData) return [];

    const mappedResources = resourcesData.map(item => mapDbResourceToFrontend(item as DbResource));

    return mappedResources.map(item => ({
      id: item.id,
      title: item.name,
      type: 'resource',
      description: item.type === 'folder' ? 'Folder' : formatBytesForSearch(item.sizeBytes),
      icon: getIconForResourceType(item.type),
      path: '/app/resources',
      state: { focusItemId: item.id },
      timestamp: item.createdAt,
    }));
  },
};