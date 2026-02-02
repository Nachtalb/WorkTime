import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import { useApp } from '../hooks/AppContext';
import { useLiveTick } from '../hooks/useLiveTick';
import type { Task, Note, ProjectPriority } from '../types';
import { TimerIndicator } from '../components/TimerIndicator';
import { HelpPopup } from '../components/HelpPopup';
import { TodayOverviewPopup } from '../components/TodayOverviewPopup';
import { GlobalSearchPopup } from '../components/GlobalSearchPopup';
import { ImportPopup } from '../components/ImportPopup';
import { StartTimeEditorPopup } from '../components/StartTimeEditorPopup';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  formatDuration,
  formatTime,
  getRelativeDate,
  getTooltipDate,
} from '../utils/time';
import {
  downloadFile,
  exportTodayAsTxt,
  exportTodayAsCsv,
} from '../utils/export';
import { detectNoteTagType, NOTE_TAG_PATTERNS, type NoteTagType } from '../components/TextWithProjectRefs';
import { fuzzyMatch } from '../utils/search';

export function OverviewPage() {
  const {
    projects,
    tasks,
    notes,
    globalTimers,
    activeTaskId,
    globalTimerActive,
    browseMode,
    currentProjectId,
    goToLanding,
    goToProject,
    exitBrowseMode,
    createProject,
    deleteProject,
    getOtherProject,
    getTodoProject,
    getTotalDuration,
    getTodayGlobalDuration,
    getCurrentTaskDuration,
    getActiveTaskInfo,
    exportFullDb,
    importFullDb,
    updateGlobalTimerStartTime,
    updateGlobalTimerTimes,
    updateTaskTimes,
    deleteTask,
    updateProject,
  } = useApp();

  const [filter, setFilter] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [showTodayOverview, setShowTodayOverview] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showStartTimeEditor, setShowStartTimeEditor] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [sortBy, setSortBy] = useState<'lastUsed' | 'createdAt' | 'doneAt' | 'name' | 'priority'>(() => {
    const saved = localStorage.getItem('worktime-sortBy');
    return (saved as 'lastUsed' | 'createdAt' | 'doneAt' | 'name' | 'priority') || 'lastUsed';
  });
  const [sortAsc, setSortAsc] = useState(() => {
    const saved = localStorage.getItem('worktime-sortAsc');
    return saved === 'true';
  });
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [hideDone, setHideDone] = useState(() => {
    const saved = localStorage.getItem('worktime-hideDone');
    return saved === 'true';
  });
  const [errorShakeProjectId, setErrorShakeProjectId] = useState<string | null>(null);

  // Live tick for updating timer displays every second
  useLiveTick(globalTimerActive || activeTaskId !== null);

  // Persist sort and filter preferences
  useEffect(() => {
    localStorage.setItem('worktime-sortBy', sortBy);
  }, [sortBy]);

  useEffect(() => {
    localStorage.setItem('worktime-sortAsc', String(sortAsc));
  }, [sortAsc]);

  useEffect(() => {
    localStorage.setItem('worktime-hideDone', String(hideDone));
  }, [hideDone]);

  // Sort projects based on selected sort option
  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => {
      // Special projects should always be at the end (ToDo then Other)
      if (a.isOther) return 1;
      if (b.isOther) return -1;
      if (a.isTodo) return 1;
      if (b.isTodo) return -1;

      let comparison = 0;
      switch (sortBy) {
        case 'lastUsed':
          comparison = b.lastUsed - a.lastUsed;
          break;
        case 'createdAt':
          comparison = b.createdAt - a.createdAt;
          break;
        case 'doneAt':
          // Projects without doneAt go to the end when sorting by doneAt
          if (!a.doneAt && !b.doneAt) comparison = b.lastUsed - a.lastUsed;
          else if (!a.doneAt) comparison = 1;
          else if (!b.doneAt) comparison = -1;
          else comparison = b.doneAt - a.doneAt;
          break;
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'priority': {
          // Priority order: high > medium > normal > onhold > done
          const getPriorityScore = (p: typeof a) => {
            if (p.doneAt) return 0;
            if (p.onHoldAt) return 1;
            if (!p.priority || p.priority === 'normal') return 2;
            if (p.priority === 'medium') return 3;
            if (p.priority === 'high') return 4;
            return 2;
          };
          comparison = getPriorityScore(b) - getPriorityScore(a);
          // If same priority, sort by lastUsed
          if (comparison === 0) {
            comparison = b.lastUsed - a.lastUsed;
          }
          break;
        }
      }
      return sortAsc ? -comparison : comparison;
    });
  }, [projects, sortBy, sortAsc]);

  // Filter projects based on input (fuzzy matches project name, subtitle, or notes content) and hide done
  const filteredProjects = useMemo(() => {
    let result = sortedProjects;

    // Filter by name, subtitle, or notes content using fuzzy search
    if (filter) {
      result = result.filter((p) => {
        // Check project name (fuzzy)
        if (fuzzyMatch(p.name, filter)) return true;
        // Check project subtitle (fuzzy)
        if (p.subtitle && fuzzyMatch(p.subtitle, filter)) return true;
        // Check notes content (fuzzy)
        const projectNotes = notes.filter((n) => n.projectId === p.id);
        return projectNotes.some((n) => fuzzyMatch(n.content, filter));
      });
    }

    // Hide done projects if enabled
    if (hideDone) {
      result = result.filter((p) => !p.doneAt);
    }

    return result;
  }, [sortedProjects, filter, hideDone, notes]);

  // Get the last task for a project
  const getLastTask = useCallback((projectId: string): Task | undefined => {
    const projectTasks = tasks
      .filter((t) => t.projectId === projectId)
      .sort((a, b) => b.startTime - a.startTime);
    return projectTasks[0];
  }, [tasks]);

  // Get the last note for a project
  const getLastNote = useCallback((projectId: string): Note | undefined => {
    const projectNotes = notes
      .filter((n) => n.projectId === projectId)
      .sort((a, b) => b.createdAt - a.createdAt);
    return projectNotes[0];
  }, [notes]);

  // Get note tags with their content for a project
  const getProjectNoteTags = useCallback((projectId: string): Array<{ type: Exclude<NoteTagType, null>; content: string }> => {
    const projectNotes = notes.filter((n) => n.projectId === projectId);
    const tags: Array<{ type: Exclude<NoteTagType, null>; content: string }> = [];
    const seenContent = new Set<string>();
    for (const note of projectNotes) {
      const tagType = detectNoteTagType(note.content);
      if (tagType && !seenContent.has(note.content.trim())) {
        seenContent.add(note.content.trim());
        tags.push({ type: tagType, content: note.content.trim() });
      }
    }
    return tags;
  }, [notes]);

  // Cycle project priority
  const cyclePriority = useCallback((projectId: string, direction: 'up' | 'down') => {
    const project = projects.find(p => p.id === projectId);
    if (!project || project.isOther) return;

    // Don't allow priority change on done projects - show error shake
    if (project.doneAt) {
      setErrorShakeProjectId(projectId);
      setTimeout(() => setErrorShakeProjectId(null), 400);
      return;
    }

    const priorities: ProjectPriority[] = ['normal', 'medium', 'high'];
    const currentIndex = priorities.indexOf(project.priority || 'normal');
    let newIndex: number;

    if (direction === 'up') {
      newIndex = Math.min(priorities.length - 1, currentIndex + 1);
    } else {
      newIndex = Math.max(0, currentIndex - 1);
    }

    if (newIndex !== currentIndex) {
      updateProject(projectId, { priority: priorities[newIndex] });
    }
  }, [projects, updateProject]);

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
      if (showHelp || showTodayOverview || showImport || showStartTimeEditor || projectToDelete || showExitConfirm || showGlobalSearch) return;

      // Handle Ctrl+K for global search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowGlobalSearch(true);
        return;
      }

      // Check if search input is focused
      const isSearchFocused = document.activeElement === searchInputRef.current;

      // Handle Escape - clear filter/blur input or show exit confirmation
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (isSearchFocused || filter) {
          setFilter('');
          setIsCreatingNew(false);
          searchInputRef.current?.blur();
        } else {
          setShowExitConfirm(true);
        }
        return;
      }

      // Handle Enter (skip if input is focused - input's onKeyDown handles it)
      if (e.key === 'Enter') {
        if (isSearchFocused) {
          return;
        }
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

      // Handle arrow keys for navigation (grid-aware) - works even when search focused
      // Calculate columns in grid
      const getColumnsCount = () => {
        if (!gridRef.current || filteredProjects.length === 0) return 1;
        const gridStyle = window.getComputedStyle(gridRef.current);
        const columns = gridStyle.getPropertyValue('grid-template-columns').split(' ').length;
        return columns || 1;
      };

      // Handle Ctrl+Up/Down for project priority
      if (e.ctrlKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && filteredProjects.length > 0) {
        e.preventDefault();
        const selectedProject = filteredProjects[selectedIndex];
        cyclePriority(selectedProject.id, e.key === 'ArrowUp' ? 'up' : 'down');
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const cols = getColumnsCount();
        setSelectedIndex((prev) => Math.max(0, prev - cols));
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const cols = getColumnsCount();
        setSelectedIndex((prev) => Math.min(filteredProjects.length - 1, prev + cols));
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(0, prev - 1));
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(filteredProjects.length - 1, prev + 1));
        return;
      }

      // Handle Tab/Shift+Tab for cycling through projects
      if (e.key === 'Tab' && filteredProjects.length > 0) {
        e.preventDefault();
        if (e.shiftKey) {
          setSelectedIndex((prev) => (prev <= 0 ? filteredProjects.length - 1 : prev - 1));
        } else {
          setSelectedIndex((prev) => (prev >= filteredProjects.length - 1 ? 0 : prev + 1));
        }
        return;
      }

      // Skip letter shortcuts if search input is focused (let user type)
      if (isSearchFocused) return;

      // Handle "n" for new project
      if (e.key === 'n' && !filter) {
        e.preventDefault();
        setIsCreatingNew(true);
        return;
      }

      // Handle "o" for "Other" project
      if (e.key === 'o' && !filter && !e.ctrlKey) {
        e.preventDefault();
        const otherProject = getOtherProject();
        if (otherProject) {
          goToProject(otherProject.id);
        }
        return;
      }

      // Handle "t" for "ToDo" project
      if (e.key === 't' && !filter && !e.ctrlKey) {
        e.preventDefault();
        const todoProject = getTodoProject();
        if (todoProject) {
          goToProject(todoProject.id);
        }
        return;
      }

      // Handle "h" to toggle hiding done projects
      if (e.key === 'h' && !filter) {
        e.preventDefault();
        setHideDone((prev) => !prev);
        return;
      }

      // Handle "/" or "f" to focus search
      if ((e.key === '/' || e.key === 'f') && !filter && !e.ctrlKey) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // Handle "s" to cycle sort options
      if (e.key === 's' && !filter && !e.ctrlKey) {
        e.preventDefault();
        const sortOptions: Array<'lastUsed' | 'createdAt' | 'doneAt' | 'name' | 'priority'> = ['lastUsed', 'createdAt', 'doneAt', 'name', 'priority'];
        const currentIndex = sortOptions.indexOf(sortBy);
        const nextIndex = (currentIndex + 1) % sortOptions.length;
        setSortBy(sortOptions[nextIndex]);
        return;
      }

      // Handle "a" to toggle sort direction
      if (e.key === 'a' && !filter && !e.ctrlKey) {
        e.preventDefault();
        setSortAsc((prev) => !prev);
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

      // Handle ? for help
      if (e.key === '?') {
        e.preventDefault();
        setShowHelp(true);
        return;
      }

      // Handle Ctrl+S for export TXT
      if (e.ctrlKey && e.key === 's' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        const txt = exportTodayAsTxt(tasks, projects, globalTimers, notes);
        downloadFile(txt, `worktime-today-${new Date().toISOString().split('T')[0]}.txt`, 'text/plain');
        return;
      }

      // Handle Ctrl+E for export CSV
      if (e.ctrlKey && e.key === 'e' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        const csv = exportTodayAsCsv(tasks, notes);
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
      if (e.ctrlKey && e.key === 'o' && !e.altKey) {
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
          p.name.toLowerCase().includes(newFilter.toLowerCase())
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
    showExitConfirm,
    showGlobalSearch,
    goToLanding,
    goToProject,
    createProject,
    getOtherProject,
    getTodoProject,
    tasks,
    notes,
    projects,
    globalTimers,
    exportFullDb,
    isCreatingNew,
    sortedProjects,
    cyclePriority,
    getLastTask,
    sortBy,
  ]);

  // Reset selected index when filtered projects change
  useEffect(() => {
    if (selectedIndex >= filteredProjects.length) {
      setSelectedIndex(Math.max(0, filteredProjects.length - 1));
    }
  }, [filteredProjects.length, selectedIndex]);

  // Select the previously viewed project when returning from project page
  // Use useLayoutEffect to update selection before browser paints (prevents flash)
  const hasSelectedInitial = useRef(false);
  useLayoutEffect(() => {
    if (!hasSelectedInitial.current && currentProjectId && filteredProjects.length > 0) {
      const projectIndex = filteredProjects.findIndex(p => p.id === currentProjectId);
      if (projectIndex !== -1) {
        setSelectedIndex(projectIndex);
        hasSelectedInitial.current = true;
      }
    }
  }, [currentProjectId, filteredProjects]);

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
      {browseMode && (
        <div className="browse-mode-banner">
          <span>Browse Mode - Tasks disabled</span>
          <button className="start-work-btn" onClick={exitBrowseMode}>
            Start Working
          </button>
        </div>
      )}
      <div className="overview-header">
        <div className="overview-title-section">
          <button className="back-button" onClick={() => setShowExitConfirm(true)} title="Back to Landing (Esc)">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <h1 className="overview-title">Projects</h1>
        </div>
        <TimerIndicator
          globalDuration={getTodayGlobalDuration()}
          taskDuration={getCurrentTaskDuration()}
          isActive={globalTimerActive}
          activeTaskInfo={getActiveTaskInfo()}
          onProjectClick={goToProject}
        />
      </div>

      <div className="search-sort-row">
        <div className="search-filter">
          <input
            ref={searchInputRef}
            type="text"
            className="search-input"
            placeholder="Type to filter or create project..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                // If there are filtered projects, open the selected one
                if (filteredProjects.length > 0 && !isCreatingNew) {
                  setFilter('');
                  goToProject(filteredProjects[selectedIndex].id);
                } else if (filter.trim()) {
                  // No matches or explicitly creating - create new project
                  createProject(filter.trim()).then((newProject) => {
                    setFilter('');
                    setIsCreatingNew(false);
                    goToProject(newProject.id);
                  });
                }
              } else if (e.key === 'Escape') {
                setFilter('');
                setIsCreatingNew(false);
                searchInputRef.current?.blur();
              }
            }}
          />
          {filter && filteredProjects.length === 0 && (
            <p style={{ marginTop: 8, color: 'var(--color-primary)', fontSize: 14 }}>
              Press Enter to create project "{filter}"
            </p>
          )}
        </div>

        <div className={`sort-controls ${isSearchFocused || filter ? 'hidden' : ''}`}>
          <select
            className="sort-dropdown"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          >
            <option value="lastUsed">Last Used</option>
            <option value="createdAt">Created</option>
            <option value="doneAt">Done Date</option>
            <option value="name">Name</option>
            <option value="priority">Priority</option>
          </select>
          <button
            className="sort-direction-btn"
            onClick={() => setSortAsc(!sortAsc)}
            title={sortAsc ? 'Ascending' : 'Descending'}
          >
            {sortAsc ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19V5M5 12l7-7 7 7"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12l7 7 7-7"/>
              </svg>
            )}
          </button>
          <button
            className={`hide-done-btn ${hideDone ? 'active' : ''}`}
            onClick={() => setHideDone(!hideDone)}
            title={hideDone ? 'Show done projects (h)' : 'Hide done projects (h)'}
          >
            {hideDone ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile floating sort controls */}
      <div className={`sort-controls-mobile ${isSearchFocused || filter ? 'hidden' : ''}`}>
        <select
          className="sort-dropdown"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
        >
          <option value="lastUsed">Last Used</option>
          <option value="createdAt">Created</option>
          <option value="doneAt">Done Date</option>
          <option value="name">Name</option>
        </select>
        <button
          className="sort-direction-btn"
          onClick={() => setSortAsc(!sortAsc)}
          title={sortAsc ? 'Ascending' : 'Descending'}
        >
          {sortAsc ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5M5 12l7-7 7 7"/>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12l7 7 7-7"/>
            </svg>
          )}
        </button>
        <button
          className={`hide-done-btn ${hideDone ? 'active' : ''}`}
          onClick={() => setHideDone(!hideDone)}
          title={hideDone ? 'Show done projects' : 'Hide done projects'}
        >
          {hideDone ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
              <line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          )}
        </button>
      </div>

      <div className="projects-grid" ref={gridRef}>
        {filteredProjects.map((project, index) => {
          const lastTask = getLastTask(project.id);
          const lastNote = getLastNote(project.id);
          const isActive = isProjectActive(project.id);
          const isSelected = index === selectedIndex;
          const noteTags = getProjectNoteTags(project.id);

          return (
            <div
              key={project.id}
              className={`project-card ${isSelected ? 'selected' : ''} ${isActive ? 'active' : ''} ${project.doneAt ? 'done' : ''} ${project.onHoldAt ? 'on-hold' : ''} ${errorShakeProjectId === project.id ? 'error-shake' : ''}`}
              onClick={() => goToProject(project.id)}
            >
              <div className="project-card-header">
                <span className="project-card-title">
                  {project.priority === 'high' && <span className="priority-indicator">‼️</span>}
                  {project.priority === 'medium' && <span className="priority-indicator">❗</span>}
                  {project.name || 'Unnamed Project'}
                </span>
                {project.isOther && <span className="project-card-id">Special</span>}
                {project.isTodo && <span className="project-card-id todo">ToDo</span>}
                {project.doneAt && <span className="project-card-id done" title={`Done on ${getTooltipDate(project.doneAt)} at ${formatTime(project.doneAt)}`}>Done</span>}
                {project.onHoldAt && !project.doneAt && <span className="project-card-id on-hold" title={`On hold since ${getTooltipDate(project.onHoldAt)} at ${formatTime(project.onHoldAt)}`}>On Hold</span>}
              </div>

              {project.subtitle && (
                <div className="project-card-subtitle">{project.subtitle}</div>
              )}

              {(lastTask || lastNote) && (
                <div className="project-card-activity">
                  {lastTask && (
                    <div className="project-card-task">
                      <span className="activity-icon task-icon">T</span>
                      <span className="activity-text">{lastTask.description}</span>
                    </div>
                  )}
                  {lastNote && (
                    <div className="project-card-note">
                      <span className="activity-icon note-icon">N</span>
                      <span className="activity-text">{lastNote.content}</span>
                    </div>
                  )}
                </div>
              )}

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
                {noteTags.map((tag) => (
                  <span key={tag.content} className={`tag tag-${tag.type}`} data-tooltip={NOTE_TAG_PATTERNS[tag.type].label}>
                    {tag.content}
                  </span>
                ))}
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
        activeTaskId={activeTaskId}
        onUpdateTimerTimes={updateGlobalTimerTimes}
        onUpdateTaskTimes={updateTaskTimes}
        onDeleteTask={deleteTask}
        onProjectClick={goToProject}
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

      <ConfirmDialog
        isOpen={showExitConfirm}
        onConfirm={() => {
          setShowExitConfirm(false);
          goToLanding();
        }}
        onCancel={() => setShowExitConfirm(false)}
        message="Are you sure you want to go back to the landing page?"
        confirmText="Go Back"
      />

      <GlobalSearchPopup
        isOpen={showGlobalSearch}
        onClose={() => setShowGlobalSearch(false)}
        projects={projects}
        notes={notes}
        onSelectProject={(projectId) => {
          setShowGlobalSearch(false);
          goToProject(projectId);
        }}
        currentProjectId={currentProjectId}
      />
    </div>
  );
}
