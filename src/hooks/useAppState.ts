import { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Task, Project, GlobalTimer, AppState, Page, UndoAction, Note } from '../types';
import * as db from '../services/database';
import { getTodayDateString, isTimestampToday } from '../utils/time';

export interface UseAppStateReturn {
  // State
  projects: Project[];
  tasks: Task[];
  notes: Note[];
  globalTimers: GlobalTimer[];
  currentPage: Page;
  currentProjectId: string | null;
  activeTaskId: string | null;
  globalTimerActive: boolean;
  isLoading: boolean;

  // Navigation
  goToLanding: () => void;
  goToOverview: () => void;
  goToProject: (projectId: string) => void;

  // Global timer
  startGlobalTimer: () => Promise<void>;
  stopGlobalTimer: () => Promise<void>;
  updateGlobalTimerStartTime: (timerId: string, newStartTime: number) => Promise<void>;

  // Projects
  createProject: (name: string) => Promise<Project>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  getProjectById: (id: string) => Project | undefined;
  getOtherProject: () => Project | undefined;
  getTodoProject: () => Project | undefined;
  markProjectDone: (id: string) => Promise<void>;
  reopenProject: (id: string) => Promise<void>;
  toggleProjectOnHold: (id: string) => Promise<void>;

  // Tasks
  createTask: (projectId: string, description: string) => Promise<Task>;
  startTask: (taskId: string) => Promise<void>;
  stopActiveTask: () => Promise<void>;
  updateTask: (taskId: string, updates: Partial<Task>, skipLastUsed?: boolean) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  getTasksByProject: (projectId: string) => Task[];
  getActiveTask: () => Task | undefined;

  // Notes
  createNote: (projectId: string, content: string) => Promise<Note>;
  updateNote: (noteId: string, updates: Partial<Note>) => Promise<void>;
  deleteNote: (noteId: string) => Promise<void>;
  getNotesByProject: (projectId: string) => Note[];
  toggleNoteCompleted: (noteId: string) => Promise<void>;

  // Undo
  undo: () => Promise<void>;
  canUndo: boolean;

  // Export/Import
  exportFullDb: () => Promise<void>;
  importFullDb: (file: File) => Promise<void>;

  // Helpers
  getTodayDuration: (projectId?: string) => number;
  getTotalDuration: (projectId: string) => number;
  getTodayGlobalDuration: () => number;
  getCurrentTaskDuration: () => number;
  getTodayGlobalTimers: () => GlobalTimer[];
  getActiveTaskInfo: () => { projectName: string; taskDescription: string } | null;
}

