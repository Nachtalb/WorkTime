import type { Task, Project, GlobalTimer } from '../types';
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
  globalTimers: GlobalTimer[]
): string {
  const today = getTodayDateString();
  const todayTasks = tasks.filter(t => isTimestampToday(t.startTime));
  const todayTimers = globalTimers.filter(t => t.date === today);

  let output = `Work Time Report - ${formatDateFull(Date.now())}\n`;
  output += '='.repeat(50) + '\n\n';

  // Global work time
  output += 'WORK SESSIONS:\n';
  output += '-'.repeat(30) + '\n';
  for (const timer of todayTimers) {
    const endTime = timer.endTime || Date.now();
    const duration = endTime - timer.startTime;
    output += `  ${formatTime(timer.startTime)} - ${timer.endTime ? formatTime(timer.endTime) : 'ongoing'} (${formatDuration(duration)})\n`;
  }
  output += '\n';

  // Tasks by project
  const projectMap = new Map(projects.map(p => [p.id, p]));
  const tasksByProject = new Map<string, Task[]>();

  for (const task of todayTasks) {
    const existing = tasksByProject.get(task.projectId) || [];
    existing.push(task);
    tasksByProject.set(task.projectId, existing);
  }

  output += 'TASKS BY PROJECT:\n';
  output += '-'.repeat(30) + '\n';

  for (const [projectId, projectTasks] of tasksByProject) {
    const project = projectMap.get(projectId);
    const projectName = project?.name || projectId;
    output += `\n[${projectName}]\n`;

    const sortedTasks = [...projectTasks].sort((a, b) => a.startTime - b.startTime);
    for (const task of sortedTasks) {
      const duration = task.duration || (task.endTime ? task.endTime - task.startTime : Date.now() - task.startTime);
      output += `  ${formatTime(task.startTime)} - ${task.description} (${formatDuration(duration)})\n`;
    }
  }

  return output;
}

export function exportTodayAsCsv(tasks: Task[]): string {
  const todayTasks = tasks.filter(t => isTimestampToday(t.startTime));
  const sortedTasks = [...todayTasks].sort((a, b) => a.startTime - b.startTime);

  let csv = 'date,start_time,duration_minutes,description\n';

  for (const task of sortedTasks) {
    const date = formatDate(task.startTime);
    const startTime = formatTime(task.startTime);
    const duration = task.duration || (task.endTime ? task.endTime - task.startTime : Date.now() - task.startTime);
    const durationMinutes = Math.round(duration / 60000);
    const description = `"${task.description.replace(/"/g, '""')}"`;
    csv += `${date},${startTime},${durationMinutes},${description}\n`;
  }

  return csv;
}

export function exportProjectAsTxt(
  project: Project,
  tasks: Task[],
  todayOnly: boolean = true
): string {
  const projectTasks = tasks.filter(t => t.projectId === project.id);
  const filteredTasks = todayOnly
    ? projectTasks.filter(t => isTimestampToday(t.startTime))
    : projectTasks;
  const sortedTasks = [...filteredTasks].sort((a, b) => a.startTime - b.startTime);

  let output = `Project: ${project.name}\n`;
  output += '='.repeat(50) + '\n\n';

  // Project info
  output += `Created: ${formatDateFull(project.createdAt)}\n`;
  output += `Last Used: ${getRelativeDate(project.lastUsed)} (${formatDateFull(project.lastUsed)})\n`;

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

  // Group by day
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

  return output;
}

export function exportProjectAsCsv(
  project: Project,
  tasks: Task[],
  todayOnly: boolean = true
): string {
  const projectTasks = tasks.filter(t => t.projectId === project.id);
  const filteredTasks = todayOnly
    ? projectTasks.filter(t => isTimestampToday(t.startTime))
    : projectTasks;
  const sortedTasks = [...filteredTasks].sort((a, b) => a.startTime - b.startTime);

  let csv = 'date,start_time,duration_minutes,description\n';

  for (const task of sortedTasks) {
    const date = formatDate(task.startTime);
    const startTime = formatTime(task.startTime);
    const duration = task.duration || (task.endTime ? task.endTime - task.startTime : Date.now() - task.startTime);
    const durationMinutes = Math.round(duration / 60000);
    const description = `"${task.description.replace(/"/g, '""')}"`;
    csv += `${date},${startTime},${durationMinutes},${description}\n`;
  }

  return csv;
}
