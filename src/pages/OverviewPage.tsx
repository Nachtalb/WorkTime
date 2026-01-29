import { useState, useEffect, useCallback, useMemo } from 'react';
import { useApp } from '../hooks/AppContext';
import { useLiveTick } from '../hooks/useLiveTick';
import type { Task } from '../types';
import { TimerIndicator } from '../components/TimerIndicator';
import { HelpPopup } from '../components/HelpPopup';
import { TodayOverviewPopup } from '../components/TodayOverviewPopup';
import { ImportPopup } from '../components/ImportPopup';
import { StartTimeEditorPopup } from '../components/StartTimeEditorPopup';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  formatDuration,
  getRelativeDate,
  getTooltipDate,
} from '../utils/time';
import {
  downloadFile,
  exportTodayAsTxt,
  exportTodayAsCsv,
} from '../utils/export';

export function OverviewPage() {
  const {
    projects,
    tasks,
    globalTimers,
    activeTaskId,
    globalTimerActive,
    goToLanding,
    goToProject,
    createProject,
    deleteProject,
    getOtherProject,
    getTotalDuration,
    getTodayGlobalDuration,
    getCurrentTaskDuration,
    getActiveTaskInfo,
    exportFullDb,
    importFullDb,
    updateGlobalTimerStartTime,
  } = useApp();

  const [filter, setFilter] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [showTodayOverview, setShowTodayOverview] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showStartTimeEditor, setShowStartTimeEditor] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Live tick for updating timer displays every second
  useLiveTick(globalTimerActive || activeTaskId !== null);

  // Sort projects by lastUsed (most recent first), with "Other" always available
  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => {
      // "Other" should be at the end if no filter
      if (!filter) {
        if (a.isOther) return 1;
        if (b.isOther) return -1;
      }
      return b.lastUsed - a.lastUsed;
    });
  }, [projects, filter]);

  // Filter projects based on input (matches project name as numeric ID)
  const filteredProjects = useMemo(() => {
    if (!filter) return sortedProjects;

    return sortedProjects.filter((p) => {
      // Match if project name starts with the filter
      return p.name.toLowerCase().startsWith(filter.toLowerCase());
    });
  }, [sortedProjects, filter]);

  // Get the last task for a project
  const getLastTask = (projectId: string): Task | undefined => {
    const projectTasks = tasks
      .filter((t) => t.projectId === projectId)
      .sort((a, b) => b.startTime - a.startTime);
    return projectTasks[0];
  };

  // Check if a project has the active task
  const isProjectActive = (projectId: string): boolean => {
    if (!activeTaskId) return false;
    const activeTask = tasks.find((t) => t.id === activeTaskId);
    return activeTask?.projectId === projectId;
  };

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if modals are open
      if (showHelp || showTodayOverview || showImport || showStartTimeEditor || projectToDelete) return;

      // Handle Escape
      if (e.key === 'Escape') {
        if (filter) {
          setFilter('');
          setIsCreatingNew(false);
        } else {
          e.preventDefault();
          goToLanding();
        }
        return;
      }

      // Handle Enter
      if (e.key === 'Enter') {
        e.preventDefault();
        if (isCreatingNew && filter) {
          // Create new project with the filter as name
          createProject(filter).then((newProject) => {
            setFilter('');
            setIsCreatingNew(false);
            goToProject(newProject.id);
          });
        } else if (filteredProjects.length > 0) {
          goToProject(filteredProjects[selectedIndex].id);
        }
        return;
      }

      // Handle "n" for new project
      if (e.key === 'n' && !filter) {
        e.preventDefault();
        setIsCreatingNew(true);
        return;
      }

      // Handle "o" for "Other" project
      if (e.key === 'o' && !filter) {
        e.preventDefault();
        const otherProject = getOtherProject();
        if (otherProject) {
          goToProject(otherProject.id);
        }
        return;
      }

      // Handle Delete
      if (e.key === 'Delete' && filteredProjects.length > 0) {
        const selectedProject = filteredProjects[selectedIndex];
        if (!selectedProject.isOther) {
          e.preventDefault();
          setProjectToDelete(selectedProject.id);
        }
        return;
      }

      // Handle arrow keys for navigation
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(0, prev - 1));
        return;
      }

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(filteredProjects.length - 1, prev + 1));
        return;
      }

      // Handle ? for help
      if (e.key === '?') {
        e.preventDefault();
        setShowHelp(true);
        return;
      }

      // Handle Ctrl+S for export TXT
      if (e.ctrlKey && e.key === 's' && !e.shiftKey) {
        e.preventDefault();
        const txt = exportTodayAsTxt(tasks, projects, globalTimers);
        downloadFile(txt, `worktime-today-${new Date().toISOString().split('T')[0]}.txt`, 'text/plain');
        return;
      }

      // Handle Ctrl+E for export CSV
      if (e.ctrlKey && e.key === 'e' && !e.shiftKey) {
        e.preventDefault();
        const csv = exportTodayAsCsv(tasks);
        downloadFile(csv, `worktime-today-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
        return;
      }

      // Handle Ctrl+Alt+E for full export
      if (e.ctrlKey && e.altKey && e.key === 'e') {
        e.preventDefault();
        exportFullDb();
        return;
      }

      // Handle Ctrl+Alt+I for import
      if (e.ctrlKey && e.altKey && e.key === 'i') {
        e.preventDefault();
        setShowImport(true);
        return;
      }

      // Handle Ctrl+Alt+C for changing global timer start time
      if (e.ctrlKey && e.altKey && e.key === 'c') {
        e.preventDefault();
        setShowStartTimeEditor(true);
        return;
      }

      // Handle Ctrl+O for today overview
      if (e.ctrlKey && e.key === 'o') {
        e.preventDefault();
        setShowTodayOverview(true);
        return;
      }

      // Handle number keys (0-9) for filtering
      if (/^[0-9]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setFilter((prev) => prev + e.key);
        setSelectedIndex(0);

        // Check if we should switch to "creating new" mode
        const newFilter = filter + e.key;
        const matches = sortedProjects.filter((p) =>
          p.name.toLowerCase().startsWith(newFilter.toLowerCase())
        );
        if (matches.length === 0) {
          setIsCreatingNew(true);
        }
        return;
      }

      // Handle backspace for filter
      if (e.key === 'Backspace' && filter) {
        e.preventDefault();
        setFilter((prev) => prev.slice(0, -1));
        setSelectedIndex(0);
        if (filter.length <= 1) {
          setIsCreatingNew(false);
        }
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    filter,
    filteredProjects,
    selectedIndex,
    showHelp,
    showTodayOverview,
    showImport,
    showStartTimeEditor,
    projectToDelete,
    goToLanding,
    goToProject,
    createProject,
    getOtherProject,
    tasks,
    projects,
    globalTimers,
    exportFullDb,
    isCreatingNew,
    sortedProjects,
  ]);

  // Reset selected index when filtered projects change
  useEffect(() => {
    if (selectedIndex >= filteredProjects.length) {
      setSelectedIndex(Math.max(0, filteredProjects.length - 1));
    }
  }, [filteredProjects.length, selectedIndex]);

  const handleDeleteConfirm = useCallback(() => {
    if (projectToDelete) {
      deleteProject(projectToDelete);
      setProjectToDelete(null);
    }
  }, [projectToDelete, deleteProject]);

  const projectToDeleteName = projectToDelete
    ? projects.find((p) => p.id === projectToDelete)?.name || ''
    : '';

  return (
    <div className="page overview-page">
      <div className="overview-header">
        <h1 className="overview-title">Projects</h1>
        <TimerIndicator
          globalDuration={getTodayGlobalDuration()}
          taskDuration={getCurrentTaskDuration()}
          isActive={globalTimerActive}
          activeTaskInfo={getActiveTaskInfo()}
        />
      </div>

      <div className="search-filter">
        <input
          type="text"
          className="search-input"
          placeholder={isCreatingNew ? 'New project name...' : 'Type numbers to filter or create...'}
          value={filter}
          readOnly
        />
        {isCreatingNew && filter && (
          <p style={{ marginTop: 8, color: 'var(--color-primary)', fontSize: 14 }}>
            Press Enter to create project "{filter}"
          </p>
        )}
      </div>

      <div className="projects-grid">
        {filteredProjects.map((project, index) => {
          const lastTask = getLastTask(project.id);
          const isActive = isProjectActive(project.id);
          const isSelected = index === selectedIndex;

          return (
            <div
              key={project.id}
              className={`project-card ${isSelected ? 'selected' : ''} ${isActive ? 'active' : ''}`}
              onClick={() => goToProject(project.id)}
            >
              <div className="project-card-header">
                <span className="project-card-title">
                  {project.name || 'Unnamed Project'}
                </span>
                {project.isOther && <span className="project-card-id">Special</span>}
              </div>

              <div className="project-card-task">
                {lastTask?.description || 'No tasks yet'}
              </div>

              <div className="project-card-tags">
                <span
                  className="tag"
                  data-tooltip={getTooltipDate(project.createdAt)}
                >
                  Started {getRelativeDate(project.createdAt)}
                </span>
                <span
                  className="tag"
                  data-tooltip={getTooltipDate(project.lastUsed)}
                >
                  {getRelativeDate(project.lastUsed)}
                </span>
                <span className="tag primary">
                  {formatDuration(getTotalDuration(project.id))}
                </span>
              </div>
            </div>
          );
        })}

        {filteredProjects.length === 0 && !isCreatingNew && (
          <div className="empty-state">
            <div className="empty-state-text">
              No projects yet. Press <kbd>n</kbd> to create one.
            </div>
          </div>
        )}
      </div>

      <HelpPopup isOpen={showHelp} onClose={() => setShowHelp(false)} currentPage="overview" />

      <TodayOverviewPopup
        isOpen={showTodayOverview}
        onClose={() => setShowTodayOverview(false)}
        globalTimers={globalTimers}
        tasks={tasks}
        projects={projects}
      />

      <ImportPopup
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        onImport={importFullDb}
      />

      <StartTimeEditorPopup
        isOpen={showStartTimeEditor}
        onClose={() => setShowStartTimeEditor(false)}
        globalTimers={globalTimers}
        onUpdateTimer={updateGlobalTimerStartTime}
      />

      <ConfirmDialog
        isOpen={!!projectToDelete}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setProjectToDelete(null)}
        message="Are you sure you want to delete project"
        itemName={projectToDeleteName}
      />
    </div>
  );
}
