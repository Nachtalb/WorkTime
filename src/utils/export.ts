import type { Task, Project, GlobalTimer, Note } from '../types';
import {
  formatTime,
  formatDate,
  formatDuration,
  formatDateFull,
  getRelativeDate,
  isTimestampToday,
  getTodayDateString,
} from './time';

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportTodayAsTxt(
  tasks: Task[],
  projects: Project[],
  globalTimers: GlobalTimer[],
  notes: Note[] = []
): string {
  const today = getTodayDateString();
  const todayTasks = tasks.filter(t => isTimestampToday(t.startTime));
  const todayNotes = notes.filter(n => isTimestampToday(n.createdAt));
  const todayTimers = globalTimers.filter(t => t.date === today);

  let output = `Work Time Report - ${formatDateFull(Date.now())}\n`;
  output += '='.repeat(50) + '\n\n';

  // Global work time
  output += 'WORK SESSIONS:\n';
  output += '-'.repeat(30) + '\n';
  for (const timer of todayTimers) {
    const endTime = timer.endTime || Date.now();
    const duration = endTime - timer.startTime;
    output += `  [${formatTime(timer.startTime)}] - [${timer.endTime ? formatTime(timer.endTime) : 'ongoing'}] (${formatDuration(duration)})\n`;
  }
  output += '\n';

  // Build project map for lookups
  const projectMap = new Map(projects.map(p => [p.id, p]));

  // Find max project name length (min 7 chars) for tasks
  const maxProjectLen = Math.max(7, ...todayTasks.map(task => {
    const project = projectMap.get(task.projectId);
    return (project?.name || task.projectId).length;
  }));

  // Tasks in chronological order
  const sortedTasks = [...todayTasks].sort((a, b) => a.startTime - b.startTime);

  output += 'TASKS:\n';
  output += '-'.repeat(30) + '\n';

  for (const task of sortedTasks) {
    const project = projectMap.get(task.projectId);
    const projectName = (project?.name || task.projectId).padEnd(maxProjectLen);
    const duration = task.duration || (task.endTime ? task.endTime - task.startTime : Date.now() - task.startTime);
    output += `  [${formatTime(task.startTime)}] - ${projectName} - ${task.description} (${formatDuration(duration)})\n`;
  }

  // Notes grouped by project
  if (todayNotes.length > 0) {
    const notesByProject = new Map<string, Note[]>();
    for (const note of todayNotes) {
      const existing = notesByProject.get(note.projectId) || [];
      existing.push(note);
      notesByProject.set(note.projectId, existing);
    }

    output += '\n\nNOTES BY PROJECT:\n';
    output += '-'.repeat(30) + '\n';

    for (const [projectId, projectNotes] of notesByProject) {
      const project = projectMap.get(projectId);
      const projectName = project?.name || projectId;
      output += `\n[${projectName}]\n`;

      const sortedNotes = [...projectNotes].sort((a, b) => a.createdAt - b.createdAt);
      for (const note of sortedNotes) {
        const noteLines = note.content.split('\n');
        output += `  [${formatTime(note.createdAt)}] ${noteLines[0]}`;
        if (noteLines.length > 1) {
          const indent = ' '.repeat(10); // align with first line content
          for (let i = 1; i < noteLines.length; i++) {
            output += `\n${indent}${noteLines[i]}`;
          }
        }
        output += '\n';
      }
    }
  }

  return output;
}

export function exportTodayAsCsv(tasks: Task[], notes: Note[] = []): string {
  const todayTasks = tasks.filter(t => isTimestampToday(t.startTime));
  const todayNotes = notes.filter(n => isTimestampToday(n.createdAt));
  const sortedTasks = [...todayTasks].sort((a, b) => a.startTime - b.startTime);
  const sortedNotes = [...todayNotes].sort((a, b) => a.createdAt - b.createdAt);

  let csv = 'type,date,time,duration_minutes,content\n';

  for (const task of sortedTasks) {
    const date = formatDate(task.startTime);
    const startTime = formatTime(task.startTime);
    const duration = task.duration || (task.endTime ? task.endTime - task.startTime : Date.now() - task.startTime);
    const durationMinutes = Math.round(duration / 60000);
    const description = `"${task.description.replace(/"/g, '""')}"`;
    csv += `task,${date},${startTime},${durationMinutes},${description}\n`;
  }

  for (const note of sortedNotes) {
    const date = formatDate(note.createdAt);
    const time = formatTime(note.createdAt);
    const content = `"${note.content.replace(/"/g, '""').replace(/\n/g, '\\n')}"`;
    csv += `note,${date},${time},,${content}\n`;
  }

  return csv;
}

