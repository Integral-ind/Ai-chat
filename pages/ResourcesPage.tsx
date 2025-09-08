
import React, { useState, useMemo, useEffect, useCallback, useRef, useContext } from 'react';
// --- MODIFIED: Removed Avatar from this import to prevent crash if it doesn't exist ---
import { Card, Button, Modal, ProgressBar as CustomProgressBar } from '../components';
import { ResourceItem, ResourceItemType, User as FrontendUser, DarkModeContextType, ConnectedUser } from '../types';
import { resourceService } from '../resourceService';
import { connectService } from '../connectService';
import { supabase } from '../supabaseClient';
import { DarkModeContext } from '../App';
import { useLocation, useNavigate } from 'react-router-dom';

import {
    FolderIcon as OriginalFolderIcon,
    DocumentDuplicateIcon,
    PhotoIcon,
    FilmIcon,
    ArchiveBoxIcon,
    FileTextIcon,
    LayoutGridIcon,
    ListIcon,
    UploadCloudIcon,
    Trash2Icon,
    ArrowDownTrayIcon as DownloadIcon,
    PlusIcon,
    ChevronRightIcon,
    EllipsisVerticalIcon,
    PencilIcon,
    EyeIcon,
    ShareIcon,
    CopyIcon,
    ScissorsIcon,
    StarIcon,
    ClockIcon,
    FilterIcon,
    SortAscendingIcon,
    SortDescendingIcon,
    CheckIcon,
    XMarkIcon,
    MagnifyingGlassIcon,
    ArrowPathIcon,
    InformationCircleIcon,
    UserGroupIcon,
} from '../constants';

// --- NEW/FIXED: A simple Avatar component to use if you don't have one ---
const Avatar: React.FC<{ src: string | null, name: string, size?: 'sm' | 'md' }> = ({ src, name, size = 'md' }) => {
    const sizeClasses = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm';
    if (src) {
        return <img src={src} alt={name} className={`rounded-full object-cover ${sizeClasses}`} />;
    }
    const initial = name ? name.charAt(0).toUpperCase() : '?';
    return (
        <div className={`flex items-center justify-center rounded-full bg-primary text-white font-bold ${sizeClasses}`}>
            {initial}
        </div>
    );
};

