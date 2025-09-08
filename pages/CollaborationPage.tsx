import React, { useState, useEffect, useCallback } from 'react';
import { TeamPage } from './TeamPage';
import { ProjectsPage } from './ProjectsPage';
import { DepartmentDetailPage } from './DepartmentDetailPage';
import { User as FrontendUser, Task, Project as ProjectTypeApp, TeamType as AppTeamType } from '../types';
import { teamService } from '../teamService';
import { projectService } from '../projectService';
import { taskService } from '../taskService'; // Keep if ProjectsPage interacts with tasks directly
import { TeamChatPage } from './TeamChatPage';

/**
 * Props for the CollaborationPage component.
 */
interface CollaborationPageProps {
  /** The currently authenticated user. */
  currentUser: FrontendUser | null;
  /** Global state for tasks, passed down to relevant sub-pages. */
  appTasks: Task[];
  /** Setter for the global task state. */
  setAppTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  /** Global state for projects, managed by this page. */
  appProjects: ProjectTypeApp[];
  /** Setter for the global project state. */
  setAppProjects: React.Dispatch<React.SetStateAction<ProjectTypeApp[]>>;
}

/**
 * A top-level component that orchestrates the collaboration workspace.
 * It manages fetching data for teams and projects, and acts as a router
 * to display either a main dashboard or detailed views for teams, projects,
 * departments, or team chats.
 */
