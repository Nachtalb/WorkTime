import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type { Task, Project, GlobalTimer, AppState } from '../types';

interface WorkTimeDB extends DBSchema {
  projects: {
    key: string;
    value: Project;
    indexes: { 'by-lastUsed': number };
  };
  tasks: {
    key: string;
    value: Task;
    indexes: {
      'by-projectId': string;
      'by-startTime': number;
    };
  };
  globalTimers: {
    key: string;
    value: GlobalTimer;
    indexes: { 'by-date': string };
  };
  appState: {
    key: string;
    value: AppState;
  };
}

const DB_NAME = 'worktime-db';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<WorkTimeDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<WorkTimeDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<WorkTimeDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Projects store
      const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
      projectStore.createIndex('by-lastUsed', 'lastUsed');

      // Tasks store
      const taskStore = db.createObjectStore('tasks', { keyPath: 'id' });
      taskStore.createIndex('by-projectId', 'projectId');
      taskStore.createIndex('by-startTime', 'startTime');

      // Global timers store
      const timerStore = db.createObjectStore('globalTimers', { keyPath: 'id' });
      timerStore.createIndex('by-date', 'date');

      // App state store
      db.createObjectStore('appState', { keyPath: 'id' });
    },
  });

  return dbInstance;
}

// Projects
export async function getAllProjects(): Promise<Project[]> {
  const db = await getDB();
  return db.getAllFromIndex('projects', 'by-lastUsed');
}

export async function getProject(id: string): Promise<Project | undefined> {
  const db = await getDB();
  return db.get('projects', id);
}

export async function saveProject(project: Project): Promise<void> {
  const db = await getDB();
  await db.put('projects', project);
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDB();
  // Also delete all tasks for this project
  const tasks = await getTasksByProject(id);
  const tx = db.transaction(['projects', 'tasks'], 'readwrite');
  await tx.objectStore('projects').delete(id);
  for (const task of tasks) {
    await tx.objectStore('tasks').delete(task.id);
  }
  await tx.done;
}

export async function ensureOtherProject(): Promise<Project> {
  const db = await getDB();
  const projects = await db.getAll('projects');
  let otherProject = projects.find(p => p.isOther);

  if (!otherProject) {
    otherProject = {
      id: 'other',
      name: 'Other',
      createdAt: Date.now(),
      lastUsed: Date.now(),
      isOther: true,
    };
    await db.put('projects', otherProject);
  }

  return otherProject;
}

// Tasks
export async function getTasksByProject(projectId: string): Promise<Task[]> {
  const db = await getDB();
  return db.getAllFromIndex('tasks', 'by-projectId', projectId);
}

export async function getTask(id: string): Promise<Task | undefined> {
  const db = await getDB();
  return db.get('tasks', id);
}

export async function saveTask(task: Task): Promise<void> {
  const db = await getDB();
  await db.put('tasks', task);
}

export async function deleteTask(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('tasks', id);
}

export async function getAllTasks(): Promise<Task[]> {
  const db = await getDB();
  return db.getAll('tasks');
}

// Global Timers
export async function getGlobalTimersByDate(date: string): Promise<GlobalTimer[]> {
  const db = await getDB();
  return db.getAllFromIndex('globalTimers', 'by-date', date);
}

export async function saveGlobalTimer(timer: GlobalTimer): Promise<void> {
  const db = await getDB();
  await db.put('globalTimers', timer);
}

export async function getAllGlobalTimers(): Promise<GlobalTimer[]> {
  const db = await getDB();
  return db.getAll('globalTimers');
}

// App State
export async function getAppState(): Promise<AppState | undefined> {
  const db = await getDB();
  return db.get('appState', 'main');
}

export async function saveAppState(state: AppState): Promise<void> {
  const db = await getDB();
  await db.put('appState', { ...state, id: 'main' } as AppState & { id: string });
}

// Export/Import
export async function exportFullDatabase(): Promise<{
  projects: Project[];
  tasks: Task[];
  globalTimers: GlobalTimer[];
  appState: AppState | undefined;
  exportDate: string;
}> {
  const db = await getDB();
  return {
    projects: await db.getAll('projects'),
    tasks: await db.getAll('tasks'),
    globalTimers: await db.getAll('globalTimers'),
    appState: await db.get('appState', 'main'),
    exportDate: new Date().toISOString(),
  };
}

export async function importFullDatabase(data: {
  projects: Project[];
  tasks: Task[];
  globalTimers: GlobalTimer[];
  appState?: AppState;
}): Promise<void> {
  const db = await getDB();

  // Clear all existing data
  const tx = db.transaction(['projects', 'tasks', 'globalTimers', 'appState'], 'readwrite');
  await tx.objectStore('projects').clear();
  await tx.objectStore('tasks').clear();
  await tx.objectStore('globalTimers').clear();
  await tx.objectStore('appState').clear();
  await tx.done;

  // Import new data
  for (const project of data.projects) {
    await db.put('projects', project);
  }
  for (const task of data.tasks) {
    await db.put('tasks', task);
  }
  for (const timer of data.globalTimers) {
    await db.put('globalTimers', timer);
  }
  if (data.appState) {
    await db.put('appState', { ...data.appState, id: 'main' } as AppState & { id: string });
  }

  // Ensure "Other" project exists
  await ensureOtherProject();
}