// Utility to format bytes
const formatBytes = (bytes: number, decimals = 2): string => {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

// Types for enhanced features
type SortOption = 'name' | 'date' | 'size' | 'type';
type SortDirection = 'asc' | 'desc';
type ViewMode = 'grid' | 'list' | 'compact';
type FilterType = 'all' | 'folders' | 'images' | 'documents' | 'videos' | 'archives' | 'other';

interface ClipboardItem {
  item: ResourceItem;
  action: 'copy' | 'cut';
}

// Utility function to get icon for item type
const getIconForItemType = (type: ResourceItemType, sizeClass = "w-10 h-10") => {
  switch (type) {
    case ResourceItemType.FOLDER: return <OriginalFolderIcon className={`${sizeClass} text-amber-500 dark:text-amber-400`} />;
    case ResourceItemType.DOCUMENT: return <FileTextIcon className={`${sizeClass} text-blue-500 dark:text-blue-400`} />;
    case ResourceItemType.IMAGE: return <PhotoIcon className={`${sizeClass} text-green-500 dark:text-green-400`} />;
    case ResourceItemType.VIDEO: return <FilmIcon className={`${sizeClass} text-purple-500 dark:text-purple-400`} />;
    case ResourceItemType.PDF: return <FileTextIcon className={`${sizeClass} text-red-500 dark:text-red-400`} />;
    case ResourceItemType.ARCHIVE: return <ArchiveBoxIcon className={`${sizeClass} text-gray-500 dark:text-gray-400`} />;
    default: return <DocumentDuplicateIcon className={`${sizeClass} text-gray-400 dark:text-gray-500`} />;
  }
};

const ShareModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onShare: (recipientIds: string[]) => Promise<void>;
  itemsToShare: ResourceItem[];
  connections: ConnectedUser[];
  isSharing: boolean;
  shareError: string | null;
}> = ({ isOpen, onClose, onShare, itemsToShare, connections, isSharing, shareError }) => {
  const [selectedConnectionIds, setSelectedConnectionIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSelectedConnectionIds(new Set());
      setSearchTerm('');
    }
  }, [isOpen]);

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedConnectionIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedConnectionIds(newSelection);
  };

  const filteredConnections = useMemo(() => {
    if (!searchTerm.trim()) return connections;
    return connections.filter(c =>
      (c.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [connections, searchTerm]);

  const handleShareClick = () => {
    if (selectedConnectionIds.size > 0) {
      onShare(Array.from(selectedConnectionIds));
    }
  };

  const itemSummary = itemsToShare.length === 1
    ? `"${itemsToShare[0].name}"`
    : `${itemsToShare.length} items`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Share ${itemSummary}`}
      onSave={handleShareClick}
      saveLabel={`Share (${selectedConnectionIds.size})`}
      isSaving={isSharing}
      saveDisabled={selectedConnectionIds.size === 0 || isSharing}
    >
      <div className="space-y-4">
        <p className="text-sm text-muted dark:text-muted-dark">
          Select connections to share with. They will be able to view and access these resources.
        </p>
        <input
          type="text"
          placeholder="Search connections..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="input-style w-full"
        />
        <div className="max-h-64 overflow-y-auto space-y-2 pr-2 border-t border-b border-border dark:border-border-dark py-2">
          {filteredConnections.length > 0 ? (
            filteredConnections.map(conn => (
              <div
                key={conn.id}
                className="flex items-center p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                onClick={() => toggleSelection(conn.id)}
              >
                <input
                  type="checkbox"
                  checked={selectedConnectionIds.has(conn.id)}
                  readOnly
                  className="w-4 h-4 text-primary bg-white border-gray-300 rounded focus:ring-primary mr-3"
                />
                <Avatar src={conn.avatar_url} name={conn.full_name || ''} size="sm" />
                <div className="ml-3">
                  <p className="text-sm font-medium">{conn.full_name}</p>
                  <p className="text-xs text-muted dark:text-muted-dark">{conn.email}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-sm text-muted dark:text-muted-dark py-4">No connections found.</p>
          )}
        </div>
        {shareError && <p className="text-sm text-red-500">{shareError}</p>}
      </div>
    </Modal>
  );
};


const ContextMenu: React.FC<{
  isOpen: boolean;
  position: { x: number; y: number };
  item: ResourceItem | null;
  onClose: () => void;
  onAction: (action: string, item: ResourceItem) => void;
  clipboardItem: ClipboardItem | null;
}> = ({ isOpen, position, item, onClose, onAction, clipboardItem }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  if (!isOpen || !item) return null;

  const menuItems = [
    { icon: EyeIcon, label: 'Open', action: 'open', disabled: false, show: true },
    { icon: ShareIcon, label: 'Share', action: 'share', disabled: false, show: true },
    { icon: DownloadIcon, label: 'Download', action: 'download', disabled: item.type === ResourceItemType.FOLDER, show: item.type !== ResourceItemType.FOLDER },
    { icon: PencilIcon, label: 'Rename', action: 'rename', disabled: false, show: true },
    { icon: CopyIcon, label: 'Copy', action: 'copy', disabled: false, show: true },
    { icon: ScissorsIcon, label: 'Cut', action: 'cut', disabled: false, show: true },
    { icon: StarIcon, label: item.starred ? 'Remove from Starred' : 'Add to Starred', action: 'star', disabled: false, show: true, className: item.starred ? 'text-yellow-500' : '' },
    { icon: InformationCircleIcon, label: 'Details', action: 'details', disabled: false, show: true },
    { icon: Trash2Icon, label: 'Delete', action: 'delete', disabled: false, show: true, className: 'text-red-500' }
  ];

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-[160px]"
      style={{
        left: Math.min(position.x, window.innerWidth - 200),
        top: Math.min(position.y, window.innerHeight - 300)
      }}
    >
      {menuItems.filter(menuItem => menuItem.show).map((menuItem, index) => (
        <button key={index} onClick={() => { onAction(menuItem.action, item); onClose(); }} disabled={menuItem.disabled} className={`w-full px-3 py-2 text-left text-sm flex items-center space-x-2 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed ${menuItem.className || ''}`}>
          <menuItem.icon className="w-4 h-4" />
          <span>{menuItem.label}</span>
        </button>
      ))}
      {clipboardItem && (
        <>
          <hr className="my-1 border-gray-200 dark:border-gray-700" />
          <button onClick={() => { onAction('paste', item); onClose(); }} className="w-full px-3 py-2 text-left text-sm flex items-center space-x-2 hover:bg-gray-100 dark:hover:bg-gray-700">
            <DocumentDuplicateIcon className="w-4 h-4" />
            <span>Paste {clipboardItem.action === 'cut' ? '(Move)' : '(Copy)'}</span>
          </button>
        </>
      )}
    </div>
  );
};

const RenameModal: React.FC<{
  isOpen: boolean;
  item: ResourceItem | null;
  onClose: () => void;
  onRename: (newName: string) => Promise<void>;
}> = ({ isOpen, item, onClose, onRename }) => {
  const [newName, setNewName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  useEffect(() => {
    if (isOpen && item) {
      const nameWithoutExt = item.type === ResourceItemType.FOLDER
        ? item.name
        : item.name.substring(0, item.name.lastIndexOf('.')) || item.name;
      setNewName(nameWithoutExt);
    }
  }, [isOpen, item]);

  const handleSubmit = async () => {
    if (!newName.trim() || !item) return;
    setIsRenaming(true);
    try {
      let finalName = newName.trim();
      if (item.type !== ResourceItemType.FOLDER) {
        const ext = item.name.substring(item.name.lastIndexOf('.'));
        if (ext && !finalName.endsWith(ext)) { finalName += ext; }
      }
      await onRename(finalName);
      onClose();
    } catch (error) { console.error('Rename failed:', error); }
    finally { setIsRenaming(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Rename ${item?.type === ResourceItemType.FOLDER ? 'Folder' : 'File'}`} onSave={handleSubmit} saveLabel="Rename" isSaving={isRenaming} saveDisabled={!newName.trim() || isRenaming}>
      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
        <label className="block text-sm font-medium text-muted dark:text-muted-dark mb-1">{item?.type === ResourceItemType.FOLDER ? 'Folder' : 'File'} Name</label>
        <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} className="input-style w-full" placeholder="Enter new name" required autoFocus />
        {item?.type !== ResourceItemType.FOLDER && (<p className="text-xs text-muted dark:text-muted-dark mt-1">File extension will be preserved automatically</p>)}
      </form>
    </Modal>
  );
};

