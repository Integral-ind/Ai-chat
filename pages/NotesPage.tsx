import React, { useState, useMemo, useEffect, useCallback, FormEvent, useRef, useContext } from 'react';
import { Button, Modal, Checkbox } from '../components';
import {
    Note, NoteCategory, NoteModalFormData, User as FrontendUser,
    NoteSortOption
} from '../types';
import { noteService } from '../noteService';
import {
    PlusIcon, BookOpenIcon,
    ClipboardDocumentListIcon, FileTextIcon, StarIcon as GlobalStarIcon,
    NOTE_CATEGORY_TABS, NOTE_SORT_OPTIONS, TAG_COLORS,
    Trash2Icon, ArrowLeftIcon, PencilIcon
} from '../constants';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { sanitizeHtml } from '../utils/sanitizer';

// Declare Quill for TypeScript since it's loaded via a script tag
declare var Quill: any;

// A comprehensive toolbar configuration for Quill
const quillToolbarOptions = [
  [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
  [{ 'font': [] }],
  [{ 'size': ['small', false, 'large', 'huge'] }],
  ['bold', 'italic', 'underline', 'strike'],
  ['blockquote', 'code-block'],
  [{ 'list': 'ordered'}, { 'list': 'bullet' }],
  [{ 'script': 'sub'}, { 'script': 'super' }],
  [{ 'indent': '-1'}, { 'indent': '+1' }],
  [{ 'direction': 'rtl' }],
  [{ 'color': [] }, { 'background': [] }],
  [{ 'align': [] }],
  ['link', 'image', 'video'],
  ['clean']
];

interface QuillEditorWrapperProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const QuillEditorWrapper: React.FC<QuillEditorWrapperProps> = ({ value, onChange, placeholder }) => {
    const quillRef = useRef<any>(null); // Quill instance
    const containerRef = useRef<HTMLDivElement>(null); // The wrapper div that gets cleaned up

    useEffect(() => {
        // This effect runs when the component mounts.
        // It's responsible for creating the editor and cleaning it up.
        let quill: any = null;

        // Add a check to prevent re-initialization if the editor already exists
        if (containerRef.current && !containerRef.current.querySelector('.ql-editor')) {
            // Create a div for the editor to live in.
            // Quill will add its toolbar as a sibling to this div, inside containerRef.
            const editorDiv = document.createElement('div');
            containerRef.current.appendChild(editorDiv);

            quill = new Quill(editorDiv, {
                modules: {
                    toolbar: quillToolbarOptions,
                    history: { delay: 2000, maxStack: 500, userOnly: true },
                },
                placeholder: placeholder || 'Start writing...',
                theme: 'snow',
            });
            quillRef.current = quill;

            // Set initial content from the `value` prop.
            if (value) {
                quill.clipboard.dangerouslyPasteHTML(0, sanitizeHtml(value));
            }

            // Set up the listener for user-driven changes.
            quill.on('text-change', (delta: any, oldDelta: any, source: string) => {
                if (source === 'user') {
                    onChange(sanitizeHtml(quill.root.innerHTML));
                }
            });
        }

        return () => {
            // Cleanup on unmount.
            quillRef.current = null;
            if (containerRef.current) {
                containerRef.current.innerHTML = ''; // Remove all Quill-generated DOM elements.
            }
        };
    }, []); // Empty dependency array ensures this runs exactly once on mount.

    // This effect runs whenever the `value` prop changes (e.g., loading a new note).
    useEffect(() => {
        const quill = quillRef.current;
        // Ensure editor is initialized and the new value is different from the current content.
        // This prevents an infinite loop and avoids resetting the editor if the parent re-renders.
        if (quill && value !== sanitizeHtml(quill.root.innerHTML)) {
            // Use setContents to replace the editor's content, preventing duplication.
            const delta = quill.clipboard.convert(value);
            quill.setContents(delta, 'silent');
        }
    }, [value]);

    return (
        <div ref={containerRef} className="h-full w-full flex flex-col">
            {/* Quill will inject its toolbar and editor here. The flex layout will be applied. */}
        </div>
    );
};


// Helper function to get a text snippet from HTML
const getSnippet = (htmlContent: string, maxLength: number = 80) => {
  const div = document.createElement('div');
  div.innerHTML = sanitizeHtml(htmlContent);
  const text = div.textContent || div.innerText || "";
  return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
};

// Note Card component for the list view
const NoteCard: React.FC<{note: Note; onClick: () => void;}> = ({ note, onClick }) => {
  const Icon = NOTE_CATEGORY_TABS.find(tab => tab.id === note.category)?.icon || FileTextIcon;
  const snippet = getSnippet(note.content);

  const categoryColors = useMemo(() => {
    switch (note.category) {
      case NoteCategory.GENERAL:
        return 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-900/60';
      case NoteCategory.READING_LIST:
        return 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-100 dark:hover:bg-indigo-950/70';
      case NoteCategory.MEETING_NOTE:
        return 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800/60 hover:bg-blue-100 dark:hover:bg-blue-950/70';
      default:
        return 'bg-gray-50 dark:bg-gray-900/40 border-gray-200 dark:border-gray-700/60 hover:bg-gray-100 dark:hover:bg-gray-900/60';
    }
  }, [note.category]);

  const iconColors = useMemo(() => {
    switch (note.category) {
      case NoteCategory.GENERAL:
        return 'text-slate-600 dark:text-slate-400';
      case NoteCategory.READING_LIST:
        return 'text-indigo-600 dark:text-indigo-400';
      case NoteCategory.MEETING_NOTE:
        return 'text-blue-600 dark:text-blue-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  }, [note.category]);

  return (
    <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className={`${categoryColors} p-3 rounded-lg shadow-sm hover:shadow-md cursor-pointer flex flex-col transition-all duration-200 hover:scale-[1.02] border`}
        onClick={onClick}
        style={{ minHeight: '140px', maxHeight: '180px' }}
    >
        <div className="flex justify-between items-start mb-2">
            <div className="flex items-center space-x-2 min-w-0 flex-1">
                <Icon className={`w-4 h-4 ${iconColors} flex-shrink-0`} />
                <h3 className="text-sm font-semibold text-text dark:text-text-dark truncate">{note.title || "Untitled Note"}</h3>
            </div>
            {note.isFavorite && <GlobalStarIcon className="w-4 h-4 text-amber-500 dark:text-amber-400 flex-shrink-0" filled />}
        </div>

        {note.category === NoteCategory.READING_LIST && note.url && (
            <a href={note.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline truncate block mb-2">{note.url}</a>
        )}

        <p className="text-xs text-muted dark:text-muted-dark mb-2 line-clamp-2 flex-grow overflow-hidden" dangerouslySetInnerHTML={{ __html: sanitizeHtml(snippet || "No content...") }} />

        {note.category === NoteCategory.MEETING_NOTE && note.attendees && note.attendees.length > 0 && (
            <p className="text-xs text-muted dark:text-muted-dark mb-2 truncate">Attendees: {note.attendees.join(', ')}</p>
        )}

        <div className="mt-auto">
            {note.tags && note.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                    {note.tags.slice(0, 2).map((tag, index) => {
                        // Updated tag colors to match the blue theme
                        const tagColorClasses = [
                            'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
                            'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
                            'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
                            'bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300',
                            'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
                            'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                        ];
                        return (
                            <span key={index} className={`px-1.5 py-0.5 text-xs rounded-md ${tagColorClasses[index % tagColorClasses.length]}`}>
                                {tag}
                            </span>
                        );
                    })}
                    {note.tags.length > 2 && (
                        <span className="text-xs text-muted dark:text-muted-dark">+{note.tags.length - 2}</span>
                    )}
                </div>
            )}
            <p className="text-xs text-muted dark:text-muted-dark">{new Date(note.date).toLocaleDateString()}</p>
        </div>
    </motion.div>
  );
};

const NoteInfoModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  note: Note | null;
  onEdit: (note: Note) => void;
  onDelete: (noteId: string) => void;
}> = ({ isOpen, onClose, note, onEdit, onDelete }) => {
  if (!note) return null;

  const Icon = NOTE_CATEGORY_TABS.find(tab => tab.id === note.category)?.icon || FileTextIcon;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Note Details" size="lg" showSaveButton={false}>
      <div className="space-y-4">
        <div className="flex items-start justify-between pb-3 border-b border-border dark:border-border-dark">
          <div className="flex items-center space-x-3 min-w-0">
            <Icon className="w-6 h-6 text-primary dark:text-indigo-400 flex-shrink-0 mt-1" />
            <h3 className="text-xl font-semibold text-text dark:text-text-dark break-words">{note.title}</h3>
          </div>
          {note.isFavorite && <GlobalStarIcon className="w-5 h-5 text-yellow-400 flex-shrink-0" filled />}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-medium text-muted dark:text-muted-dark">Category</p>
            <p className="text-text dark:text-text-dark">{note.category}</p>
          </div>
          <div>
            <p className="font-medium text-muted dark:text-muted-dark">Last Updated</p>
            <p className="text-text dark:text-text-dark">{new Date(note.date).toLocaleString()}</p>
          </div>
        </div>

        {note.tags && note.tags.length > 0 && (
          <div>
            <p className="font-medium text-muted dark:text-muted-dark text-sm">Tags</p>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {note.tags.map((tag, index) => (
                <span key={index} className={`px-2 py-0.5 text-xs rounded-full ${TAG_COLORS[index % TAG_COLORS.length]}`}>{tag}</span>
              ))}
            </div>
          </div>
        )}

        {note.category === NoteCategory.READING_LIST && (
          <>
            {note.url && <div><p className="font-medium text-muted dark:text-muted-dark text-sm">URL</p><a href={note.url} target="_blank" rel="noopener noreferrer" className="text-primary dark:text-indigo-400 hover:underline break-all">{note.url}</a></div>}
            {note.author && <div><p className="font-medium text-muted dark:text-muted-dark text-sm">Author</p><p className="text-text dark:text-text-dark">{note.author}</p></div>}
          </>
        )}

        {note.category === NoteCategory.MEETING_NOTE && (
          <>
            {note.attendees && note.attendees.length > 0 && <div><p className="font-medium text-muted dark:text-muted-dark text-sm">Attendees</p><p className="text-text dark:text-text-dark">{note.attendees.join(', ')}</p></div>}
            {note.actionItems && note.actionItems.length > 0 && <div><p className="font-medium text-muted dark:text-muted-dark text-sm">Action Items</p><ul className="list-disc list-inside space-y-1 mt-1 text-text dark:text-text-dark">{note.actionItems.map((item, i) => <li key={i}>{item}</li>)}</ul></div>}
          </>
        )}

        <div>
          <p className="font-medium text-muted dark:text-muted-dark text-sm">Content</p>
          <div className="prose prose-sm dark:prose-invert max-w-none mt-1 p-3 bg-gray-50 dark:bg-surface-dark rounded-md border border-border dark:border-border-dark max-h-64 overflow-y-auto" dangerouslySetInnerHTML={{ __html: sanitizeHtml(note.content) }} />
        </div>

      </div>
      <div className="mt-6 flex justify-end space-x-3">
        <Button variant="dangerOutline" onClick={() => onDelete(note.id)}>Delete</Button>
        <Button onClick={() => onEdit(note)} leftIcon={<PencilIcon className="w-4 h-4" />}>Edit</Button>
      </div>
    </Modal>
  );
};

const NewNoteCard: React.FC<{ onClick: () => void; categoryLabel: string }> = ({ onClick, categoryLabel }) => (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="p-3 rounded-lg shadow-sm hover:shadow-md cursor-pointer flex flex-col items-center justify-center bg-gray-50/50 dark:bg-surface-dark border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-primary/60 dark:hover:border-primary-dark/60 transition-all duration-200 hover:scale-[1.02]"
      onClick={onClick}
      style={{ minHeight: '140px', maxHeight: '180px' }}
      role="button"
      aria-label={`Create a new ${categoryLabel}`}
    >
      {/* Minimal Plus Icon */}
      <div className="w-8 h-8 flex items-center justify-center mb-2">
        <svg
          className="w-6 h-6 text-gray-400 dark:text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 6v12m6-6H6"
          />
        </svg>
      </div>
      <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 text-center">New {categoryLabel}</h3>
    </motion.div>
  );

interface NotesPageProps {
  currentUser: FrontendUser | null;
}

export const NotesPage: React.FC<NotesPageProps> = ({ currentUser }) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoadingNotes, setIsLoadingNotes] = useState(true);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [isProcessingNote, setIsProcessingNote] = useState(false);

  const [sortOption, setSortOption] = useState<NoteSortOption>(NoteSortOption.NEWEST);

  const [view, setView] = useState<'list' | 'editor'>('list');
  const [noteInEditor, setNoteInEditor] = useState<Note | null>(null);

  // States for the editor view
  const [editorTitle, setEditorTitle] = useState('');
  const [editorContent, setEditorContent] = useState('');
  const [editorTags, setEditorTags] = useState('');
  const [editorKey, setEditorKey] = useState(Date.now().toString());

  const location = useLocation();
  const navigate = useNavigate();

  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [editingNoteModalData, setEditingNoteModalData] = useState<NoteModalFormData | null>(null);
  const [isDeleteConfirmModalOpen, setIsDeleteConfirmModalOpen] = useState(false);
  const [noteToDeleteId, setNoteToDeleteId] = useState<string | null>(null);

  const [noteForInfoModal, setNoteForInfoModal] = useState<Note | null>(null);
  const [isNoteInfoModalOpen, setIsNoteInfoModalOpen] = useState(false);

  const fetchNotes = useCallback(async () => {
    if (!currentUser) {
      setIsLoadingNotes(false);
      setNotes([]);
      return;
    }
    setIsLoadingNotes(true);
    setNotesError(null);
    try {
      const fetchedNotes = await noteService.getAllNotesForUser();
      setNotes(fetchedNotes);
    } catch (error: any) {
      console.error("Error fetching notes:", error);
      setNotesError(error.message || "Failed to load notes.");
    } finally {
      setIsLoadingNotes(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  useEffect(() => {
    // Check if we're coming from dashboard with a new note to edit
    if (location.state?.openEditor && location.state?.newNote) {
        const newNote = location.state.newNote;
        
        // Add the new note to the notes array if it's not already there
        setNotes(prevNotes => {
            const noteExists = prevNotes.some(n => n.id === newNote.id);
            if (!noteExists) {
                return [newNote, ...prevNotes];
            }
            return prevNotes;
        });
        
        // Set the note in editor and switch to editor view immediately
        setNoteInEditor(newNote);
        setView('editor');
        
        // Clear the navigation state to prevent this from running again
        navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  // Effect to populate editor when a note is selected for editing
  useEffect(() => {
    if (view === 'editor' && noteInEditor) {
      setEditorTitle(noteInEditor.title);
      setEditorContent(noteInEditor.content);
      setEditorTags(noteInEditor.tags?.join(', ') || '');
      setEditorKey(noteInEditor.id);
    }
  }, [view, noteInEditor]);

  const filteredAndSortedNotes = useMemo(() => {
    let tempNotes = [...notes];

    return tempNotes.sort((a, b) => {
      switch (sortOption) {
        case NoteSortOption.OLDEST: return new Date(a.date).getTime() - new Date(b.date).getTime();
        case NoteSortOption.TITLE_ASC: return a.title.localeCompare(b.title);
        case NoteSortOption.TITLE_DESC: return b.title.localeCompare(a.title);
        case NoteSortOption.NEWEST:
        default: return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
    });
  }, [notes, sortOption]);

  const groupedNotes = useMemo(() => {
    return filteredAndSortedNotes.reduce((acc, note) => {
        (acc[note.category] = acc[note.category] || []).push(note);
        return acc;
    }, {} as Record<NoteCategory, Note[]>);
  }, [filteredAndSortedNotes]);


  const saveCurrentNote = useCallback(async () => {
    if (!noteInEditor || isProcessingNote) return;

    const hasChanged = noteInEditor.title !== editorTitle ||
                       noteInEditor.content !== editorContent ||
                       (noteInEditor.tags?.join(', ') || '') !== editorTags;

    if (!hasChanged) return;

    setIsProcessingNote(true);
    try {
      const updatedNotePayload: Partial<Note> = {
        title: editorTitle.trim() === '' ? 'Untitled Note' : editorTitle,
        content: editorContent,
        tags: editorTags.split(',').map(t => t.trim()).filter(Boolean),
      };
      const savedNote = await noteService.updateNote(noteInEditor.id, updatedNotePayload);
      setNotes(prev => prev.map(n => n.id === savedNote.id ? savedNote : n));
      setNoteInEditor(savedNote); // Keep editor state consistent with saved data
    } catch (error: any) {
      console.error("Error auto-saving note:", error);
      alert(`Failed to save note: ${error.message}`);
    } finally {
      setIsProcessingNote(false);
    }
  }, [noteInEditor, editorTitle, editorContent, editorTags, isProcessingNote]);

  // Auto-save logic
  useEffect(() => {
    if (view === 'editor' && noteInEditor) {
      const timer = setTimeout(saveCurrentNote, 1500); // Auto-save after 1.5 seconds of inactivity
      return () => clearTimeout(timer);
    }
  }, [editorTitle, editorContent, editorTags, view, noteInEditor, saveCurrentNote]);

  const handleCloseEditor = async () => {
    await saveCurrentNote();
    setView('list');
    setNoteInEditor(null);
  };

  const handleNoteCardClick = (note: Note) => {
    if (note.category === NoteCategory.GENERAL) {
      setNoteInEditor(note);
      setView('editor');
    } else {
      setNoteForInfoModal(note);
      setIsNoteInfoModalOpen(true);
    }
  };

  const handleNewNote = async (category: NoteCategory) => {
    if (!currentUser) {
        alert("Please log in to create notes.");
        return;
    }

    if (category === NoteCategory.GENERAL) {
        setIsProcessingNote(true);
        try {
            const newNote = await noteService.createNote({
                title: "New Note",
                content: "<p><br></p>",
                category: NoteCategory.GENERAL,
                userId: currentUser.id,
            });
            setNotes(prev => [newNote, ...prev]);
            setNoteInEditor(newNote);
            setView('editor');
        } catch (error: any) {
            alert(`Failed to create note: ${error.message}`);
        } finally {
            setIsProcessingNote(false);
        }
    } else {
        openNewNoteModalForCategory(category);
    }
  };

  const handleDeleteNoteRequest = (noteId: string) => {
    setNoteToDeleteId(noteId);
    setIsDeleteConfirmModalOpen(true);
  };

  const confirmDeleteNote = async () => {
    if (!noteToDeleteId) return;
    setIsProcessingNote(true);
    try {
        await noteService.deleteNote(noteToDeleteId);
        setNotes(prev => prev.filter(n => n.id !== noteToDeleteId));
        if (noteInEditor?.id === noteToDeleteId) {
            setView('list');
            setNoteInEditor(null);
        }
        if (editingNoteModalData?.id === noteToDeleteId) {
            setIsNoteModalOpen(false);
            setEditingNoteModalData(null);
        }
        if (noteForInfoModal?.id === noteToDeleteId) {
            setIsNoteInfoModalOpen(false);
            setNoteForInfoModal(null);
        }
    } catch (error: any) {
        alert(`Failed to delete note: ${error.message}`);
    } finally {
        setIsProcessingNote(false);
        setIsDeleteConfirmModalOpen(false);
        setNoteToDeleteId(null);
    }
  };

  const handleToggleFavorite = async (noteId: string, isCurrentlyFavorite: boolean) => {
    setIsProcessingNote(true);
    try {
        const updatedNote = await noteService.updateNote(noteId, { isFavorite: !isCurrentlyFavorite });
        setNotes(prev => prev.map(n => n.id === noteId ? updatedNote : n));
        if (noteInEditor?.id === noteId) {
            setNoteInEditor(updatedNote);
        }
    } catch (error: any) {
        alert(`Failed to update favorite status: ${error.message}`);
    } finally {
        setIsProcessingNote(false);
    }
  };

  // --- Modal logic for non-general notes ---
  const openNewNoteModalForCategory = (category: NoteCategory.READING_LIST | NoteCategory.MEETING_NOTE) => {
    setEditingNoteModalData({
      id: undefined, title: '', content: '', category: category, tags: '', isFavorite: false,
      ...(category === NoteCategory.READING_LIST && { url: '', author: '' }),
      ...(category === NoteCategory.MEETING_NOTE && { attendees: '', actionItems: '' }),
    });
    setIsNoteModalOpen(true);
  };

  const openEditNoteModal = (note: Note) => {
    setEditingNoteModalData({
      id: note.id, title: note.title, content: note.content, category: note.category, tags: note.tags?.join(', ') || '',
      isFavorite: note.isFavorite || false, url: note.url || '', author: note.author || '',
      attendees: note.attendees?.join(', ') || '', actionItems: note.actionItems?.join('\n') || '',
    });
    setIsNoteModalOpen(true);
  };

  const handleModalFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setEditingNoteModalData(prev => prev ? ({ ...prev, [name]: type === 'checkbox' ? checked : value }) : null);
  };

  const performSaveModalNote = async () => {
    if (!editingNoteModalData || !currentUser) return;
    setIsProcessingNote(true);
    const payload: Partial<Note> = {
      title: editingNoteModalData.title || `Untitled ${editingNoteModalData.category}`,
      content: editingNoteModalData.content, category: editingNoteModalData.category,
      tags: editingNoteModalData.tags?.split(',').map(t => t.trim()).filter(Boolean) || [],
      isFavorite: editingNoteModalData.isFavorite, userId: currentUser.id,
      ...(editingNoteModalData.category === NoteCategory.READING_LIST && { url: editingNoteModalData.url, author: editingNoteModalData.author }),
      ...(editingNoteModalData.category === NoteCategory.MEETING_NOTE && { attendees: editingNoteModalData.attendees?.split(',').map(s => s.trim()).filter(Boolean), actionItems: editingNoteModalData.actionItems?.split('\n').filter(Boolean) }),
    };
    try {
        const savedNote = editingNoteModalData.id ? await noteService.updateNote(editingNoteModalData.id, payload) : await noteService.createNote(payload);
        setNotes(prev => editingNoteModalData.id ? prev.map(n => n.id === editingNoteModalData.id ? savedNote : n) : [savedNote, ...prev]);
        setIsNoteModalOpen(false);
        setEditingNoteModalData(null);
    } catch (error: any) {
        alert(`Failed to save note: ${error.message}`);
    } finally {
        setIsProcessingNote(false);
    }
  };


  // --- RENDER LOGIC ---
  // The component now returns a single fragment. Inside, it conditionally renders
  // the editor or the list view. The modals are placed at the end, outside the
  // conditional, so they are always available in the component tree.
  return (
    <>
      {view === 'editor' && noteInEditor ? (
        // --- Editor View ---
        <div className="flex flex-col h-full bg-card dark:bg-card-dark text-text dark:text-text-dark">
          <header className="flex-shrink-0 flex items-center justify-between p-4 border-b border-border dark:border-border-dark bg-white dark:bg-gray-900">
            <Button variant="ghost" onClick={handleCloseEditor} leftIcon={<ArrowLeftIcon className="w-4 h-4"/>}>
              All Notes
            </Button>
            <div className="flex items-center space-x-2">
                <Button variant="ghost" size="sm" onClick={() => handleToggleFavorite(noteInEditor.id, !!noteInEditor.isFavorite)} aria-label={noteInEditor.isFavorite ? "Unmark favorite" : "Mark favorite"} disabled={isProcessingNote}>
                    <GlobalStarIcon className={`w-5 h-5 ${noteInEditor.isFavorite ? 'text-yellow-400 dark:text-yellow-300' : 'text-muted dark:text-muted-dark hover:text-yellow-500'}`} filled={!!noteInEditor.isFavorite} />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDeleteNoteRequest(noteInEditor.id)} aria-label="Delete note" disabled={isProcessingNote}>
                    <Trash2Icon className="w-5 h-5 text-muted dark:text-muted-dark hover:text-red-500" />
                </Button>
            </div>
          </header>

          <div className="flex-grow flex flex-col overflow-hidden">
              <div className="p-4 flex-shrink-0 bg-white dark:bg-gray-900">
                   <input
                      type="text"
                      value={editorTitle}
                      onChange={(e) => setEditorTitle(e.target.value)}
                      placeholder="Untitled Note"
                      className="text-2xl font-semibold w-full bg-transparent focus:outline-none text-text dark:text-text-dark placeholder-muted dark:placeholder-muted-dark"
                      disabled={isProcessingNote}
                    />
              </div>
              <div className="flex-1 flex flex-col overflow-hidden">
                  <QuillEditorWrapper
                      key={editorKey}
                      value={editorContent}
                      onChange={setEditorContent}
                      placeholder="Start writing..."
                  />
              </div>
              <div className="p-4 border-t border-border dark:border-border-dark flex-shrink-0 bg-white dark:bg-gray-900">
                  <input
                      type="text"
                      value={editorTags}
                      onChange={(e) => setEditorTags(e.target.value)}
                      placeholder="Add tags, comma-separated"
                      className="input-style text-sm !py-2 w-full"
                      disabled={isProcessingNote}
                  />
              </div>
          </div>
        </div>
      ) : (
        // --- List View ---
        <div className="h-full flex flex-col bg-background dark:bg-background-dark text-text dark:text-text-dark overflow-hidden">
          <div className="p-4 sm:p-6 flex-grow flex flex-col overflow-hidden">
            <header className="flex-shrink-0 flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                <div>
                  <h1 className="text-3xl font-bold">Notes</h1>
                  <p className="text-muted dark:text-muted-dark mt-1">Your personal knowledge base</p>
                </div>
                <div className="flex justify-end gap-2 sm:gap-4 flex-shrink-0 flex-nowrap">
                    <select
                      value={sortOption}
                      onChange={(e) => setSortOption(e.target.value as NoteSortOption)}
                      className="input-style text-sm !py-2 !px-3 w-auto"
                      aria-label="Sort notes by"
                    >
                      {NOTE_SORT_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                </div>
            </header>

            <div className="flex-grow overflow-y-auto space-y-8 pr-2 -mr-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
              {isLoadingNotes ? (
                <div className="flex items-center justify-center py-20">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <p className="ml-3 text-muted dark:text-muted-dark">Loading notes...</p>
                </div>
              ) : notesError ? (
                <div className="text-center py-20">
                  <div className="text-red-500 text-lg mb-2">⚠️ Error Loading Notes</div>
                  <p className="text-red-400">{notesError}</p>
                </div>
              ) : (
                NOTE_CATEGORY_TABS.map(categoryTab => {
                  const notesForCategory = groupedNotes[categoryTab.id] || [];
                  return (
                    <section key={categoryTab.id}>
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold flex items-center space-x-2 text-text dark:text-text-dark">
                          <categoryTab.icon className="w-5 h-5 text-primary dark:text-indigo-400"/>
                          <span>{categoryTab.label}</span>
                          <span className="text-sm font-normal text-muted dark:text-muted-dark bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                            {notesForCategory.length}
                          </span>
                        </h2>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
                          {notesForCategory.map(note => (
                            <NoteCard key={note.id} note={note} onClick={() => handleNoteCardClick(note)} />
                          ))}
                          <NewNoteCard
                            categoryLabel={categoryTab.label.replace(/s$/, '')}
                            onClick={() => handleNewNote(categoryTab.id)}
                          />
                      </div>
                    </section>
                  );
                })
              )}
              {!isLoadingNotes && !notesError && filteredAndSortedNotes.length === 0 && (
                  <div className="text-center py-20">
                    <div className="text-6xl mb-4">📝</div>
                    <h3 className="text-xl font-semibold text-text dark:text-text-dark mb-2">No notes yet</h3>
                    <p className="text-muted dark:text-muted-dark">Start by creating your first note!</p>
                  </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- Modals --- */}
      {/* Placed here, they are always available regardless of the view */}
      <Modal isOpen={isNoteModalOpen} onClose={() => { setIsNoteModalOpen(false); setEditingNoteModalData(null); }} title={editingNoteModalData?.id ? "Edit Note" : "Create New Note"} size="lg">
        {editingNoteModalData && (
          <form onSubmit={(e) => { e.preventDefault(); performSaveModalNote(); }} className="space-y-4">
            <div>
              <label htmlFor="noteTitle" className="block text-sm font-medium text-muted dark:text-muted-dark mb-1">Title</label>
              <input type="text" name="title" id="noteTitle" value={editingNoteModalData.title} onChange={handleModalFormChange} className="input-style" required />
            </div>
            {editingNoteModalData.category === NoteCategory.READING_LIST && (
              <>
                <div>
                  <label htmlFor="noteUrl" className="block text-sm font-medium text-muted dark:text-muted-dark mb-1">URL</label>
                  <input type="url" name="url" id="noteUrl" value={editingNoteModalData.url} onChange={handleModalFormChange} className="input-style" placeholder="https://example.com" />
                </div>
                <div>
                  <label htmlFor="noteAuthor" className="block text-sm font-medium text-muted dark:text-muted-dark mb-1">Author</label>
                  <input type="text" name="author" id="noteAuthor" value={editingNoteModalData.author} onChange={handleModalFormChange} className="input-style" />
                </div>
              </>
            )}
            {editingNoteModalData.category === NoteCategory.MEETING_NOTE && (
              <>
                <div>
                  <label htmlFor="noteAttendees" className="block text-sm font-medium text-muted dark:text-muted-dark mb-1">Attendees (comma-separated)</label>
                  <input type="text" name="attendees" id="noteAttendees" value={editingNoteModalData.attendees} onChange={handleModalFormChange} className="input-style" />
                </div>
                <div>
                  <label htmlFor="noteActionItems" className="block text-sm font-medium text-muted dark:text-muted-dark mb-1">Action Items (one per line)</label>
                  <textarea name="actionItems" id="noteActionItems" value={editingNoteModalData.actionItems} onChange={handleModalFormChange} rows={3} className="input-style"></textarea>
                </div>
              </>
            )}
            <div>
              <label htmlFor="noteContent" className="block text-sm font-medium text-muted dark:text-muted-dark mb-1">Content/Summary</label>
              <textarea name="content" id="noteContent" value={editingNoteModalData.content} onChange={handleModalFormChange} rows={4} className="input-style"></textarea>
            </div>
            <div>
              <label htmlFor="noteTags" className="block text-sm font-medium text-muted dark:text-muted-dark mb-1">Tags (comma-separated)</label>
              <input type="text" name="tags" id="noteTags" value={editingNoteModalData.tags} onChange={handleModalFormChange} className="input-style" placeholder="e.g., project-x, important"/>
            </div>
            <div className="flex items-center">
              <Checkbox id="noteIsFavorite" name="isFavorite" checked={!!editingNoteModalData.isFavorite} onChange={(checked) => setEditingNoteModalData(prev => prev ? ({...prev, isFavorite: checked}) : null)} />
              <label htmlFor="noteIsFavorite" className="ml-2 text-sm font-medium text-muted dark:text-muted-dark">Mark as Favorite</label>
            </div>
            <div className="flex justify-between items-center pt-4 border-t border-border dark:border-border-dark">
                <div>
                  {editingNoteModalData.id && (
                    <Button type="button" variant="danger" onClick={() => handleDeleteNoteRequest(editingNoteModalData!.id!)} loading={isProcessingNote}>
                      Delete Note
                    </Button>
                  )}
                </div>
                <div className="flex space-x-3">
                  <Button type="button" variant="outline" onClick={() => { setIsNoteModalOpen(false); setEditingNoteModalData(null); }} disabled={isProcessingNote}>
                    Cancel
                  </Button>
                  <Button type="submit" loading={isProcessingNote}>
                    {editingNoteModalData.id ? "Save Changes" : "Create Note"}
                  </Button>
                </div>
            </div>
          </form>
        )}
      </Modal>

      <Modal isOpen={isDeleteConfirmModalOpen} onClose={() => setIsDeleteConfirmModalOpen(false)} title="Confirm Delete Note" size="sm">
        <div className="text-center">
          <div className="text-4xl mb-4">🗑️</div>
          <p className="text-text dark:text-text-dark mb-6">Are you sure you want to delete this note? This action cannot be undone.</p>
          <div className="flex justify-center space-x-3">
            <Button variant="outline" onClick={() => setIsDeleteConfirmModalOpen(false)} disabled={isProcessingNote}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDeleteNote} loading={isProcessingNote}>
              Delete Note
            </Button>
          </div>
        </div>
      </Modal>

      {isNoteInfoModalOpen && (
        <NoteInfoModal
          isOpen={isNoteInfoModalOpen}
          onClose={() => {
            setIsNoteInfoModalOpen(false);
            setNoteForInfoModal(null);
          }}
          note={noteForInfoModal}
          onEdit={(noteToEdit) => {
            setIsNoteInfoModalOpen(false);
            setNoteForInfoModal(null);
            // Small delay to allow modal to close before opening the next
            setTimeout(() => openEditNoteModal(noteToEdit), 50);
          }}
          onDelete={(noteIdToDelete) => {
            setIsNoteInfoModalOpen(false);
            setNoteForInfoModal(null);
            handleDeleteNoteRequest(noteIdToDelete);
          }}
        />
      )}
    </>
  );
};