export type ProjectPriority = 'normal' | 'medium' | 'high';

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
  completed?: boolean; // for todo items
  completedAt?: number; // timestamp when marked as done
}

export interface Project {
  id: string;
  name: string;
  subtitle?: string; // optional subtitle
  createdAt: number; // timestamp
  lastUsed: number; // timestamp
  isOther?: boolean; // special "Other" project
  isTodo?: boolean; // special "ToDo" project
  doneAt?: number; // timestamp when marked as done
  onHoldAt?: number; // timestamp when marked as on hold
  priority?: ProjectPriority; // default is 'normal'
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
  browseMode?: boolean;
}

export interface UndoAction {
  type: 'task_delete' | 'note_delete';
  task?: Task;
  note?: Note;
  previousActiveTaskId: string | null;
}

export type Page = 'landing' | 'overview' | 'project';
