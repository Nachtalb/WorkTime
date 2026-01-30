export interface Task {
  id: string;
  projectId: string;
  description: string;
  startTime: number; // timestamp
  endTime?: number; // timestamp
  duration?: number; // milliseconds, calculated when task ends
}

export interface Note {
  id: string;
  projectId: string;
  content: string;
  createdAt: number; // timestamp
}

export interface Project {
  id: string;
  name: string;
  createdAt: number; // timestamp
  lastUsed: number; // timestamp
  isOther?: boolean; // special "Other" project
}

export interface GlobalTimer {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: number; // timestamp
  endTime?: number; // timestamp
}

export interface AppState {
  currentPage: 'landing' | 'overview' | 'project';
  currentProjectId: string | null;
  activeTaskId: string | null;
  globalTimerActive: boolean;
}

export interface UndoAction {
  type: 'task_delete' | 'note_delete';
  task?: Task;
  note?: Note;
  previousActiveTaskId: string | null;
}

export type Page = 'landing' | 'overview' | 'project';