const DetailsModal: React.FC<{
  isOpen: boolean;
  item: ResourceItem | null;
  onClose: () => void;
}> = ({ isOpen, item, onClose }) => {
  if (!item) return null;
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="File Details" size="md">
      <div className="space-y-4">
        <div className="flex items-center space-x-3">
          {getIconForItemType(item.type, "w-12 h-12")}
          <div>
            <h3 className="font-semibold text-lg">{item.name}</h3>
            <p className="text-sm text-muted dark:text-muted-dark capitalize">{item.type}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><label className="font-medium text-muted dark:text-muted-dark">Size:</label><p>{item.type === ResourceItemType.FOLDER ? 'Folder' : formatBytes(item.sizeBytes)}</p></div>
          <div><label className="font-medium text-muted dark:text-muted-dark">Created:</label><p>{new Date(item.createdAt).toLocaleString()}</p></div>
          <div><label className="font-medium text-muted dark:text-muted-dark">Type:</label><p className="capitalize">{item.type}</p></div>
          {item.mimeType && (<div><label className="font-medium text-muted dark:text-muted-dark">MIME Type:</label><p>{item.mimeType}</p></div>)}
        </div>
        {item.publicUrl && item.type === ResourceItemType.IMAGE && (
          <div>
            <label className="font-medium text-muted dark:text-muted-dark block mb-2">Preview:</label>
            <img src={item.publicUrl} alt={item.name} className="max-w-full h-48 object-contain rounded" />
          </div>
        )}
      </div>
    </Modal>
  );
};

const CreateFolderModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onCreate: (folderName: string) => Promise<void>;
}> = ({ isOpen, onClose, onCreate }) => {
  const [folderName, setFolderName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = async () => {
    if (!folderName.trim()) { alert("Folder name cannot be empty."); return; }
    setIsCreating(true);
    try {
      await onCreate(folderName.trim());
      setFolderName('');
    } catch (error) { console.error("Error creating folder:", error); }
    finally { setIsCreating(false); }
  };

  useEffect(() => { if (isOpen) setFolderName(''); }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Folder" onSave={handleSubmit} saveLabel="Create Folder" isSaving={isCreating} saveDisabled={!folderName.trim() || isCreating}>
      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
        <label className="block text-sm font-medium text-muted dark:text-muted-dark mb-1">Folder Name</label>
        <input type="text" value={folderName} onChange={(e) => setFolderName(e.target.value)} className="input-style w-full" placeholder="Enter folder name" required autoFocus />
      </form>
    </Modal>
  );
};

// Main Component
export const ResourcesPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState<FrontendUser | null>(null);
  const [items, setItems] = useState<ResourceItem[]>([]);
  const [originalItems, setOriginalItems] = useState<ResourceItem[]>([]);

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(() => location.state?.initialFolderId || null);
  const [teamContext, setTeamContext] = useState<{ id: string; name: string } | null>(() => location.state?.teamContext || null);
  const [folderHierarchy, setFolderHierarchy] = useState<ResourceItem[]>([]);

  const [viewType, setViewType] = useState<ViewMode>('grid');
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<ResourceItem | null>(null);
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [itemToRename, setItemToRename] = useState<ResourceItem | null>(null);
  const [itemToShowDetails, setItemToShowDetails] = useState<ResourceItem | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [clipboardItem, setClipboardItem] = useState<ClipboardItem | null>(null);

  const [contextMenu, setContextMenu] = useState<{ isOpen: boolean; position: { x: number; y: number }; item: ResourceItem | null; }>({ isOpen: false, position: { x: 0, y: 0 }, item: null });
  const darkModeContext = useContext<DarkModeContextType | undefined>(DarkModeContext);
  const dragAreaRef = useRef<HTMLDivElement>(null);

  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [itemsToShare, setItemsToShare] = useState<ResourceItem[]>([]);
  const [connections, setConnections] = useState<ConnectedUser[]>([]);
  const [isSharing, setIsSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  const fetchCurrentUserAndSet = useCallback(async () => {
    setIsLoading(true);
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.error("Error fetching session:", sessionError);
      setPageError("Failed to verify authentication.");
      setCurrentUser(null);
      setIsLoading(false);
      return;
    }
    if (session?.user) {
        setCurrentUser({
            id: session.user.id,
            name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
            email: session.user.email || '',
            avatar_url: session.user.user_metadata?.avatar_url || null,
            full_name: session.user.user_metadata?.full_name || null
        });
    } else {
      setCurrentUser(null);
      setPageError("User not authenticated. Please log in to view resources.");
      setIsLoading(false);
    }
  }, []);

  const fetchResources = useCallback(async () => {
    if (!currentUser) {
      setItems([]);
      setOriginalItems([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setPageError(null);
    try {
      const fetchedItems = await resourceService.getItemsByParent(
        currentUser.id,
        currentFolderId,
        null,
        teamContext?.id || null
      );
      setItems(fetchedItems);
      setOriginalItems(fetchedItems);

      if (teamContext && location.state?.initialFolderId && folderHierarchy.length === 0) {
        const teamRootFolder = await resourceService.getItemDetails(location.state.initialFolderId);
        if (teamRootFolder) {
          setFolderHierarchy([teamRootFolder]);
        }
      }
    } catch (err) {
      setPageError((err as Error).message || "Failed to load resources.");
      console.error("Error fetching resources:", err);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, currentFolderId, teamContext, location.state]);

  useEffect(() => {
    fetchCurrentUserAndSet();
  }, [fetchCurrentUserAndSet]);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  useEffect(() => {
    if (location.state?.triggerFileUpload && fileInputRef.current) {
        fileInputRef.current.click();
        navigate(location.pathname, { replace: true, state: {} });
    }
    
    // Add this new condition for direct upload
    if (location.state?.triggerDirectUpload && location.state?.selectedFile) {
        setFileToUpload(location.state.selectedFile);
        triggerUpload(location.state.selectedFile);
        navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  const filteredAndSortedItems = useMemo(() => {
    let filtered = [...originalItems];
    if (searchQuery.trim()) { filtered = filtered.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase())); }
    if (filterType !== 'all') {
      filtered = filtered.filter(item => {
        switch (filterType) {
          case 'folders': return item.type === ResourceItemType.FOLDER;
          case 'images': return item.type === ResourceItemType.IMAGE;
          case 'documents': return item.type === ResourceItemType.DOCUMENT || item.type === ResourceItemType.PDF;
          case 'videos': return item.type === ResourceItemType.VIDEO;
          case 'archives': return item.type === ResourceItemType.ARCHIVE;
          case 'other': return ![ResourceItemType.FOLDER, ResourceItemType.IMAGE, ResourceItemType.DOCUMENT, ResourceItemType.PDF, ResourceItemType.VIDEO, ResourceItemType.ARCHIVE].includes(item.type);
          default: return true;
        }
      });
    }
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      switch (sortBy) {
        case 'name': aValue = a.name.toLowerCase(); bValue = b.name.toLowerCase(); break;
        case 'date': aValue = new Date(a.createdAt).getTime(); bValue = new Date(b.createdAt).getTime(); break;
        case 'size': aValue = a.sizeBytes; bValue = b.sizeBytes; break;
        case 'type': aValue = a.type; bValue = b.type; break;
        default: return 0;
      }
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return filtered;
  }, [originalItems, searchQuery, filterType, sortBy, sortDirection]);

  useEffect(() => { setItems(filteredAndSortedItems); }, [filteredAndSortedItems]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => { if (event.target.files && event.target.files[0]) { setFileToUpload(event.target.files[0]); setUploadError(null); } };

  const triggerUpload = async (file: File | null = fileToUpload) => {
    if (!file || !currentUser) { setUploadError("No file selected or user not authenticated."); return; }
    setIsUploading(true); setUploadProgress(0); setUploadError(null);
    try {
      await resourceService.uploadFile(file, currentUser.id, (progress) => { setUploadProgress(progress); }, undefined, teamContext?.id || undefined, currentFolderId);
      setFileToUpload(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await fetchResources();
    } catch (err) { setUploadError((err as Error).message || "Upload failed."); console.error(err); }
    finally { setIsUploading(false); }
  };

  const handleContextMenu = (event: React.MouseEvent, item: ResourceItem) => { event.preventDefault(); setContextMenu({ isOpen: true, position: { x: event.clientX, y: event.clientY }, item }); };

  const handleShareRequest = async (items: ResourceItem[]) => {
    if (!items.length || !currentUser) return;
    setItemsToShare(items);
    setShareError(null);
    setIsShareModalOpen(true);
    try {
      const userConnections = await connectService.getConnections(currentUser.id);
      setConnections(userConnections);
    } catch (err) {
      setShareError("Could not load your connections.");
      console.error(err);
    }
  };

  const handleConfirmShare = async (recipientIds: string[]) => {
    if (!itemsToShare.length || !recipientIds.length) return;
    setIsSharing(true);
    setShareError(null);
    try {
      await resourceService.shareItems(itemsToShare.map(i => i.id), recipientIds);
      alert(`Successfully shared ${itemsToShare.length} item(s).`);
      setIsShareModalOpen(false);
      setItemsToShare([]);
    } catch (err) {
      const errorMessage = (err as Error).message || "An unknown error occurred during sharing.";
      setShareError(errorMessage);
      console.error(err);
    } finally {
      setIsSharing(false);
    }
  };

  const handleContextAction = async (action: string, item: ResourceItem) => {
    try {
      switch (action) {
        case 'open': if (item.type === ResourceItemType.FOLDER) { handleFolderClick(item); } else if (item.publicUrl) { window.open(item.publicUrl, '_blank'); } break;
        case 'download': if (item.publicUrl && item.type !== ResourceItemType.FOLDER) { const link = document.createElement('a'); link.href = item.publicUrl; link.download = item.name; link.click(); } break;
        case 'rename': setItemToRename(item); setIsRenameModalOpen(true); break;
        case 'copy': setClipboardItem({ item, action: 'copy' }); break;
        case 'cut': setClipboardItem({ item, action: 'cut' }); break;
        case 'paste': if (clipboardItem) { if (clipboardItem.action === 'copy') { await resourceService.duplicateItem(clipboardItem.item.id); } else if (clipboardItem.action === 'cut') { await resourceService.moveItem(clipboardItem.item.id, currentFolderId); } await fetchResources(); setClipboardItem(null); } break;
        case 'star': await resourceService.toggleStar(item.id, !item.starred); await fetchResources(); break;
        case 'share': handleShareRequest([item]); break;
        case 'details': setItemToShowDetails(item); setIsDetailsModalOpen(true); break;
        case 'delete': handleDeleteRequest(item); break;
        default: console.log(`Unhandled action: ${action}`);
      }
    } catch (error) { console.error(`Error performing ${action}:`, error); setPageError((error as Error).message || `Failed to ${action} item`); }
  };

  const handleDeleteRequest = (item: ResourceItem) => { setItemToDelete(item); setShowDeleteConfirm(true); };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    setIsLoading(true);
    try { await resourceService.deleteFile(itemToDelete.id, itemToDelete.filePath); await fetchResources(); }
    catch (err) { setPageError((err as Error).message || "Failed to delete file."); console.error(err); }
    finally { setIsLoading(false); setShowDeleteConfirm(false); setItemToDelete(null); }
  };

  const handleCreateFolder = async (folderName: string) => {
    if (!currentUser) { alert("User not authenticated."); return; }
    try { await resourceService.createFolder(folderName, currentUser.id, currentFolderId, null, teamContext?.id || null); await fetchResources(); setIsCreateFolderModalOpen(false); }
    catch (error) { console.error("Error creating folder:", error); alert(`Failed to create folder: ${(error as Error).message}`); }
  };

  const handleRename = async (newName: string) => { if (!itemToRename) return; try { await resourceService.renameItem(itemToRename.id, newName); await fetchResources(); } catch (error) { console.error('Rename failed:', error); alert('Failed to rename item'); } };

  const handleFolderClick = (folder: ResourceItem) => {
    if (folder.type !== ResourceItemType.FOLDER) return;

    if (folder.teamId && !teamContext) {
      setTeamContext({ id: folder.teamId, name: folder.name });
    }

    setCurrentFolderId(folder.id);
    setFolderHierarchy(prev => [...prev, folder]);
  };

  const handleBreadcrumbClick = (folderId: string | null, index: number) => {
    if (index === 0) {
      setTeamContext(null);
    }

    setCurrentFolderId(folderId);
    setFolderHierarchy(prev => prev.slice(0, index));
  };

  const toggleSelection = (itemId: string) => { const newSelection = new Set(selectedItems); if (newSelection.has(itemId)) { newSelection.delete(itemId); } else { newSelection.add(itemId); } setSelectedItems(newSelection); };
  const selectAll = () => { setSelectedItems(new Set(items.map(item => item.id))); };
  const clearSelection = () => { setSelectedItems(new Set()); setIsSelectionMode(false); };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => { event.preventDefault(); event.stopPropagation(); dragAreaRef.current?.classList.add('border-primary', 'dark:border-primary-light', 'bg-primary-light/10', 'dark:bg-primary-dark/10'); };
  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => { event.preventDefault(); event.stopPropagation(); dragAreaRef.current?.classList.remove('border-primary', 'dark:border-primary-light', 'bg-primary-light/10', 'dark:bg-primary-dark/10'); };
  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => { event.preventDefault(); event.stopPropagation(); dragAreaRef.current?.classList.remove('border-primary', 'dark:border-primary-light', 'bg-primary-light/10', 'dark:bg-primary-dark/10'); if (event.dataTransfer.files && event.dataTransfer.files[0]) { setFileToUpload(event.dataTransfer.files[0]); setUploadError(null); triggerUpload(event.dataTransfer.files[0]); } };

  const breadcrumbs = useMemo(() => {
    const crumbs = [{ id: null, name: "My Files" }];
    folderHierarchy.forEach(folder => {
      crumbs.push({ id: folder.id, name: folder.name });
    });
    return crumbs;
  }, [folderHierarchy]);

  if (isLoading && items.length === 0 && !currentUser) { return <div className="p-6 text-center text-muted dark:text-muted-dark">Loading resources...</div>; }
  if (pageError && items.length === 0 && !currentUser) { return <div className="p-6 text-center text-red-500">{pageError}</div>; }

  return (
    <div className="p-4 sm:p-6 bg-background dark:bg-background-dark min-h-screen text-text dark:text-text-dark">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 space-y-4 lg:space-y-0">
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Resources</h1>
          <nav aria-label="Breadcrumb" className="mt-1">
            <ol className="flex items-center space-x-1 text-xs text-muted dark:text-muted-dark">
              {breadcrumbs.map((crumb, index) => (
                <li key={crumb.id || 'root'} className="flex items-center">
                  {index > 0 && <ChevronRightIcon className="w-3 h-3 mx-1 text-gray-400 dark:text-gray-500" />}
                  <button onClick={() => handleBreadcrumbClick(crumb.id, index)} className={`hover:underline ${index === breadcrumbs.length - 1 ? 'font-medium text-text dark:text-text-dark' : ''}`} aria-current={index === breadcrumbs.length - 1 ? "page" : undefined}>
                    {crumb.name}
                  </button>
                </li>
              ))}
            </ol>
          </nav>
        </div>
        <div className="flex space-x-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => setIsCreateFolderModalOpen(true)} leftIcon={<OriginalFolderIcon className="w-4 h-4" />}>Create Folder</Button>
          <Button size="sm" onClick={() => fileInputRef.current?.click()} leftIcon={<UploadCloudIcon className="w-4 h-4" />}>Upload File</Button>
          <Button size="sm" variant="outline" onClick={fetchResources} leftIcon={<ArrowPathIcon className="w-4 h-4" />}>Refresh</Button>
        </div>
        <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,text/plain,.zip,.rar,.tar,.gz" multiple />
      </div>

      <div className="flex flex-col lg:flex-row gap-4 mb-6 p-4 bg-card dark:bg-card-dark rounded-lg border border-border dark:border-border-dark">
        <div className="flex-1 relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search files and folders..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-primary focus:border-primary" />
          {searchQuery && (<button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"><XMarkIcon className="w-4 h-4" /></button>)}
        </div>
        <div className="flex items-center space-x-2">
          <FilterIcon className="w-4 h-4 text-gray-400" />
          <select value={filterType} onChange={(e) => setFilterType(e.target.value as FilterType)} className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-primary focus:border-primary">
            <option value="all">All Files</option><option value="folders">Folders</option><option value="images">Images</option><option value="documents">Documents</option><option value="videos">Videos</option><option value="archives">Archives</option><option value="other">Other</option>
          </select>
        </div>
        <div className="flex items-center space-x-2">
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)} className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-primary focus:border-primary">
            <option value="name">Name</option><option value="date">Date</option><option value="size">Size</option><option value="type">Type</option>
          </select>
          <button onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')} className="p-2 text-gray-400 hover:text-gray-600 rounded">{sortDirection === 'asc' ? <SortAscendingIcon className="w-4 h-4" /> : <SortDescendingIcon className="w-4 h-4" />}</button>
        </div>
      </div>

      {isSelectionMode && (
        <div className="flex items-center justify-between mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center space-x-3"><span className="text-sm font-medium">{selectedItems.size} selected</span><Button size="sm" variant="outline" onClick={selectAll}>Select All</Button><Button size="sm" variant="outline" onClick={clearSelection}>Clear</Button></div>
          <div className="flex space-x-2">
            <Button
              size="sm"
              variant="outline"
              disabled={selectedItems.size === 0}
              onClick={() => {
                const selected = originalItems.filter(i => selectedItems.has(i.id));
                handleShareRequest(selected);
              }}
              leftIcon={<ShareIcon className="w-4 h-4" />}
            >
              Share
            </Button>
            <Button size="sm" variant="outline" disabled={selectedItems.size === 0}>Download</Button>
            <Button size="sm" variant="outline" disabled={selectedItems.size === 0}>Move</Button>
            <Button size="sm" variant="danger" disabled={selectedItems.size === 0}>Delete</Button>
          </div>
        </div>
      )}

      <div ref={dragAreaRef} className="mb-6 p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-center cursor-pointer hover:border-primary dark:hover:border-primary-light transition-all duration-150 ease-in-out" onClick={() => fileInputRef.current?.click()} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} aria-label="Drag and drop files here or click to browse" role="button" tabIndex={0} onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}>
        <UploadCloudIcon className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-2" />
        <p className="text-sm text-muted dark:text-muted-dark">Drag & drop files here, or click to select. Max 50MB.</p>
        {fileToUpload && !isUploading && (<div className="mt-3 text-sm">Selected: <strong>{fileToUpload.name}</strong> ({formatBytes(fileToUpload.size)})<Button size="sm" onClick={(e) => { e.stopPropagation(); triggerUpload(); }} className="ml-2">Upload Selected</Button></div>)}
        {isUploading && (<div className="mt-3 w-full max-w-md mx-auto"><CustomProgressBar progress={uploadProgress} /><p className="text-xs text-primary dark:text-indigo-300 mt-1">{uploadProgress}% Uploading...</p></div>)}
        {uploadError && <p className="mt-2 text-xs text-red-500">{uploadError}</p>}
      </div>

      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center space-x-4">
          <h2 className="text-xl font-semibold">{currentFolderId ? folderHierarchy[folderHierarchy.length - 1]?.name : (teamContext?.name || "My Files")} ({items.length})</h2>
          {!isSelectionMode && items.length > 0 && (<Button variant="ghost" size="sm" onClick={() => setIsSelectionMode(true)} className="text-sm">Select</Button>)}
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex space-x-1 border border-gray-300 dark:border-gray-600 rounded-md p-1">
            <Button variant="ghost" size="sm" onClick={() => setViewType('grid')} className={`${viewType === 'grid' ? 'text-primary dark:text-primary-light bg-primary-light/10 dark:bg-primary-dark/20' : 'text-muted dark:text-muted-dark'} p-1.5`} aria-label="Grid view" aria-pressed={viewType === 'grid'}><LayoutGridIcon className="w-4 h-4" /></Button>
            <Button variant="ghost" size="sm" onClick={() => setViewType('list')} className={`${viewType === 'list' ? 'text-primary dark:text-primary-light bg-primary-light/10 dark:bg-primary-dark/20' : 'text-muted dark:text-muted-dark'} p-1.5`} aria-label="List view" aria-pressed={viewType === 'list'}><ListIcon className="w-4 h-4" /></Button>
            <Button variant="ghost" size="sm" onClick={() => setViewType('compact')} className={`${viewType === 'compact' ? 'text-primary dark:text-primary-light bg-primary-light/10 dark:bg-primary-dark/20' : 'text-muted dark:text-muted-dark'} p-1.5`} aria-label="Compact view" aria-pressed={viewType === 'compact'}><DocumentDuplicateIcon className="w-4 h-4" /></Button>
          </div>
        </div>
      </div>

      {isLoading && <div className="text-center py-4 text-muted dark:text-muted-dark">Loading files...</div>}
      {pageError && !isLoading && <div className="text-center py-4 text-red-500">{pageError}</div>}
      {!isLoading && !pageError && items.length === 0 && (
        <Card className="text-center p-10 bg-card dark:bg-card-dark">
          <UploadCloudIcon className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
          <h3 className="text-xl font-semibold mb-2">{searchQuery ? 'No files match your search' : 'This folder is empty'}</h3>
          <p className="text-muted dark:text-muted-dark">{searchQuery ? 'Try adjusting your search terms or filters.' : 'Upload your first file or create a folder here.'}</p>
          {searchQuery && (<Button variant="outline" onClick={() => setSearchQuery('')} className="mt-3">Clear Search</Button>)}
        </Card>
      )}

      {!isLoading && !pageError && items.length > 0 && (
        <>
          {viewType === 'grid' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {items.map(item => (
                <Card key={item.id} className={`p-3 text-center group relative overflow-hidden bg-card dark:bg-card-dark border border-border dark:border-border-dark hover:shadow-lg hover:border-primary/50 dark:hover:border-primary-dark/50 transition-all cursor-pointer ${selectedItems.has(item.id) ? 'ring-2 ring-primary' : ''}`} onClick={(e) => { if (isSelectionMode) { e.preventDefault(); toggleSelection(item.id); } else if (item.type === ResourceItemType.FOLDER) { handleFolderClick(item); } else if (item.publicUrl) { window.open(item.publicUrl, '_blank'); } }} onContextMenu={(e) => handleContextMenu(e, item)}>
                  {isSelectionMode && (<div className="absolute top-2 left-2 z-10"><input type="checkbox" checked={selectedItems.has(item.id)} onChange={() => toggleSelection(item.id)} className="w-4 h-4 text-primary bg-white border-gray-300 rounded focus:ring-primary" onClick={(e) => e.stopPropagation()} /></div>)}
                  <div className="aspect-square flex items-center justify-center mb-2 bg-gray-100 dark:bg-surface-dark rounded-md overflow-hidden">{item.type === ResourceItemType.IMAGE && item.publicUrl ? (<img src={item.publicUrl} alt={item.name} className="w-full h-full object-cover" />) : (getIconForItemType(item.type, "w-12 h-12 sm:w-16 sm:h-16"))}</div>
                  
                  {item.sharedBy?.name && (
                    <div className="absolute top-2 right-2 flex items-center space-x-1 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded-full" title={`Shared by ${item.sharedBy.name}`}>
                       <UserGroupIcon className="w-3 h-3" />
                    </div>
                  )}

                  <p className="text-xs sm:text-sm font-medium truncate" title={item.name}>{item.name}</p>
                  
                  {item.sharedBy?.name ? (
                     <p className="text-xs text-muted dark:text-muted-dark truncate">by {item.sharedBy.name}</p>
                  ) : (
                     <p className="text-xs text-muted dark:text-muted-dark">{item.type === ResourceItemType.FOLDER ? 'Folder' : formatBytes(item.sizeBytes)}</p>
                  )}
                  {!isSelectionMode && (<><div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"><Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDeleteRequest(item); }} className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-800/30" aria-label={`Delete ${item.name}`}><Trash2Icon className="w-4 h-4"/></Button></div>{item.type !== ResourceItemType.FOLDER && item.publicUrl && (<a href={item.publicUrl} download={item.name} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity" aria-label={`Download ${item.name}`}><Button variant="ghost" size="sm" className="p-1 text-primary dark:text-indigo-300 hover:bg-primary-light/10 dark:hover:bg-primary-dark/20"><DownloadIcon className="w-4 h-4"/></Button></a>)}</>)}
                </Card>
              ))}
            </div>
          )}
          {viewType === 'list' && (
            <div className="bg-card dark:bg-card-dark rounded-lg shadow overflow-x-auto">
              <table className="w-full min-w-[600px] divide-y divide-gray-200 dark:divide-border-dark">
                <thead className="bg-gray-50 dark:bg-surface-dark">
                  <tr>
                    {isSelectionMode && (<th scope="col" className="px-4 py-3 text-left"><input type="checkbox" checked={selectedItems.size === items.length && items.length > 0} onChange={selectedItems.size === items.length ? clearSelection : selectAll} className="w-4 h-4 text-primary bg-white border-gray-300 rounded focus:ring-primary" /></th>)}
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted dark:text-muted-dark uppercase tracking-wider">Name</th><th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted dark:text-muted-dark uppercase tracking-wider hidden sm:table-cell">Type</th><th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted dark:text-muted-dark uppercase tracking-wider hidden md:table-cell">Size</th><th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted dark:text-muted-dark uppercase tracking-wider">Modified</th><th scope="col" className="px-4 py-3 text-right text-xs font-medium text-muted dark:text-muted-dark uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-border-dark">
                  {items.map(item => (
                    <tr key={item.id} className={`hover:bg-gray-50 dark:hover:bg-surface-dark/50 ${selectedItems.has(item.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''} ${item.type === ResourceItemType.FOLDER || !isSelectionMode ? 'cursor-pointer' : ''}`} onClick={(e) => { if (isSelectionMode) { e.preventDefault(); toggleSelection(item.id); } else if (item.type === ResourceItemType.FOLDER) { handleFolderClick(item); } else if (item.publicUrl) { window.open(item.publicUrl, '_blank'); } }} onContextMenu={(e) => handleContextMenu(e, item)}>
                      {isSelectionMode && (<td className="px-4 py-3"><input type="checkbox" checked={selectedItems.has(item.id)} onChange={() => toggleSelection(item.id)} className="w-4 h-4 text-primary bg-white border-gray-300 rounded focus:ring-primary" onClick={(e) => e.stopPropagation()} /></td>)}
                      <td className="px-4 py-3 whitespace-nowrap"><div className="flex items-center"><div className="mr-3 flex-shrink-0">{getIconForItemType(item.type, "w-6 h-6")}</div><div><span className={`text-sm font-medium truncate max-w-[200px] sm:max-w-xs ${item.type === ResourceItemType.FOLDER ? 'text-text dark:text-text-dark hover:underline' : 'text-text dark:text-text-dark'}`} title={item.name}>{item.name}</span>{item.sharedBy?.name && (<p className="text-xs text-muted dark:text-muted-dark flex items-center mt-0.5"><UserGroupIcon className="w-3 h-3 mr-1" />Shared by {item.sharedBy.name}</p>)}</div></div></td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-muted dark:text-muted-dark hidden sm:table-cell capitalize">{item.type}</td><td className="px-4 py-3 whitespace-nowrap text-sm text-muted dark:text-muted-dark hidden md:table-cell">{item.type === ResourceItemType.FOLDER ? '-' : formatBytes(item.sizeBytes)}</td><td className="px-4 py-3 whitespace-nowrap text-sm text-muted dark:text-muted-dark">{new Date(item.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm space-x-1">
                        {!isSelectionMode && (<>{item.type !== ResourceItemType.FOLDER && item.publicUrl && (<a href={item.publicUrl} download={item.name} target="_blank" rel="noopener noreferrer" aria-label={`Download ${item.name}`} onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="p-1.5"><DownloadIcon className="w-4 h-4 text-primary dark:text-indigo-300"/></Button></a>)}<Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setItemToRename(item); setIsRenameModalOpen(true); }} className="p-1.5" aria-label={`Rename ${item.name}`}><PencilIcon className="w-4 h-4 text-gray-500"/></Button><Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDeleteRequest(item); }} className="p-1.5" aria-label={`Delete ${item.name}`}><Trash2Icon className="w-4 h-4 text-red-500"/></Button></>)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {viewType === 'compact' && (
            <div className="space-y-1">
              {items.map(item => (
                <div key={item.id} className={`flex items-center p-2 rounded hover:bg-gray-50 dark:hover:bg-surface-dark/50 cursor-pointer group ${selectedItems.has(item.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`} onClick={(e) => { if (isSelectionMode) { e.preventDefault(); toggleSelection(item.id); } else if (item.type === ResourceItemType.FOLDER) { handleFolderClick(item); } else if (item.publicUrl) { window.open(item.publicUrl, '_blank'); } }} onContextMenu={(e) => handleContextMenu(e, item)}>
                  {isSelectionMode && (<input type="checkbox" checked={selectedItems.has(item.id)} onChange={() => toggleSelection(item.id)} className="w-4 h-4 text-primary bg-white border-gray-300 rounded focus:ring-primary mr-3" onClick={(e) => e.stopPropagation()} />)}
                  <div className="mr-3 flex-shrink-0">{getIconForItemType(item.type, "w-5 h-5")}</div>
                  <div className="flex-1 min-w-0"><span className="text-sm font-medium truncate block" title={item.name}>{item.name}</span>{item.sharedBy?.name && (<p className="text-xs text-muted dark:text-muted-dark flex items-center"><UserGroupIcon className="w-3 h-3 mr-1" />by {item.sharedBy.name}</p>)}</div>
                  <div className="flex items-center space-x-2 text-xs text-muted dark:text-muted-dark"><span>{item.type === ResourceItemType.FOLDER ? 'Folder' : formatBytes(item.sizeBytes)}</span><span>{new Date(item.createdAt).toLocaleDateString()}</span></div>
                  {!isSelectionMode && (<div className="opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">{item.type !== ResourceItemType.FOLDER && item.publicUrl && (<a href={item.publicUrl} download={item.name} target="_blank" rel="noopener noreferrer" aria-label={`Download ${item.name}`} onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="sm" className="p-1"><DownloadIcon className="w-4 h-4 text-primary dark:text-indigo-300"/></Button></a>)}<Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setItemToRename(item); setIsRenameModalOpen(true); }} className="p-1" aria-label={`Rename ${item.name}`}><PencilIcon className="w-4 h-4 text-gray-500"/></Button><Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDeleteRequest(item); }} className="p-1" aria-label={`Delete ${item.name}`}><Trash2Icon className="w-4 h-4 text-red-500"/></Button></div>)}
                </div>
              ))}
            </div>
          )}
        </>
      )}
      <ContextMenu isOpen={contextMenu.isOpen} position={contextMenu.position} item={contextMenu.item} onClose={() => setContextMenu({ isOpen: false, position: { x: 0, y: 0 }, item: null })} onAction={handleContextAction} clipboardItem={clipboardItem} />
      <Modal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Confirm Delete" size="sm">
        <p className="text-sm mb-6">Are you sure you want to delete "<strong>{itemToDelete?.name}</strong>"?{itemToDelete?.type === ResourceItemType.FOLDER && " This will delete the folder and all its contents."} This action cannot be undone.</p>
        <div className="flex justify-end space-x-2"><Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={isLoading}>Cancel</Button><Button variant="danger" onClick={confirmDelete} loading={isLoading}>Delete</Button></div>
      </Modal>
      <CreateFolderModal isOpen={isCreateFolderModalOpen} onClose={() => setIsCreateFolderModalOpen(false)} onCreate={handleCreateFolder} />
      <RenameModal isOpen={isRenameModalOpen} item={itemToRename} onClose={() => { setIsRenameModalOpen(false); setItemToRename(null); }} onRename={handleRename} />
      <DetailsModal isOpen={isDetailsModalOpen} item={itemToShowDetails} onClose={() => { setIsDetailsModalOpen(false); setItemToShowDetails(null); }} />
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        onShare={handleConfirmShare}
        itemsToShare={itemsToShare}
        connections={connections}
        isSharing={isSharing}
        shareError={shareError}
      />
      {clipboardItem && (
        <div className="fixed bottom-4 left-4 bg-blue-100 dark:bg-blue-900 border border-blue-300 dark:border-blue-700 rounded-lg p-3 shadow-lg z-40">
          <div className="flex items-center space-x-2 text-sm">
            {clipboardItem.action === 'cut' ? <ScissorsIcon className="w-4 h-4" /> : <CopyIcon className="w-4 h-4" />}
            <span>{clipboardItem.action === 'cut' ? 'Cut' : 'Copied'}: <strong>{clipboardItem.item.name}</strong></span>
            <button onClick={() => setClipboardItem(null)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"><XMarkIcon className="w-4 h-4" /></button>
          </div>
        </div>
      )}
    </div>
  );
};