export function useAppState(): UseAppStateReturn {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [globalTimers, setGlobalTimers] = useState<GlobalTimer[]>([]);
  const [currentPage, setCurrentPageState] = useState<Page>('landing');
  const [currentProjectId, setCurrentProjectIdState] = useState<string | null>(null);
  const [activeTaskId, setActiveTaskIdState] = useState<string | null>(null);
  const [globalTimerActive, setGlobalTimerActiveState] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);

  const initialized = useRef(false);

  // Refs to track latest state values for saveState (avoids stale closure issues)
  const currentPageRef = useRef<Page>('landing');
  const currentProjectIdRef = useRef<string | null>(null);
  const activeTaskIdRef = useRef<string | null>(null);
  const globalTimerActiveRef = useRef(false);

  // Wrapper setters that update both state and ref synchronously
  const setCurrentPage = useCallback((page: Page) => {
    currentPageRef.current = page;
    setCurrentPageState(page);
  }, []);

  const setCurrentProjectId = useCallback((id: string | null) => {
    currentProjectIdRef.current = id;
    setCurrentProjectIdState(id);
  }, []);

  const setActiveTaskId = useCallback((id: string | null) => {
    activeTaskIdRef.current = id;
    setActiveTaskIdState(id);
  }, []);

  const setGlobalTimerActive = useCallback((active: boolean) => {
    globalTimerActiveRef.current = active;
    setGlobalTimerActiveState(active);
  }, []);

  // Parse URL to determine initial page
  const parseUrlPath = useCallback((): { page: Page; projectId: string | null } => {
    const path = window.location.pathname;
    if (path.startsWith('/project/')) {
      const projectId = path.substring('/project/'.length);
      return { page: 'project', projectId };
    } else if (path === '/overview' || path === '/overview/') {
      return { page: 'overview', projectId: null };
    }
    return { page: 'landing', projectId: null };
  }, []);

  // Update URL without triggering navigation
  const updateUrl = useCallback((page: Page, projectId?: string | null) => {
    let path = '/';
    if (page === 'overview') {
      path = '/overview';
    } else if (page === 'project' && projectId) {
      path = `/project/${projectId}`;
    }
    window.history.pushState({ page, projectId }, '', path);
  }, []);

  // Replace URL (for initial load, doesn't create history entry)
  const replaceUrl = useCallback((page: Page, projectId?: string | null) => {
    let path = '/';
    if (page === 'overview') {
      path = '/overview';
    } else if (page === 'project' && projectId) {
      path = `/project/${projectId}`;
    }
    window.history.replaceState({ page, projectId }, '', path);
  }, []);

  // Load initial state
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    async function init() {
      try {
        // Ensure special projects exist
        await db.ensureOtherProject();
        await db.ensureTodoProject();

        // Load all data
        const [loadedProjects, loadedTasks, loadedNotes, loadedTimers, savedState] = await Promise.all([
          db.getAllProjects(),
          db.getAllTasks(),
          db.getAllNotes(),
          db.getAllGlobalTimers(),
          db.getAppState(),
        ]);

        setProjects(loadedProjects);
        setTasks(loadedTasks);
        setNotes(loadedNotes);
        setGlobalTimers(loadedTimers);

        // Check URL first, then fall back to saved state
        const urlState = parseUrlPath();

        if (urlState.page !== 'landing') {
          // URL has a specific path, use it
          setCurrentPage(urlState.page);
          setCurrentProjectId(urlState.projectId);
          if (savedState) {
            setActiveTaskId(savedState.activeTaskId);
            setGlobalTimerActive(savedState.globalTimerActive);
          }
          // Replace URL to set proper state
          replaceUrl(urlState.page, urlState.projectId);
        } else if (savedState) {
          // No URL path, use saved state
          setCurrentPage(savedState.currentPage);
          setCurrentProjectId(savedState.currentProjectId);
          setActiveTaskId(savedState.activeTaskId);
          setGlobalTimerActive(savedState.globalTimerActive);
          // Update URL to match saved state
          replaceUrl(savedState.currentPage, savedState.currentProjectId);
        }

        setIsLoading(false);
      } catch (error) {
        console.error('Failed to initialize app state:', error);
        setIsLoading(false);
      }
    }

    init();
  }, [parseUrlPath, replaceUrl]);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state as { page: Page; projectId: string | null } | null;
      if (state) {
        setCurrentPage(state.page);
        setCurrentProjectId(state.projectId);
      } else {
        // No state, parse from URL
        const urlState = parseUrlPath();
        setCurrentPage(urlState.page);
        setCurrentProjectId(urlState.projectId);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [parseUrlPath]);

  // Save app state - uses refs to always get latest values (avoids stale closure issues)
  const saveState = useCallback(async (state: Partial<AppState>) => {
    const fullState: AppState = {
      currentPage: state.currentPage ?? currentPageRef.current,
      currentProjectId: state.currentProjectId ?? currentProjectIdRef.current,
      activeTaskId: state.activeTaskId ?? activeTaskIdRef.current,
      globalTimerActive: state.globalTimerActive ?? globalTimerActiveRef.current,
    };
    await db.saveAppState(fullState);
  }, []);

  // Navigation
  const goToLanding = useCallback(async () => {
    // Stop global timer
    const today = getTodayDateString();
    const todayTimers = globalTimers.filter(t => t.date === today && !t.endTime);
    for (const timer of todayTimers) {
      const updatedTimer = { ...timer, endTime: Date.now() };
      await db.saveGlobalTimer(updatedTimer);
      setGlobalTimers(prev => prev.map(t => t.id === timer.id ? updatedTimer : t));
    }

    // Stop active task
    if (activeTaskId) {
      const task = tasks.find(t => t.id === activeTaskId);
      if (task && !task.endTime) {
        const endTime = Date.now();
        const updatedTask = {
          ...task,
          endTime,
          duration: endTime - task.startTime,
        };
        await db.saveTask(updatedTask);
        setTasks(prev => prev.map(t => t.id === task.id ? updatedTask : t));
      }
    }

    setCurrentPage('landing');
    setCurrentProjectId(null);
    setActiveTaskId(null);
    setGlobalTimerActive(false);
    updateUrl('landing', null);
    await saveState({
      currentPage: 'landing',
      currentProjectId: null,
      activeTaskId: null,
      globalTimerActive: false,
    });
  }, [globalTimers, activeTaskId, tasks, saveState, updateUrl]);

  const goToOverview = useCallback(async () => {
    // Keep currentProjectId so overview can select the last viewed project
    setCurrentPage('overview');
    updateUrl('overview', null);
    await saveState({ currentPage: 'overview' });
  }, [saveState, updateUrl]);

  const goToProject = useCallback(async (projectId: string) => {
    setCurrentPage('project');
    setCurrentProjectId(projectId);
    updateUrl('project', projectId);
    await saveState({ currentPage: 'project', currentProjectId: projectId });
  }, [saveState, updateUrl]);

  // Global timer
  const startGlobalTimer = useCallback(async () => {
    const today = getTodayDateString();
    const newTimer: GlobalTimer = {
      id: uuidv4(),
      date: today,
      startTime: Date.now(),
    };
    await db.saveGlobalTimer(newTimer);
    setGlobalTimers(prev => [...prev, newTimer]);
    setGlobalTimerActive(true);
    await saveState({ globalTimerActive: true });
  }, [saveState]);

  const stopGlobalTimer = useCallback(async () => {
    const today = getTodayDateString();
    const todayTimers = globalTimers.filter(t => t.date === today && !t.endTime);
    for (const timer of todayTimers) {
      const updatedTimer = { ...timer, endTime: Date.now() };
      await db.saveGlobalTimer(updatedTimer);
      setGlobalTimers(prev => prev.map(t => t.id === timer.id ? updatedTimer : t));
    }
    setGlobalTimerActive(false);
    await saveState({ globalTimerActive: false });
  }, [globalTimers, saveState]);

  const updateGlobalTimerStartTime = useCallback(async (timerId: string, newStartTime: number) => {
    const timer = globalTimers.find(t => t.id === timerId);
    if (timer) {
      const updatedTimer = { ...timer, startTime: newStartTime };
      await db.saveGlobalTimer(updatedTimer);
      setGlobalTimers(prev => prev.map(t => t.id === timerId ? updatedTimer : t));
    }
  }, [globalTimers]);

  // Projects
  const createProject = useCallback(async (name: string): Promise<Project> => {
    const newProject: Project = {
      id: uuidv4(),
      name,
      createdAt: Date.now(),
      lastUsed: Date.now(),
    };
    await db.saveProject(newProject);
    setProjects(prev => [...prev, newProject]);
    return newProject;
  }, []);

  const updateProject = useCallback(async (id: string, updates: Partial<Project>) => {
    const project = projects.find(p => p.id === id);
    if (project) {
      const updatedProject = { ...project, ...updates };
      await db.saveProject(updatedProject);
      setProjects(prev => prev.map(p => p.id === id ? updatedProject : p));
    }
  }, [projects]);

  const deleteProject = useCallback(async (id: string) => {
    const project = projects.find(p => p.id === id);
    if (project?.isOther) return; // Can't delete "Other" project

    await db.deleteProject(id);
    setProjects(prev => prev.filter(p => p.id !== id));
    setTasks(prev => prev.filter(t => t.projectId !== id));
    setNotes(prev => prev.filter(n => n.projectId !== id));

    if (currentProjectId === id) {
      setCurrentProjectId(null);
      setCurrentPage('overview');
    }
  }, [projects, currentProjectId]);

  const getProjectById = useCallback((id: string) => {
    return projects.find(p => p.id === id);
  }, [projects]);

  const getOtherProject = useCallback(() => {
    return projects.find(p => p.isOther);
  }, [projects]);

  const getTodoProject = useCallback(() => {
    return projects.find(p => p.isTodo);
  }, [projects]);

  const markProjectDone = useCallback(async (id: string) => {
    const project = projects.find(p => p.id === id);
    if (project?.isOther || project?.isTodo) return; // Can't mark special projects as done

    const updatedProject = { ...project!, doneAt: Date.now() };
    await db.saveProject(updatedProject);
    setProjects(prev => prev.map(p => p.id === id ? updatedProject : p));
  }, [projects]);

  const reopenProject = useCallback(async (id: string) => {
    const project = projects.find(p => p.id === id);
    if (!project) return;

    const { doneAt, ...projectWithoutDone } = project;
    await db.saveProject(projectWithoutDone as Project);
    setProjects(prev => prev.map(p => p.id === id ? projectWithoutDone as Project : p));
  }, [projects]);

  const toggleProjectOnHold = useCallback(async (id: string) => {
    const project = projects.find(p => p.id === id);
    if (!project || project.isOther || project.isTodo) return; // Can't toggle special projects

    let updatedProject: Project;
    if (project.onHoldAt) {
      // Remove on hold status
      const { onHoldAt, ...projectWithoutOnHold } = project;
      updatedProject = projectWithoutOnHold as Project;
    } else {
      // Set on hold
      updatedProject = { ...project, onHoldAt: Date.now() };
    }
    await db.saveProject(updatedProject);
    setProjects(prev => prev.map(p => p.id === id ? updatedProject : p));
  }, [projects]);

  // Tasks
  const createTask = useCallback(async (projectId: string, description: string): Promise<Task> => {
    // Stop current active task first
    if (activeTaskId) {
      const currentTask = tasks.find(t => t.id === activeTaskId);
      if (currentTask && !currentTask.endTime) {
        const endTime = Date.now();
        const updatedTask = {
          ...currentTask,
          endTime,
          duration: endTime - currentTask.startTime,
        };
        await db.saveTask(updatedTask);
        setTasks(prev => prev.map(t => t.id === activeTaskId ? updatedTask : t));
      }
    }

    const newTask: Task = {
      id: uuidv4(),
      projectId,
      description,
      startTime: Date.now(),
    };
    await db.saveTask(newTask);
    setTasks(prev => [...prev, newTask]);

    // Set the new task as active immediately
    setActiveTaskId(newTask.id);
    await saveState({ activeTaskId: newTask.id });

    // Update project lastUsed
    const project = projects.find(p => p.id === projectId);
    if (project) {
      const updatedProject = { ...project, lastUsed: Date.now() };
      await db.saveProject(updatedProject);
      setProjects(prev => prev.map(p => p.id === projectId ? updatedProject : p));
    }

    return newTask;
  }, [activeTaskId, tasks, projects, saveState]);

  const startTask = useCallback(async (taskId: string) => {
    // Stop current active task first
    if (activeTaskId && activeTaskId !== taskId) {
      const currentTask = tasks.find(t => t.id === activeTaskId);
      if (currentTask && !currentTask.endTime) {
        const endTime = Date.now();
        const updatedTask = {
          ...currentTask,
          endTime,
          duration: endTime - currentTask.startTime,
        };
        await db.saveTask(updatedTask);
        setTasks(prev => prev.map(t => t.id === activeTaskId ? updatedTask : t));
      }
    }

    // Start the new task
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      // If task is already completed, create a new entry instead
      if (task.endTime) {
        const newTask: Task = {
          id: uuidv4(),
          projectId: task.projectId,
          description: task.description,
          startTime: Date.now(),
        };
        await db.saveTask(newTask);
        setTasks(prev => [...prev, newTask]);
        setActiveTaskId(newTask.id);
        await saveState({ activeTaskId: newTask.id });
      } else {
        setActiveTaskId(taskId);
        await saveState({ activeTaskId: taskId });
      }

      // Update project lastUsed
      const project = projects.find(p => p.id === task.projectId);
      if (project) {
        const updatedProject = { ...project, lastUsed: Date.now() };
        await db.saveProject(updatedProject);
        setProjects(prev => prev.map(p => p.id === task.projectId ? updatedProject : p));
      }
    }
  }, [activeTaskId, tasks, projects, saveState]);

  const stopActiveTask = useCallback(async () => {
    if (activeTaskId) {
      const task = tasks.find(t => t.id === activeTaskId);
      if (task && !task.endTime) {
        const endTime = Date.now();
        const updatedTask = {
          ...task,
          endTime,
          duration: endTime - task.startTime,
        };
        await db.saveTask(updatedTask);
        setTasks(prev => prev.map(t => t.id === activeTaskId ? updatedTask : t));
      }
    }
    setActiveTaskId(null);
    await saveState({ activeTaskId: null });
  }, [activeTaskId, tasks, saveState]);

  const updateTask = useCallback(async (taskId: string, updates: Partial<Task>, skipLastUsed?: boolean) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      const updatedTask = { ...task, ...updates };
      await db.saveTask(updatedTask);
      setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));

      // Update project lastUsed (unless explicitly skipped, e.g. for priority changes)
      if (!skipLastUsed) {
        const project = projects.find(p => p.id === task.projectId);
        if (project) {
          const updatedProject = { ...project, lastUsed: Date.now() };
          await db.saveProject(updatedProject);
          setProjects(prev => prev.map(p => p.id === task.projectId ? updatedProject : p));
        }
      }
    }
  }, [tasks, projects]);

  const deleteTask = useCallback(async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    // Save to undo stack
    setUndoStack(prev => [...prev, {
      type: 'task_delete',
      task,
      previousActiveTaskId: activeTaskId === taskId ? activeTaskId : null,
    }]);

    await db.deleteTask(taskId);
    setTasks(prev => prev.filter(t => t.id !== taskId));

    // If this was the active task, restart the previous one
    if (activeTaskId === taskId) {
      const projectTasks = tasks
        .filter(t => t.projectId === task.projectId && t.id !== taskId)
        .sort((a, b) => b.startTime - a.startTime);

      if (projectTasks.length > 0) {
        const prevTask = projectTasks[0];
        // Restart the previous task
        const updatedTask = {
          ...prevTask,
          endTime: undefined,
          duration: undefined,
        };
        await db.saveTask(updatedTask);
        setTasks(prev => prev.map(t => t.id === prevTask.id ? updatedTask : t));
        setActiveTaskId(prevTask.id);
        await saveState({ activeTaskId: prevTask.id });
      } else {
        setActiveTaskId(null);
        await saveState({ activeTaskId: null });
      }
    }
  }, [tasks, activeTaskId, saveState]);

  const getTasksByProject = useCallback((projectId: string) => {
    return tasks.filter(t => t.projectId === projectId);
  }, [tasks]);

  const getActiveTask = useCallback(() => {
    return tasks.find(t => t.id === activeTaskId);
  }, [tasks, activeTaskId]);

  // Notes
  const createNote = useCallback(async (projectId: string, content: string): Promise<Note> => {
    const newNote: Note = {
      id: uuidv4(),
      projectId,
      content,
      createdAt: Date.now(),
    };
    await db.saveNote(newNote);
    setNotes(prev => [...prev, newNote]);

    // Update project lastUsed
    const project = projects.find(p => p.id === projectId);
    if (project) {
      const updatedProject = { ...project, lastUsed: Date.now() };
      await db.saveProject(updatedProject);
      setProjects(prev => prev.map(p => p.id === projectId ? updatedProject : p));
    }

    return newNote;
  }, [projects]);

  const updateNote = useCallback(async (noteId: string, updates: Partial<Note>) => {
    const note = notes.find(n => n.id === noteId);
    if (note) {
      const updatedNote = { ...note, ...updates };
      await db.saveNote(updatedNote);
      setNotes(prev => prev.map(n => n.id === noteId ? updatedNote : n));

      // Update project lastUsed
      const project = projects.find(p => p.id === note.projectId);
      if (project) {
        const updatedProject = { ...project, lastUsed: Date.now() };
        await db.saveProject(updatedProject);
        setProjects(prev => prev.map(p => p.id === note.projectId ? updatedProject : p));
      }
    }
  }, [notes, projects]);

  const deleteNote = useCallback(async (noteId: string) => {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;

    // Save to undo stack
    setUndoStack(prev => [...prev, {
      type: 'note_delete',
      note,
      previousActiveTaskId: null,
    }]);

    await db.deleteNote(noteId);
    setNotes(prev => prev.filter(n => n.id !== noteId));
  }, [notes]);

  const getNotesByProject = useCallback((projectId: string) => {
    return notes.filter(n => n.projectId === projectId);
  }, [notes]);

  const toggleNoteCompleted = useCallback(async (noteId: string) => {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;

    const updatedNote = { ...note, completed: !note.completed };
    await db.saveNote(updatedNote);
    setNotes(prev => prev.map(n => n.id === noteId ? updatedNote : n));
  }, [notes]);

  // Undo
  const undo = useCallback(async () => {
    const action = undoStack[undoStack.length - 1];
    if (!action) return;

    if (action.type === 'task_delete' && action.task) {
      // Restore the task
      await db.saveTask(action.task);
      setTasks(prev => [...prev, action.task!]);

      if (action.previousActiveTaskId) {
        setActiveTaskId(action.previousActiveTaskId);
        await saveState({ activeTaskId: action.previousActiveTaskId });
      }
    } else if (action.type === 'note_delete' && action.note) {
      // Restore the note
      await db.saveNote(action.note);
      setNotes(prev => [...prev, action.note!]);
    }

    setUndoStack(prev => prev.slice(0, -1));
  }, [undoStack, saveState]);

  // Export/Import
  const exportFullDb = useCallback(async () => {
    const data = await db.exportFullDatabase();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `worktime-backup-${getTodayDateString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const importFullDb = useCallback(async (file: File) => {
    const text = await file.text();
    const data = JSON.parse(text);
    await db.importFullDatabase(data);

    // Reload all data
    const [loadedProjects, loadedTasks, loadedNotes, loadedTimers] = await Promise.all([
      db.getAllProjects(),
      db.getAllTasks(),
      db.getAllNotes(),
      db.getAllGlobalTimers(),
    ]);

    setProjects(loadedProjects);
    setTasks(loadedTasks);
    setNotes(loadedNotes);
    setGlobalTimers(loadedTimers);
    setCurrentPage('landing');
    setCurrentProjectId(null);
    setActiveTaskId(null);
    setGlobalTimerActive(false);
  }, []);

  // Helpers
  const getTodayDuration = useCallback((projectId?: string) => {
    const todayTasks = tasks.filter(t =>
      isTimestampToday(t.startTime) &&
      (!projectId || t.projectId === projectId)
    );

    return todayTasks.reduce((total, task) => {
      const duration = task.duration || (task.endTime ? task.endTime - task.startTime : Date.now() - task.startTime);
      return total + duration;
    }, 0);
  }, [tasks]);

  const getTotalDuration = useCallback((projectId: string) => {
    const projectTasks = tasks.filter(t => t.projectId === projectId);

    return projectTasks.reduce((total, task) => {
      const duration = task.duration || (task.endTime ? task.endTime - task.startTime : Date.now() - task.startTime);
      return total + duration;
    }, 0);
  }, [tasks]);

  const getTodayGlobalDuration = useCallback(() => {
    const today = getTodayDateString();
    const todayTimers = globalTimers.filter(t => t.date === today);

    return todayTimers.reduce((total, timer) => {
      const endTime = timer.endTime || Date.now();
      return total + (endTime - timer.startTime);
    }, 0);
  }, [globalTimers]);

  const getCurrentTaskDuration = useCallback(() => {
    const activeTask = tasks.find(t => t.id === activeTaskId);
    if (!activeTask || activeTask.endTime) return 0;
    return Date.now() - activeTask.startTime;
  }, [tasks, activeTaskId]);

  const getTodayGlobalTimers = useCallback(() => {
    const today = getTodayDateString();
    return globalTimers.filter(t => t.date === today);
  }, [globalTimers]);

  const getActiveTaskInfo = useCallback(() => {
    if (!activeTaskId) return null;
    const activeTask = tasks.find(t => t.id === activeTaskId);
    if (!activeTask) return null;
    const project = projects.find(p => p.id === activeTask.projectId);
    return {
      projectName: project?.name || 'Unknown',
      taskDescription: activeTask.description,
    };
  }, [activeTaskId, tasks, projects]);

  return {
    projects,
    tasks,
    notes,
    globalTimers,
    currentPage,
    currentProjectId,
    activeTaskId,
    globalTimerActive,
    isLoading,
    goToLanding,
    goToOverview,
    goToProject,
    startGlobalTimer,
    stopGlobalTimer,
    updateGlobalTimerStartTime,
    createProject,
    updateProject,
    deleteProject,
    getProjectById,
    getOtherProject,
    getTodoProject,
    markProjectDone,
    reopenProject,
    toggleProjectOnHold,
    createTask,
    startTask,
    stopActiveTask,
    updateTask,
    deleteTask,
    getTasksByProject,
    getActiveTask,
    createNote,
    updateNote,
    deleteNote,
    getNotesByProject,
    toggleNoteCompleted,
    undo,
    canUndo: undoStack.length > 0,
    exportFullDb,
    importFullDb,
    getTodayDuration,
    getTotalDuration,
    getTodayGlobalDuration,
    getCurrentTaskDuration,
    getTodayGlobalTimers,
    getActiveTaskInfo,
  };
}
