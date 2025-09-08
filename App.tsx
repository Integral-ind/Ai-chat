import React, { useState, useEffect, ReactNode, useMemo, useCallback, useRef } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    NAVIGATION_ITEMS, APP_NAME, NOTIFICATION_COUNT, QUICK_STATS_LABELS, 
    SearchIcon, BellIcon, ChevronDoubleLeftIcon, ChevronDoubleRightIcon, UserCircleIcon, UsersIcon, CogIcon,
    ChevronDownIcon, ChevronRightIcon, XMarkIcon as GlobalXMarkIcon
} from './constants';
import { LazyLoader, withLazyLoading } from './components/LazyLoader';

// Lazy load pages for better performance
const DashboardPage = withLazyLoading(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const TasksPage = withLazyLoading(() => import('./pages/TasksPage').then(m => ({ default: m.TasksPage })));
const CalendarPage = withLazyLoading(() => import('./pages/CalendarPage').then(m => ({ default: m.CalendarPage })));
const NotesPage = withLazyLoading(() => import('./pages/NotesPage').then(m => ({ default: m.NotesPage })));
const AnalyticsPage = withLazyLoading(() => import('./pages/AnalyticsPage').then(m => ({ default: m.AnalyticsPage })));
const SettingsPage = withLazyLoading(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const ResourcesPage = withLazyLoading(() => import('./pages/ResourcesPage').then(m => ({ default: m.ResourcesPage })));
const ConnectPage = withLazyLoading(() => import('./pages/ConnectPage').then(m => ({ default: m.ConnectPage })));
const CollaborationPage = withLazyLoading(() => import('./pages/CollaborationPage').then(m => ({ default: m.CollaborationPage })));
const JoinTeamPage = withLazyLoading(() => import('./pages/JoinTeamPage'));
const LandingPage = withLazyLoading(() => import('./pages/LandingPage'));
const SignInPage = withLazyLoading(() => import('./auth/SignInPage'));
const SignUpPage = withLazyLoading(() => import('./auth/SignUpPage'));
const ForgotPasswordPage = withLazyLoading(() => import('./auth/ForgotPasswordPage'));
const ResetPasswordPage = withLazyLoading(() => import('./auth/ResetPasswordPage'));
const CallbackPage = withLazyLoading(() => import('./auth/CallbackPage')); 
import { QuickStatsData, Task, Project as ProjectTypeApp, User as FrontendUser, DarkModeContextType, NavItem, TeamType, GlobalSearchResults, GlobalSearchResultItem, FocusSession } from './types';
import { taskService } from './taskService';
import { projectService } from './projectService';
import { teamService } from './teamService';
import { noteService } from './noteService';
import { resourceService } from './resourceService';
import { connectService } from './connectService';
import { calendarService } from './calendarService';
import { analyticsService } from './analyticsService';
import { supabase } from './supabaseClient';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { ThemeToggleButton, SearchResultsDropdown } from './components'; 
import { WelcomeNotification } from './components/WelcomeNotification';
import { NotificationCenter } from './components/NotificationCenter';
import { ErrorBoundary } from './components/ErrorBoundary';
import ChatBot from './components/ChatBot';
import ChatButton from './components/ChatButton';
import { StreamProvider } from './components/StreamProvider';
import { StreamVideoProvider } from './components/StreamVideoProvider';
import { CallNotificationProvider } from './components/CallNotificationProvider';
import { serviceWorkerManager } from './serviceWorkerManager';
const VideoCallPage = withLazyLoading(() => import('./pages/VideoCallPage').then(m => ({ default: m.VideoCallPage })));
const VoiceCallPage = withLazyLoading(() => import('./pages/VoiceCallPage').then(m => ({ default: m.VoiceCallPage })));
const CallingPage = withLazyLoading(() => import('./pages/CallingPage').then(m => ({ default: m.CallingPage })));

// Import Stream Chat CSS - already imported in index.html

export const DarkModeContext = React.createContext<DarkModeContextType | undefined>(undefined);

interface FocusModeContextType {
  isFocusModeActive: boolean;
  timeRemaining: number;
  startFocusSession: () => void;
  stopFocusSession: () => Promise<void>;
  totalFocusTimeTodayMs: number;
}
export const FocusModeContext = React.createContext<FocusModeContextType | undefined>(undefined);

// Helper function to get local date string in YYYY-MM-DD format
const getLocalDateString = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

interface SidebarProps {
  quickStats: QuickStatsData;
  isVisible: boolean;
  isPermanent: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onTogglePermanent: () => void;
  onClose: () => void; 
}

const Sidebar: React.FC<SidebarProps> = ({ 
  quickStats, 
  isVisible, 
  isPermanent, 
  onMouseEnter, 
  onMouseLeave, 
  onTogglePermanent,
  onClose
}) => {
  const location = useLocation();
  const [moreExpanded, setMoreExpanded] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const isMobile = useCallback(() => {
    return window.innerWidth < 768 || 'ontouchstart' in window;
  }, []);

  const checkActivePath = useCallback((itemPath: string, childPaths?: string[]) => {
    const basePath = '/app';
    const currentAppPath = location.pathname;
  
    const isDirectlyActive = (pathToCheck: string) => {
      if (pathToCheck === '#') return false; 
      if (pathToCheck === '/') {
        return currentAppPath === basePath || currentAppPath === `${basePath}/`;
      }
      return currentAppPath.startsWith(`${basePath}${pathToCheck}`);
    };
  
    if (isDirectlyActive(itemPath)) {
      return true;
    }
  
    if (childPaths) {
      return childPaths.some(childPath => isDirectlyActive(childPath));
    }
  
    return false;
  }, [location.pathname]);
  
  const generateAppPath = (itemPath: string) => {
    if (itemPath === '/') return '/app';
    return `/app${itemPath}`;
  }

  const handleNavItemClick = () => {
    if (isMobile() && !isPermanent) {
      setTimeout(() => onClose(), 150);
    }
  };

  useEffect(() => {
    const moreItem = NAVIGATION_ITEMS.find(item => item.children);
    if (moreItem && moreItem.children) {
      const isChildActive = moreItem.children.some(child => checkActivePath(child.path));
      if (isChildActive && !moreExpanded) {
        setMoreExpanded(true);
      }
    }
  }, [location.pathname, moreExpanded, checkActivePath]); 

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        isVisible && 
        !isPermanent && 
        isMobile() &&
        sidebarRef.current && 
        !sidebarRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    if (isVisible && !isPermanent) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isVisible, isPermanent, isMobile, onClose]);

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {!isPermanent && isMobile() && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
              onClick={onClose}
            />
          )}
          
          <motion.div 
            ref={sidebarRef}
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="bg-card dark:bg-card-dark h-screen fixed top-0 left-0 flex flex-col border-r border-gray-200 dark:border-gray-700 shadow-lg w-64 z-50"
            onMouseEnter={!isMobile() ? onMouseEnter : undefined}
            onMouseLeave={!isMobile() ? onMouseLeave : undefined}
          >
            <div className="p-5 h-16 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <Link 
                to="integral.ind.in" 
                className="text-2xl font-semibold text-blue-400 dark:text-blue-400"
                onClick={handleNavItemClick}
              >
                {APP_NAME}
              </Link>
              <button
                onClick={onTogglePermanent}
                className="p-1.5 text-muted dark:text-muted-dark hover:text-text dark:hover:text-text-dark rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title={isPermanent ? "Switch to hover mode" : "Keep navigation permanent"}
              >
                {isPermanent ? (
                  <ChevronDoubleLeftIcon className="w-4 h-4" />
                ) : (
                  <ChevronDoubleRightIcon className="w-4 h-4" />
                )}
              </button>
            </div>
            
            <nav className="flex-grow p-3 space-y-1 overflow-y-auto">
              {NAVIGATION_ITEMS.map(item => {
                const isParentActive = item.children ? item.children.some(child => checkActivePath(child.path)) : false;
                
                if (item.children) {
                  return (
                    <React.Fragment key={item.name}>
                      <button
                        onClick={() => setMoreExpanded(!moreExpanded)}
                        className={`flex items-center justify-between w-full px-3 py-2.5 rounded-lg transition-colors
                                    ${isParentActive 
                                      ? 'bg-primary/80 text-white' 
                                      : 'text-muted dark:text-muted-dark hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-text dark:hover:text-text-dark'}`}
                        aria-expanded={moreExpanded}
                      >
                        <div className="flex items-center space-x-3">
                          <item.icon className="w-5 h-5 flex-shrink-0" />
                          <span className="truncate">{item.name}</span>
                        </div>
                        {moreExpanded ? <ChevronDownIcon className="w-4 h-4 flex-shrink-0" /> : <ChevronRightIcon className="w-4 h-4 flex-shrink-0" />}
                      </button>
                      <AnimatePresence>
                        {moreExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden pl-3" 
                          >
                            {item.children.map(childItem => (
                              <Link
                                key={childItem.name}
                                to={generateAppPath(childItem.path)}
                                title={childItem.name}
                                onClick={handleNavItemClick}
                                className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors mt-1
                                            ${checkActivePath(childItem.path)
                                              ? 'bg-primary text-white shadow-sm'
                                              : 'text-muted dark:text-muted-dark hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-text dark:hover:text-text-dark'}`}
                              >
                                <childItem.icon className="w-5 h-5 flex-shrink-0 ml-1" /> 
                                <span className="truncate">{childItem.name}</span>
                              </Link>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </React.Fragment>
                  );
                } else {
                  return (
                    <Link
                      key={item.name}
                      to={generateAppPath(item.path)}
                      onClick={handleNavItemClick}
                      className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors
                                  ${checkActivePath(item.path) 
                                    ? 'bg-primary text-white shadow-sm'
                                    : 'text-muted dark:text-muted-dark hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-text dark:hover:text-text-dark'}`}
                    >
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      <span className="truncate">{item.name}</span>
                    </Link>
                  );
                }
              })}
            </nav>
            
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-xs font-semibold uppercase text-muted dark:text-muted-dark mb-2">Quick Stats</h3>
              <div className="space-y-1.5 text-sm">
                {Object.entries(quickStats).map(([key, value]) => (
                 <div key={key} className="flex justify-between text-muted dark:text-muted-dark">
                    <span className="truncate">{QUICK_STATS_LABELS[key as keyof QuickStatsData]}</span>
                    <span className="font-semibold text-text dark:text-text-dark">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

const MenuToggleButton: React.FC<{ onToggle: () => void }> = ({ onToggle }) => {
  return (
    <button
      onClick={onToggle}
      className="p-2 text-muted dark:text-muted-dark hover:text-text dark:hover:text-text-dark rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      title="Show Navigation"
    >
      <svg
        className="w-6 h-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 6h16M4 12h16M4 18h16"
        />
      </svg>
    </button>
  );
};

interface HeaderProps {
  currentUser: FrontendUser | null;
  handleLogout: () => void;
  onMenuToggle: () => void;
  isPermanent: boolean;
  isSidebarVisible: boolean;
  onGlobalSearch: (query: string) => Promise<GlobalSearchResults>;
}

const Header: React.FC<HeaderProps> = ({ currentUser, handleLogout, onMenuToggle, isPermanent, isSidebarVisible, onGlobalSearch }) => {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GlobalSearchResults | null>(null);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [isSearchResultsVisible, setIsSearchResultsVisible] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const debounceTimeoutRef = useRef<number | null>(null);

  const executeSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults(null);
      setIsSearchResultsVisible(false);
      setIsSearchLoading(false);
      return;
    }
    setIsSearchLoading(true);
    try {
      const results = await onGlobalSearch(query);
      setSearchResults(results);
      const hasResults = Object.values(results).some(categoryResults => Array.isArray(categoryResults) && categoryResults.length > 0);
      setIsSearchResultsVisible(hasResults);
    } catch (error) {
      console.error("Error performing global search:", error);
      setSearchResults(null);
      setIsSearchResultsVisible(false);
    } finally {
      setIsSearchLoading(false);
    }
  }, [onGlobalSearch]);

  const debouncedSearch = useCallback((query: string) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    debounceTimeoutRef.current = window.setTimeout(() => {
      executeSearch(query);
    }, 300);
  }, [executeSearch]);

  const handleSearchInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const query = event.target.value;
    setSearchQuery(query);
    if (query.trim().length > 0) {
      debouncedSearch(query);
    } else {
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
      setSearchResults(null);
      setIsSearchResultsVisible(false);
      setIsSearchLoading(false);
    }
  };
  
  const handleSearchInputFocus = () => {
    if (searchQuery.trim() && searchResults && (Object.values(searchResults) as GlobalSearchResultItem[][]).some(r => r.length > 0)) {
      setIsSearchResultsVisible(true);
    }
  };

  const closeSearchResults = useCallback(() => {
    setIsSearchResultsVisible(false);
  }, []);

  const handleResultNavigation = (path: string, state?: any) => {
    navigate(path, { state });
    setSearchQuery('');
    setSearchResults(null);
    closeSearchResults();
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        closeSearchResults();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [closeSearchResults]);

  return (
    <header className="bg-card dark:bg-card-dark h-16 flex items-center justify-between px-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
      <div className="flex items-center">
        {!(isPermanent && isSidebarVisible) && (
          <MenuToggleButton onToggle={onMenuToggle} />
        )}
      </div>
      <div className="flex-grow flex justify-center" ref={searchContainerRef}> 
        <div className="relative w-full max-w-lg"> 
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <SearchIcon className="w-5 h-5 text-gray-400 dark:text-gray-500" />
            </div>
            <input
                type="search"
                placeholder="Search everything..."
                className="block w-full pl-10 pr-3 py-2 border border-border dark:border-border-dark rounded-lg leading-5 bg-surface dark:bg-surface-dark text-text dark:text-text-dark placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm"
                value={searchQuery}
                onChange={handleSearchInputChange}
                onFocus={handleSearchInputFocus}
                aria-label="Search everything"
            />
            {isSearchLoading && searchQuery && (
                 <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                 </div>
            )}
            {isSearchResultsVisible && (
              <SearchResultsDropdown
                results={searchResults}
                isLoading={isSearchLoading}
                onClose={closeSearchResults}
                onNavigate={handleResultNavigation}
              />
            )}
        </div>
      </div>
      <div className="flex items-center space-x-3 sm:space-x-4">
        <ThemeToggleButton />
        <NotificationCenter currentUser={currentUser} />
        <div className="relative">
          <button onClick={() => setUserMenuOpen(!userMenuOpen)} className="flex items-center focus:outline-none">
            {currentUser?.avatar_url ? (
              <img src={currentUser.avatar_url} alt="User Avatar" className="w-8 h-8 rounded-full mr-2 object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-semibold text-sm mr-2">
                {currentUser?.name ? currentUser.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase() : <UserCircleIcon className="w-5 h-5"/>}
              </div>
            )}
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-text dark:text-text-dark truncate max-w-[100px]">{currentUser?.name || "Guest"}</p>
              <p className="text-xs text-muted dark:text-muted-dark">{currentUser?.plan || "No plan"}</p>
            </div>
          </button>
          {userMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-card dark:bg-card-dark rounded-md shadow-lg py-1 z-50 border border-border dark:border-border-dark">
              <Link to="/app/connect" className="flex items-center px-4 py-2 text-sm text-text dark:text-text-dark hover:bg-surface dark:hover:bg-surface-dark" onClick={() => setUserMenuOpen(false)}>
                <UsersIcon className="w-4 h-4 mr-2"/> Connect
              </Link>
              <Link to="/app/settings" className="flex items-center px-4 py-2 text-sm text-text dark:text-text-dark hover:bg-surface dark:hover:bg-surface-dark" onClick={() => setUserMenuOpen(false)}>
                <CogIcon className="w-4 h-4 mr-2"/> Settings
              </Link>
              <div className="my-1 border-t border-border dark:border-border-dark"></div>
              <button
                onClick={() => { handleLogout(); setUserMenuOpen(false); }}
                className="block w-full text-left px-4 py-2 text-sm text-text dark:text-text-dark hover:bg-surface dark:hover:bg-surface-dark"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

const AuthenticatedLayout: React.FC<{
  quickStats: QuickStatsData;
  isSidebarVisible: boolean;
  isPermanent: boolean;
  showSidebar: () => void;
  hideSidebar: () => void;
  togglePermanent: () => void;
  closeSidebar: () => void; 
  currentUser: FrontendUser | null;
  handleLogout: () => void;
  children: ReactNode;
  onGlobalSearch: (query: string) => Promise<GlobalSearchResults>;
}> = ({ 
  quickStats, 
  isSidebarVisible, 
  isPermanent, 
  showSidebar, 
  hideSidebar, 
  togglePermanent, 
  closeSidebar,
  currentUser, 
  handleLogout, 
  children,
  onGlobalSearch
}) => (
  <div className="flex h-screen bg-background dark:bg-background-dark">
    <Sidebar 
      quickStats={quickStats} 
      isVisible={isSidebarVisible} 
      isPermanent={isPermanent}
      onMouseEnter={showSidebar}
      onMouseLeave={hideSidebar}
      onTogglePermanent={togglePermanent}
      onClose={closeSidebar}
    />
    <div className={`flex-1 flex flex-col transition-all duration-300 ${isPermanent && isSidebarVisible ? 'ml-64' : ''}`}>
      <Header 
        currentUser={currentUser} 
        handleLogout={handleLogout} 
        onMenuToggle={showSidebar}
        isPermanent={isPermanent}
        isSidebarVisible={isSidebarVisible}
        onGlobalSearch={onGlobalSearch}
      />
      <main className="flex-1 overflow-y-auto p-0">
        {children} 
      </main>
    </div>
  </div>
);

const App: React.FC = () => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      const storedPreference = localStorage.getItem('theme');
      if (storedPreference) {
        return storedPreference === 'dark';
      }
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch (error) {
      console.warn('Error accessing localStorage:', error);
      return false;
    }
  });

  const [appTasks, setAppTasks] = useState<Task[]>([]);
  const [appProjects, setAppProjects] = useState<ProjectTypeApp[]>([]);
  const [appTeams, setAppTeams] = useState<TeamType[]>([]); 
  const [isLoading, setIsLoading] = useState(true); 
  const [authLoading, setAuthLoading] = useState(true); 
  const [error, setError] = useState<string | null>(null);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [isPermanent, setIsPermanent] = useState(() => {
    try {
      const stored = localStorage.getItem('sidebar-permanent');
      return stored ? JSON.parse(stored) : false;
    } catch (error) {
      console.warn('Error saving sidebar preference:', error);
      return false;
    }
  });
  const [isAuthenticated, setIsAuthenticated] = useState(false); 
  const [currentUser, setCurrentUser] = useState<FrontendUser | null>(null);
  const navigate = useNavigate(); 
  const [showWelcomeNotice, setShowWelcomeNotice] = useState(false);

  // Chat bot state
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Focus Mode State
  const [allFocusSessions, setAllFocusSessions] = useState<FocusSession[]>([]);
  const [isFocusModeActive, setIsFocusModeActive] = useState(false);
  const [focusDuration, setFocusDuration] = useState(1500); // 25 minutes
  const [timeRemaining, setTimeRemaining] = useState(1500);

  useEffect(() => {
    try {
      if (isDarkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    } catch (error) {
      console.warn('Error setting theme:', error);
    }
  }, [isDarkMode]);

  // Service Worker Registration
  useEffect(() => {
    const registerServiceWorker = async () => {
      try {
        console.log('Registering service worker...');
        const registration = await serviceWorkerManager.registerServiceWorker();
        
        if (registration) {
          console.log('Service worker registered successfully');
        } else {
          console.warn('Service worker registration failed or not supported');
        }
      } catch (error) {
        console.error('Error during service worker registration:', error);
      }
    };

    // Register service worker only in production or when explicitly enabled
    if (import.meta.env.PROD || import.meta.env.VITE_ENABLE_SW) {
      registerServiceWorker();
    } else {
      console.log('Service worker registration skipped in development mode');
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('sidebar-permanent', JSON.stringify(isPermanent));
      if (isPermanent) {
        setIsSidebarVisible(true);
      }
    } catch (error) {
      console.warn('Error saving sidebar preference:', error);
    }
  }, [isPermanent]);

  useEffect(() => {
    let isMounted = true; 

    const getSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (isMounted) {
          if (session && session.user) {
            await handleLogin(session.user); 
          } else {
            setIsAuthenticated(false);
            setIsLoading(false); 
          }
          setAuthLoading(false); 
        }
      } catch (err) {
        console.error('Session check error:', err);
        if (isMounted) {
          setIsAuthenticated(false);
          setIsLoading(false);
          setAuthLoading(false);
        }
      }
    };
    
    getSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (isMounted) {
        setAuthLoading(true);
        if (session && session.user) {
          await handleLogin(session.user); 
        } else {
          handleLogoutCleanup(); 
        }
        setAuthLoading(false);
      }
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      try {
        const hasSeenNotice = localStorage.getItem('hasSeenWelcomeNotice');
        if (!hasSeenNotice) {
          setShowWelcomeNotice(true);
          localStorage.setItem('hasSeenWelcomeNotice', 'true');
        }
      } catch (e) {
        console.warn("Could not access localStorage for welcome notice:", e);
      }
    }
  }, [isAuthenticated, authLoading]);

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      fetchAppData();
    } else if (!isAuthenticated && !authLoading) {
      setAppTasks([]);
      setAppProjects([]);
      setAppTeams([]); 
      setIsLoading(false);
      setError(null);
    }
  }, [isAuthenticated, authLoading]);

  // Focus Sessions Fetch
  useEffect(() => {
    if (!currentUser) return;
    
    const loadFocusSessions = async () => {
      try {
        // Load from localStorage first for immediate display
        const stored = localStorage.getItem('focusSessions');
        if (stored) {
          const localSessions = JSON.parse(stored);
          setAllFocusSessions(localSessions);
        }
        
        // Then fetch from server for sync
        const today = new Date();
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);
        const startDateStr = getLocalDateString(thirtyDaysAgo);
        const sessions = await analyticsService.getFocusSessionsForUser(currentUser.id, startDateStr);
        setAllFocusSessions(sessions);
      } catch (e) { 
        console.error("Error loading focus sessions in App:", e); 
      }
    };
    
    loadFocusSessions();
  }, [currentUser]);

  // Initialize last focus date on first load
  useEffect(() => {
    const today = getLocalDateString();
    if (!localStorage.getItem('lastFocusDate')) {
      localStorage.setItem('lastFocusDate', today);
    }
  }, []);

  // Daily reset logic for focus mode
  useEffect(() => {
    const checkDailyReset = () => {
      const today = getLocalDateString();
      const lastDate = localStorage.getItem('lastFocusDate');
      
      if (lastDate !== today) {

        // Reset focus sessions for new day
        setAllFocusSessions(prev => {
          // Keep only sessions from today and yesterday for trend calculations
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = getLocalDateString(yesterday);
          
          return prev.filter(session => 
            session.date === today || session.date === yesterdayStr
          );
        });
        
        // Save the new date
        localStorage.setItem('lastFocusDate', today);
      }
    };
    
    // Check on app load
    checkDailyReset();
    
    // Check every minute
    const interval = setInterval(checkDailyReset, 60000);
    
    // Check when window becomes visible
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkDailyReset();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Save focus sessions to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('focusSessions', JSON.stringify(allFocusSessions));
    } catch (error) {
      console.error('Error saving focus sessions:', error);
    }
  }, [allFocusSessions]);

  // Focus Timer Logic
  useEffect(() => {
    if (!isFocusModeActive) return;

    const intervalId = setInterval(() => {
        setTimeRemaining(prevTime => {
            if (prevTime <= 1) {
                clearInterval(intervalId);
                
                const elapsedSeconds = focusDuration;
                if (currentUser) {
                    const todayStr = getLocalDateString();
                    analyticsService.createFocusSession(currentUser.id, todayStr, elapsedSeconds * 1000)
                        .then((newSession) => {
                            if (newSession) {
                                setAllFocusSessions(prev => [...prev, newSession]);
                            }
                            alert(`Focus session of ${Math.round(elapsedSeconds / 60)} minutes complete!`);
                        })
                        .catch(e => console.error("Failed to save completed focus session:", e));
                }
                
                new Audio('https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg').play().catch(e => console.error("Error playing sound:", e));
                setIsFocusModeActive(false);
                return 0;
            }
            return prevTime - 1;
        });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [isFocusModeActive, currentUser, focusDuration]);

  const startFocusSession = () => {
    const DURATION = 1500; // 25 minutes
    setFocusDuration(DURATION);
    setTimeRemaining(DURATION);
    setIsFocusModeActive(true);
  };

  const stopFocusSession = async () => {
    const elapsedSeconds = focusDuration - timeRemaining;
    setIsFocusModeActive(false);

    if (elapsedSeconds > 10 && currentUser) {
        try {
            const todayStr = getLocalDateString();
            const newSession = await analyticsService.createFocusSession(currentUser.id, todayStr, elapsedSeconds * 1000);
            if (newSession) {
              setAllFocusSessions(prev => [...prev, newSession]);
            }
            alert(`Focus session of ${Math.round(elapsedSeconds / 60)} minutes saved!`);
        } catch(e) {
            console.error("Failed to save focus session:", e);
            alert("Could not save your focus session. Please try again later.");
        }
    }
  };

  const totalFocusTimeTodayMs = useMemo(() => {
    const todayStr = getLocalDateString();
    return allFocusSessions
        .filter(session => session.date === todayStr)
        .reduce((sum, s) => sum + s.durationMs, 0);
  }, [allFocusSessions]);

  const focusModeContextValue = {
    isFocusModeActive,
    timeRemaining,
    startFocusSession,
    stopFocusSession,
    totalFocusTimeTodayMs,
  };

  const fetchAppData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [tasksData, projectsData, teamsData] = await Promise.all([ 
        taskService.getAllTasks(),
        projectService.getAllProjectsForUser(),
        teamService.getAllTeamsForUser(), 
      ]);
      setAppTasks(tasksData || []);
      setAppProjects(projectsData || []);
      setAppTeams(teamsData || []); 
    } catch (err) {
      console.error("Error fetching initial app data:", err);
      setError((err as Error).message || 'Failed to load app data.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleLogin = async (user: SupabaseUser) => {
    setIsAuthenticated(true);
    const plan = user.user_metadata?.plan;
    setCurrentUser({
      id: user.id,
      name: user.user_metadata?.full_name || 
            user.user_metadata?.name || 
            user.email?.split('@')[0] || 
            "User",
      email: user.email || "No email",
      avatar_url: user.user_metadata?.avatar_url || 
              user.user_metadata?.picture || null, 
      plan: (typeof plan === 'string' && plan) ? plan : 'Free Plan',
      full_name: user.user_metadata?.full_name || null
    });

    // Check for pending invite code after successful authentication
    try {
      const pendingInviteCode = localStorage.getItem('pendingInviteCode');
      if (pendingInviteCode) {
        // Remove the code from localStorage to prevent future unintended redirects
        localStorage.removeItem('pendingInviteCode');
        
        // Navigate to the authenticated invite acceptance page
        navigate(`/app/join-team/${pendingInviteCode}`, { replace: true });
        return; // Exit early, don't continue with normal flow
      }
    } catch (error) {
      console.warn('Error handling pending invite redirect:', error);
    }
    
    // If no pending invite, the normal navigation will happen through the routing system
  };

  const handleLogoutCleanup = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    setAppTasks([]); 
    setAppProjects([]);
    setAppTeams([]); 
  };

  const handleLogout = async () => {
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        console.error("Error signing out:", signOutError);
      }
      handleLogoutCleanup(); 
      navigate('/signin', { replace: true }); 
    } catch (err) {
      console.error('Logout error:', err);
      navigate('/signin', { replace: true });
    }
  };

  const toggleDarkMode = () => setIsDarkMode(prev => !prev);
  const showSidebar = () => setIsSidebarVisible(true);
  const hideSidebar = () => {
    if (!isPermanent) {
      setIsSidebarVisible(false);
    }
  };
  const closeSidebar = () => setIsSidebarVisible(false); 
  const togglePermanent = () => setIsPermanent(prev => !prev);

  const quickStats: QuickStatsData = useMemo(() => {
    try {
      const today = getLocalDateString();
      return {
        tasksToday: appTasks.filter(task => task.dueDate === today && task.status !== 'Completed').length,
        completed: appTasks.filter(task => task.status === 'Completed' && task.completedAt?.startsWith(today)).length, 
        inProgress: appTasks.filter(task => task.status === 'In Progress').length,
      };
    } catch (error) {
      console.error('Error calculating quick stats:', error);
      return { tasksToday: 0, completed: 0, inProgress: 0 };
    }
  }, [appTasks]);

  const handleGlobalSearch = useCallback(async (query: string): Promise<GlobalSearchResults> => {
    if (!currentUser?.id) {
      return { tasks: [], projects: [], notes: [], teams: [], resources: [], users: [], calendarEvents: [] };
    }
    const [
        taskResults, 
        projectResults, 
        noteResults,
        teamResults,
        resourceResults,
        userResults,
        calendarEventResults
    ] = await Promise.all([
      taskService.search(query, currentUser.id),
      projectService.search(query, currentUser.id),
      noteService.search(query, currentUser.id),
      teamService.search(query, currentUser.id),
      resourceService.search(query, currentUser.id),
      connectService.search(query, currentUser.id),
      calendarService.search(query, currentUser.id),
    ]);
    return {
      tasks: taskResults,
      projects: projectResults,
      notes: noteResults,
      teams: teamResults,
      resources: resourceResults,
      users: userResults,
      calendarEvents: calendarEventResults,
    };
  }, [currentUser?.id]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background dark:bg-background-dark text-text dark:text-text-dark">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <div>Checking authentication status...</div>
        </div>
      </div>
    );
  }
  
  const authenticatedApp = (
    <AuthenticatedLayout
      quickStats={quickStats}
      isSidebarVisible={isSidebarVisible}
      isPermanent={isPermanent}
      showSidebar={showSidebar}
      hideSidebar={hideSidebar}
      togglePermanent={togglePermanent}
      closeSidebar={closeSidebar}
      currentUser={currentUser}
      handleLogout={handleLogout}
      onGlobalSearch={handleGlobalSearch}
    >
      {isLoading && !error && (
        <div className="flex items-center justify-center h-full text-text dark:text-text-dark">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <div>Loading application data...</div>
          </div>
        </div>
      )}

      {!isLoading && !error && (
        <Routes>
          <Route path="/" element={
            <DashboardPage 
              appTasks={appTasks} 
              setAppTasks={setAppTasks} 
              appProjects={appProjects}
              appTeams={appTeams} 
              currentUser={currentUser} 
            />
          } />
          <Route path="tasks" element={
            <TasksPage 
              appTasks={appTasks} 
              setAppTasks={setAppTasks} 
              appProjects={appProjects} 
              currentUser={currentUser} 
            />
          } />
          <Route path="calendar" element={
            <CalendarPage 
              appTasks={appTasks} 
              currentUser={currentUser}
            />
          } />
          <Route path="connect" element={
            <ConnectPage currentUser={currentUser} />
          } />
          <Route path="resources" element={<ResourcesPage />} />
          <Route
            path="collaboration/*" // Use wildcard to handle nested routing
            element={
              <CollaborationPage
                currentUser={currentUser}
                appTasks={appTasks}
                setAppTasks={setAppTasks}
                appProjects={appProjects} 
                setAppProjects={setAppProjects}
              />
            }
          />
          <Route path="notes" element={
            <NotesPage currentUser={currentUser}/>
          } />
          <Route path="analytics" element={
            <AnalyticsPage 
              appTasks={appTasks} 
              appProjects={appProjects}
            />
          } />
          <Route path="settings" element={
            <SettingsPage 
              currentUser={currentUser} 
              setCurrentUser={setCurrentUser} 
            />
          } />
          <Route path="join-team/:inviteCode" element={<JoinTeamPage />} />
          <Route path="calling/:callId" element={<CallingPage />} />
          <Route path="call/:callId" element={<VideoCallPage />} />
          <Route path="voice/:callId" element={<VoiceCallPage />} />
          <Route path="*" element={<Navigate to="/app" replace />} />

        </Routes>
      )}
    </AuthenticatedLayout>
  );

  return (
    <ErrorBoundary showDetails={process.env.NODE_ENV === 'development'}>
      <DarkModeContext.Provider value={{ isDarkMode, toggleDarkMode }}>
        <FocusModeContext.Provider value={focusModeContextValue}>
          <WelcomeNotification 
            show={showWelcomeNotice}
            onDismiss={() => setShowWelcomeNotice(false)}
            message="Some features and icons currently visible on the screen are placeholders and have not yet been developed or made functional"
          />
          
          {/* Chat components - only show when authenticated */}
          {isAuthenticated && (
            <>
              <ChatButton onClick={() => setIsChatOpen(true)} />
              <ChatBot isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
            </>
          )}
          
          <Routes>
          <Route path="/join-team/:inviteCode" element={<JoinTeamPage />} />
          <Route 
            path="/" 
            element={isAuthenticated ? <Navigate to="/app" replace /> : <LandingPage />} 
          />
          <Route 
            path="/signin" 
            element={isAuthenticated ? <Navigate to="/app" replace /> : <SignInPage onSignInSuccess={() => {}} />} 
          />
          <Route 
            path="/signup" 
            element={isAuthenticated ? <Navigate to="/app" replace /> : <SignUpPage />} 
          />
          <Route 
            path="/forgot-password" 
            element={isAuthenticated ? <Navigate to="/app" replace /> : <ForgotPasswordPage />} 
          />
          <Route 
            path="/reset-password" 
            element={isAuthenticated ? <Navigate to="/app" replace /> : <ResetPasswordPage />} 
          />
          <Route 
            path="/auth/callback" 
            element={<CallbackPage />} 
          />
          <Route 
            path="/app/*" 
            element={
              isAuthenticated && currentUser ? (
                <ErrorBoundary>
                  <StreamProvider currentUser={currentUser}>
                    <ErrorBoundary>
                      <StreamVideoProvider currentUser={currentUser}>
                        <ErrorBoundary>
                          <CallNotificationProvider currentUser={currentUser}>
                            <ErrorBoundary>
                              {authenticatedApp}
                            </ErrorBoundary>
                          </CallNotificationProvider>
                        </ErrorBoundary>
                      </StreamVideoProvider>
                    </ErrorBoundary>
                  </StreamProvider>
                </ErrorBoundary>
              ) : (
                <Navigate to="/signin" replace />
              )
            } 
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </FocusModeContext.Provider>
    </DarkModeContext.Provider>
    </ErrorBoundary>
  );
};

const AppWrapper: React.FC = () => (
  <BrowserRouter>
    <App />
  </BrowserRouter>
);

export default AppWrapper;