export const CollaborationPage: React.FC<CollaborationPageProps> = ({
  currentUser,
  appTasks,
  setAppTasks,
  appProjects,
  setAppProjects,
}) => {
  const [allTeams, setAllTeams] = useState<AppTeamType[]>([]);

  // View management state
  const [activeView, setActiveView] = useState<'dashboard' | 'teamDetails' | 'projectDetails' | 'departmentDetails' | 'teamChat'>('dashboard');
  const [currentTeamIdForDetail, setCurrentTeamIdForDetail] = useState<string | null>(null);
  const [currentProjectIdForDetail, setCurrentProjectIdForDetail] = useState<string | null>(null);
  const [currentDepartmentIdForDetail, setCurrentDepartmentIdForDetail] = useState<string | null>(null);

  // Data loading and error state
  const [isLoadingPageData, setIsLoadingPageData] = useState(true);
  const [errorPageData, setErrorPageData] = useState<string | null>(null);

  /**
   * Fetches all necessary data for the collaboration workspace (teams and projects).
   * @param {boolean} showLoader - If true, the main page loader will be displayed during the fetch.
   * Defaults to false for background refreshes.
   */
  const fetchCollaborationData = useCallback(async (showLoader = false) => {
    if (!currentUser) {
      setAllTeams([]);
      setAppProjects([]);
      if (showLoader) setIsLoadingPageData(false);
      return;
    }
    if (showLoader) setIsLoadingPageData(true);
    setErrorPageData(null);
    try {
      const [teamsResult, projectsResult] = await Promise.all([
        teamService.getAllTeamsForUser(),
        projectService.getAllProjectsForUser(),
      ]);
      setAllTeams(teamsResult);
      setAppProjects(projectsResult); // Directly update the global project state
    } catch (err) {
      console.error("Error fetching collaboration data:", err);
      setErrorPageData(err instanceof Error ? err.message : "Failed to load collaboration data.");
    } finally {
      if (showLoader) setIsLoadingPageData(false);
    }
  }, [currentUser, setAppProjects]);

  // Initial data fetch on component mount or when user changes.
  useEffect(() => {
    fetchCollaborationData(true);
  }, [fetchCollaborationData]);

  // --- View Navigation Handlers ---

  const handleShowTeamDetails = useCallback((teamId: string) => {
    setActiveView('teamDetails');
    setCurrentTeamIdForDetail(teamId);
    setCurrentProjectIdForDetail(null);
    setCurrentDepartmentIdForDetail(null);
  }, []);

  const handleViewProjectDetails = useCallback((projectId: string) => {
    setActiveView('projectDetails');
    setCurrentProjectIdForDetail(projectId);
    setCurrentTeamIdForDetail(null);
    setCurrentDepartmentIdForDetail(null);
  }, []);

  const handleShowDepartmentDetails = useCallback((teamId: string, departmentId: string) => {
    setActiveView('departmentDetails');
    setCurrentTeamIdForDetail(teamId);
    setCurrentDepartmentIdForDetail(departmentId);
    setCurrentProjectIdForDetail(null);
  }, []);

  const handleViewTeamChat = useCallback((teamId: string) => {
    setActiveView('teamChat');
    setCurrentTeamIdForDetail(teamId);
    setCurrentProjectIdForDetail(null);
    setCurrentDepartmentIdForDetail(null);
  }, []);

  const handleReturnFromDepartment = useCallback(() => {
    setActiveView('teamDetails');
    setCurrentDepartmentIdForDetail(null);
    // No data refetch is needed here as we are returning to the parent view
    // which already has the necessary data loaded.
  }, []);

  const handleReturnToDashboard = useCallback(async () => {
    setActiveView('dashboard');
    setCurrentTeamIdForDetail(null);
    setCurrentProjectIdForDetail(null);
    setCurrentDepartmentIdForDetail(null);
    // Refresh all data to ensure the dashboard is up-to-date
    await fetchCollaborationData(true);
  }, [fetchCollaborationData]);

  // --- Render Logic ---

  // Only show the full-page loader on the initial load of the dashboard.
  if (isLoadingPageData && activeView === 'dashboard') {
    return (
      <div className="flex items-center justify-center h-full p-6 bg-background dark:bg-background-dark text-text dark:text-text-dark">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <div>Loading collaboration workspace...</div>
        </div>
      </div>
    );
  }

  if (errorPageData) {
    return (
      <div className="flex items-center justify-center h-full p-6 bg-background dark:bg-background-dark text-red-500">
        Error: {errorPageData}
      </div>
    );
  }

  // --- View Routing ---

  if (activeView === 'departmentDetails' && currentTeamIdForDetail && currentDepartmentIdForDetail) {
    return (
      <DepartmentDetailPage
        key={`dept-${currentDepartmentIdForDetail}`}
        teamId={currentTeamIdForDetail}
        departmentId={currentDepartmentIdForDetail}
        currentUser={currentUser}
        onBack={handleReturnFromDepartment}
      />
    );
  }

  if (activeView === 'teamChat' && currentTeamIdForDetail) {
    const teamForChat = allTeams.find(t => t.id === currentTeamIdForDetail);
    if (teamForChat && currentUser) {
      return <TeamChatPage team={teamForChat} currentUser={currentUser} onBack={handleShowTeamDetails} />;
    }
  }

  if (activeView === 'teamDetails' && currentTeamIdForDetail) {
    return (
      <TeamPage
        key={`team-${currentTeamIdForDetail}`}
        initialTeams={allTeams}
        currentUser={currentUser}
        isLoadingParent={false} // Loading is handled by this parent component
        selectedTeamIdForDetailView={currentTeamIdForDetail}
        onReturnToDashboard={handleReturnToDashboard}
        onDataRefreshNeeded={fetchCollaborationData}
        onViewDepartmentDetails={handleShowDepartmentDetails}
        onViewTeamChat={handleViewTeamChat}
      />
    );
  }

  if (activeView === 'projectDetails' && currentProjectIdForDetail) {
    return (
      <ProjectsPage
        key={`project-${currentProjectIdForDetail}`}
        selectedProjectIdForDetailView={currentProjectIdForDetail}
        onReturnToDashboard={handleReturnToDashboard}
        initialAppProjects={appProjects} // Use global state directly
        setAppProjects={setAppProjects} // Pass setter for global state
        appTasks={appTasks}
        setAppTasks={setAppTasks}
        currentUser={currentUser}
        isLoadingParent={false} // Loading is handled by this parent component
        onDataRefreshNeeded={fetchCollaborationData}
      />
    );
  }

  // --- Default Dashboard View ---

  return (
    <div className="flex flex-col space-y-6 p-4 sm:p-6">
      <section aria-labelledby="team-section-heading">
        <h2 id="team-section-heading" className="sr-only">Teams Management</h2>
        <TeamPage
          initialTeams={allTeams}
          currentUser={currentUser}
          isLoadingParent={isLoadingPageData}
          onViewTeamDetails={handleShowTeamDetails}
          onDataRefreshNeeded={fetchCollaborationData}
          onViewTeamChat={handleViewTeamChat}
        />
      </section>

      <section aria-labelledby="projects-section-heading" className="mt-8">
        <h2 id="projects-section-heading" className="sr-only">Projects Management</h2>
        <ProjectsPage
          initialAppProjects={appProjects} // Use global state directly
          setAppProjects={setAppProjects} // Pass setter for global state
          appTasks={appTasks}
          setAppTasks={setAppTasks}
          currentUser={currentUser}
          isLoadingParent={isLoadingPageData}
          onDataRefreshNeeded={fetchCollaborationData}
          onViewProjectDetails={handleViewProjectDetails}
        />
      </section>
    </div>
  );
};