export function exportProjectAsTxt(
  project: Project,
  tasks: Task[],
  todayOnly: boolean = true,
  notes: Note[] = []
): string {
  const projectTasks = tasks.filter(t => t.projectId === project.id);
  const projectNotes = notes.filter(n => n.projectId === project.id);
  const filteredTasks = todayOnly
    ? projectTasks.filter(t => isTimestampToday(t.startTime))
    : projectTasks;
  const filteredNotes = todayOnly
    ? projectNotes.filter(n => isTimestampToday(n.createdAt))
    : projectNotes;
  const sortedTasks = [...filteredTasks].sort((a, b) => a.startTime - b.startTime);
  const sortedNotes = [...filteredNotes].sort((a, b) => a.createdAt - b.createdAt);

  let output = `Project: ${project.name}\n`;
  output += '='.repeat(50) + '\n\n';

  // Project info
  output += `Created: ${formatDateFull(project.createdAt)}\n`;
  output += `Last Used: ${getRelativeDate(project.lastUsed)} (${formatDateFull(project.lastUsed)})\n`;
  if (project.doneAt) {
    output += `Status: Done (${formatDateFull(project.doneAt)} at ${formatTime(project.doneAt)})\n`;
  } else if (project.onHoldAt) {
    output += `Status: On Hold (since ${formatDateFull(project.onHoldAt)} at ${formatTime(project.onHoldAt)})\n`;
  } else {
    output += `Status: Active\n`;
  }

  // Calculate total duration
  let totalDuration = 0;
  let todayDuration = 0;
  for (const task of projectTasks) {
    const duration = task.duration || (task.endTime ? task.endTime - task.startTime : Date.now() - task.startTime);
    totalDuration += duration;
    if (isTimestampToday(task.startTime)) {
      todayDuration += duration;
    }
  }

  output += `Duration Today: ${formatDuration(todayDuration)}\n`;
  output += `Total Duration: ${formatDuration(totalDuration)}\n\n`;

  output += 'TASKS:\n';
  output += '-'.repeat(30) + '\n';

  // Group tasks by day
  const tasksByDay = new Map<string, Task[]>();
  for (const task of sortedTasks) {
    const dateKey = formatDate(task.startTime);
    const existing = tasksByDay.get(dateKey) || [];
    existing.push(task);
    tasksByDay.set(dateKey, existing);
  }

  const sortedDays = [...tasksByDay.keys()].sort().reverse();
  for (const day of sortedDays) {
    const dayTasks = tasksByDay.get(day)!;
    output += `\n${formatDateFull(dayTasks[0].startTime)}\n`;

    for (const task of dayTasks) {
      const duration = task.duration || (task.endTime ? task.endTime - task.startTime : Date.now() - task.startTime);
      output += `  ${formatTime(task.startTime)} - ${task.description} (${formatDuration(duration)})\n`;
    }
  }

  // Notes section
  if (sortedNotes.length > 0) {
    output += '\n\nNOTES:\n';
    output += '-'.repeat(30) + '\n';

    // Group notes by day
    const notesByDay = new Map<string, Note[]>();
    for (const note of sortedNotes) {
      const dateKey = formatDate(note.createdAt);
      const existing = notesByDay.get(dateKey) || [];
      existing.push(note);
      notesByDay.set(dateKey, existing);
    }

    const sortedNoteDays = [...notesByDay.keys()].sort().reverse();
    for (const day of sortedNoteDays) {
      const dayNotes = notesByDay.get(day)!;
      output += `\n${formatDateFull(dayNotes[0].createdAt)}\n`;

      for (const note of dayNotes) {
        output += `  [${formatTime(note.createdAt)}] ${note.content}\n`;
      }
    }
  }

  return output;
}

export function exportProjectAsCsv(
  project: Project,
  tasks: Task[],
  todayOnly: boolean = true,
  notes: Note[] = []
): string {
  const projectTasks = tasks.filter(t => t.projectId === project.id);
  const projectNotes = notes.filter(n => n.projectId === project.id);
  const filteredTasks = todayOnly
    ? projectTasks.filter(t => isTimestampToday(t.startTime))
    : projectTasks;
  const filteredNotes = todayOnly
    ? projectNotes.filter(n => isTimestampToday(n.createdAt))
    : projectNotes;
  const sortedTasks = [...filteredTasks].sort((a, b) => a.startTime - b.startTime);
  const sortedNotes = [...filteredNotes].sort((a, b) => a.createdAt - b.createdAt);

  let csv = 'type,date,time,duration_minutes,content\n';

  for (const task of sortedTasks) {
    const date = formatDate(task.startTime);
    const startTime = formatTime(task.startTime);
    const duration = task.duration || (task.endTime ? task.endTime - task.startTime : Date.now() - task.startTime);
    const durationMinutes = Math.round(duration / 60000);
    const description = `"${task.description.replace(/"/g, '""')}"`;
    csv += `task,${date},${startTime},${durationMinutes},${description}\n`;
  }

  for (const note of sortedNotes) {
    const date = formatDate(note.createdAt);
    const time = formatTime(note.createdAt);
    const content = `"${note.content.replace(/"/g, '""').replace(/\n/g, '\\n')}"`;
    csv += `note,${date},${time},,${content}\n`;
  }

  return csv;
}
