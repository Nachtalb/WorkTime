import { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Task, Project, GlobalTimer, AppState, Page, UndoAction } from '../types';
import * as db from '../services/database';
import { getTodayDateString, isTimestampToday } from '../utils/time';

export interface UseAppStateReturn {
  // State
  projects: Project[];
  tasks: Task[];
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

  // Tasks
  createTask: (projectId: string, description: string) => Promise<Task>;
  startTask: (taskId: string) => Promise<void>;
  stopActiveTask: () => Promise<void>;
  updateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  getTasksByProject: (projectId: string) => Task[];
  getActiveTask: () => Task | undefined;

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
}

export function useAppState(): UseAppStateReturn {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [globalTimers, setGlobalTimers] = useState<GlobalTimer[]>([]);
  const [currentPage, setCurrentPage] = useState<Page>('landing');
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [globalTimerActive, setGlobalTimerActive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);

  const initialized = useRef(false);

  // Load initial state
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    async function init() {
      try {
        // Ensure "Other" project exists
        await db.ensureOtherProject();

        // Load all data
        const [loadedProjects, loadedTasks, loadedTimers, savedState] = await Promise.all([
          db.getAllProjects(),
          db.getAllTasks(),
          db.getAllGlobalTimers(),
          db.getAppState(),
        ]);

        setProjects(loadedProjects);
        setTasks(loadedTasks);
        setGlobalTimers(loadedTimers);

        if (savedState) {
          setCurrentPage(savedState.currentPage);
          setCurrentProjectId(savedState.currentProjectId);
          setActiveTaskId(savedState.activeTaskId);
          setGlobalTimerActive(savedState.globalTimerActive);
        }

        setIsLoading(false);
      } catch (error) {
        console.error('Failed to initialize app state:', error);
        setIsLoading(false);
      }
    }

    init();
  }, []);

  // Save app state whenever it changes
  const saveState = useCallback(async (state: Partial<AppState>) => {
    const fullState: AppState = {
      currentPage: state.currentPage ?? currentPage,
      currentProjectId: state.currentProjectId ?? currentProjectId,
      activeTaskId: state.activeTaskId ?? activeTaskId,
      globalTimerActive: state.globalTimerActive ?? globalTimerActive,
    };
    await db.saveAppState(fullState);
  }, [currentPage, currentProjectId, activeTaskId, globalTimerActive]);

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
    await saveState({
      currentPage: 'landing',
      currentProjectId: null,
      activeTaskId: null,
      globalTimerActive: false,
    });
  }, [globalTimers, activeTaskId, tasks, saveState]);

  const goToOverview = useCallback(async () => {
    setCurrentPage('overview');
    setCurrentProjectId(null);
    await saveState({ currentPage: 'overview', currentProjectId: null });
  }, [saveState]);

  const goToProject = useCallback(async (projectId: string) => {
    setCurrentPage('project');
    setCurrentProjectId(projectId);

    // Update project's lastUsed
    const project = projects.find(p => p.id === projectId);
    if (project) {
      const updatedProject = { ...project, lastUsed: Date.now() };
      await db.saveProject(updatedProject);
      setProjects(prev => prev.map(p => p.id === projectId ? updatedProject : p));
    }

    await saveState({ currentPage: 'project', currentProjectId: projectId });
  }, [projects, saveState]);

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

  // Tasks
  const createTask = useCallback(async (projectId: string, description: string): Promise<Task> => {
    const newTask: Task = {
      id: uuidv4(),
      projectId,
      description,
      startTime: Date.now(),
    };
    await db.saveTask(newTask);
    setTasks(prev => [...prev, newTask]);
    return newTask;
  }, []);

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

  const updateTask = useCallback(async (taskId: string, updates: Partial<Task>) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      const updatedTask = { ...task, ...updates };
      await db.saveTask(updatedTask);
      setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));
    }
  }, [tasks]);

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

  // Undo
  const undo = useCallback(async () => {
    const action = undoStack[undoStack.length - 1];
    if (!action) return;

    if (action.type === 'task_delete') {
      // Restore the task
      await db.saveTask(action.task);
      setTasks(prev => [...prev, action.task]);

      if (action.previousActiveTaskId) {
        setActiveTaskId(action.previousActiveTaskId);
        await saveState({ activeTaskId: action.previousActiveTaskId });
      }
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
    const [loadedProjects, loadedTasks, loadedTimers] = await Promise.all([
      db.getAllProjects(),
      db.getAllTasks(),
      db.getAllGlobalTimers(),
    ]);

    setProjects(loadedProjects);
    setTasks(loadedTasks);
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

  return {
    projects,
    tasks,
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
    createTask,
    startTask,
    stopActiveTask,
    updateTask,
    deleteTask,
    getTasksByProject,
    getActiveTask,
    undo,
    canUndo: undoStack.length > 0,
    exportFullDb,
    importFullDb,
    getTodayDuration,
    getTotalDuration,
    getTodayGlobalDuration,
    getCurrentTaskDuration,
    getTodayGlobalTimers,
  };
}
