import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useApp } from '../hooks/AppContext';
import { useLiveTick } from '../hooks/useLiveTick';
import type { Task } from '../types';
import { TimerIndicator } from '../components/TimerIndicator';
import { HelpPopup } from '../components/HelpPopup';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  formatTime,
  formatDuration,
  formatDate,
  getRelativeDate,
  getTooltipDate,
  formatDateFull,
  isTimestampToday,
} from '../utils/time';
import {
  downloadFile,
  exportProjectAsTxt,
  exportProjectAsCsv,
} from '../utils/export';

export function ProjectPage() {
  const {
    currentProjectId,
    tasks,
    activeTaskId,
    globalTimerActive,
    goToOverview,
    getProjectById,
    getTasksByProject,
    createTask,
    startTask,
    updateTask,
    updateProject,
    deleteTask,
    getTodayDuration,
    getTotalDuration,
    getTodayGlobalDuration,
    getCurrentTaskDuration,
  } = useApp();

  const [newTaskText, setNewTaskText] = useState('');
  const [isTypingNewTask, setIsTypingNewTask] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskText, setEditingTaskText] = useState('');
  const [isRenamingProject, setIsRenamingProject] = useState(false);
  const [projectNameEdit, setProjectNameEdit] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

  // Live tick for updating timer displays every second
  useLiveTick(globalTimerActive || activeTaskId !== null);

  const newTaskInputRef = useRef<HTMLInputElement>(null);
  const editTaskInputRef = useRef<HTMLInputElement>(null);
  const projectNameInputRef = useRef<HTMLInputElement>(null);

  const project = currentProjectId ? getProjectById(currentProjectId) : null;
  const projectTasks = currentProjectId ? getTasksByProject(currentProjectId) : [];

  // Group tasks by day
  const tasksByDay = useMemo(() => {
    const grouped = new Map<string, Task[]>();
    const sorted = [...projectTasks].sort((a, b) => b.startTime - a.startTime);

    for (const task of sorted) {
      const dateKey = formatDate(task.startTime);
      const existing = grouped.get(dateKey) || [];
      existing.push(task);
      grouped.set(dateKey, existing);
    }

    return grouped;
  }, [projectTasks]);

  // Flatten tasks for keyboard navigation
  const flattenedTasks = useMemo(() => {
    const result: Task[] = [];
    const sortedDays = [...tasksByDay.keys()].sort().reverse();
    for (const day of sortedDays) {
      const dayTasks = tasksByDay.get(day) || [];
      result.push(...dayTasks);
    }
    return result;
  }, [tasksByDay]);

  // Focus management
  useEffect(() => {
    if (isTypingNewTask && newTaskInputRef.current) {
      newTaskInputRef.current.focus();
    }
  }, [isTypingNewTask]);

  useEffect(() => {
    if (editingTaskId && editTaskInputRef.current) {
      editTaskInputRef.current.focus();
    }
  }, [editingTaskId]);

  useEffect(() => {
    if (isRenamingProject && projectNameInputRef.current) {
      projectNameInputRef.current.focus();
    }
  }, [isRenamingProject]);

  // Initialize project name for editing
  useEffect(() => {
    if (project && isRenamingProject) {
      setProjectNameEdit(project.name);
    }
  }, [project, isRenamingProject]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if modals are open
      if (showHelp || taskToDelete) return;

      // Handle Escape
      if (e.key === 'Escape') {
        e.preventDefault();
        if (isTypingNewTask) {
          setIsTypingNewTask(false);
          setNewTaskText('');
        } else if (editingTaskId) {
          setEditingTaskId(null);
          setEditingTaskText('');
        } else if (isRenamingProject) {
          setIsRenamingProject(false);
          setProjectNameEdit('');
        } else if (selectedTaskId) {
          setSelectedTaskId(null);
        } else {
          goToOverview();
        }
        return;
      }

      // Handle F2 for renaming project (only when not in edit mode)
      if (e.key === 'F2' && !isTypingNewTask && !editingTaskId && !isRenamingProject && project && !project.isOther) {
        e.preventDefault();
        setIsRenamingProject(true);
        return;
      }

      // Handle ? for help
      if (e.key === '?' && !isTypingNewTask && !editingTaskId && !isRenamingProject) {
        e.preventDefault();
        setShowHelp(true);
        return;
      }

      // Handle Ctrl+S for export TXT
      if (e.ctrlKey && e.key === 's' && !e.shiftKey && project) {
        e.preventDefault();
        const txt = exportProjectAsTxt(project, tasks, true);
        downloadFile(txt, `${project.name || 'project'}-today.txt`, 'text/plain');
        return;
      }

      // Handle Ctrl+E for export CSV
      if (e.ctrlKey && e.key === 'e' && !e.shiftKey && project) {
        e.preventDefault();
        const csv = exportProjectAsCsv(project, tasks, true);
        downloadFile(csv, `${project.name || 'project'}-today.csv`, 'text/csv');
        return;
      }

      // Handle Ctrl+Shift+S for full project TXT export
      if (e.ctrlKey && e.shiftKey && e.key === 'S' && project) {
        e.preventDefault();
        const txt = exportProjectAsTxt(project, tasks, false);
        downloadFile(txt, `${project.name || 'project'}-full.txt`, 'text/plain');
        return;
      }

      // Handle Ctrl+Shift+E for full project CSV export
      if (e.ctrlKey && e.shiftKey && e.key === 'E' && project) {
        e.preventDefault();
        const csv = exportProjectAsCsv(project, tasks, false);
        downloadFile(csv, `${project.name || 'project'}-full.csv`, 'text/csv');
        return;
      }

      // If renaming project
      if (isRenamingProject) {
        if (e.key === 'Enter') {
          e.preventDefault();
          updateProject(currentProjectId!, { name: projectNameEdit });
          setIsRenamingProject(false);
        }
        return;
      }

      // If editing a task
      if (editingTaskId) {
        if (e.key === 'Enter') {
          e.preventDefault();
          updateTask(editingTaskId, { description: editingTaskText });
          setEditingTaskId(null);
          setEditingTaskText('');
        }
        return;
      }

      // If typing a new task
      if (isTypingNewTask) {
        if (e.key === 'Enter' && newTaskText.trim()) {
          e.preventDefault();
          createTask(currentProjectId!, newTaskText.trim()).then((task) => {
            startTask(task.id);
            setNewTaskText('');
            setIsTypingNewTask(false);
          });
        }
        return;
      }

      // Handle Enter for starting selected task or editing it
      if (e.key === 'Enter' && selectedTaskId) {
        e.preventDefault();
        const task = flattenedTasks.find((t) => t.id === selectedTaskId);
        if (task) {
          setEditingTaskId(task.id);
          setEditingTaskText(task.description);
        }
        return;
      }

      // Handle Delete for selected task
      if (e.key === 'Delete' && selectedTaskId) {
        e.preventDefault();
        setTaskToDelete(selectedTaskId);
        return;
      }

      // Handle arrow keys for navigation
      if ((e.key === 'ArrowUp' || e.key === 'ArrowLeft') && flattenedTasks.length > 0) {
        e.preventDefault();
        if (!selectedTaskId) {
          setSelectedTaskId(flattenedTasks[0].id);
        } else {
          const currentIndex = flattenedTasks.findIndex((t) => t.id === selectedTaskId);
          if (currentIndex > 0) {
            setSelectedTaskId(flattenedTasks[currentIndex - 1].id);
          }
        }
        return;
      }

      if ((e.key === 'ArrowDown' || e.key === 'ArrowRight') && flattenedTasks.length > 0) {
        e.preventDefault();
        if (!selectedTaskId) {
          setSelectedTaskId(flattenedTasks[0].id);
        } else {
          const currentIndex = flattenedTasks.findIndex((t) => t.id === selectedTaskId);
          if (currentIndex < flattenedTasks.length - 1) {
            setSelectedTaskId(flattenedTasks[currentIndex + 1].id);
          }
        }
        return;
      }

      // Start typing a new task with any printable character
      if (
        e.key.length === 1 &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !isTypingNewTask &&
        !editingTaskId
      ) {
        setIsTypingNewTask(true);
        setNewTaskText(e.key);
        setSelectedTaskId(null);
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    showHelp,
    taskToDelete,
    isTypingNewTask,
    editingTaskId,
    isRenamingProject,
    selectedTaskId,
    newTaskText,
    editingTaskText,
    projectNameEdit,
    flattenedTasks,
    goToOverview,
    createTask,
    startTask,
    updateTask,
    updateProject,
    currentProjectId,
    project,
    tasks,
  ]);

  const handleDeleteConfirm = useCallback(() => {
    if (taskToDelete) {
      deleteTask(taskToDelete);
      setTaskToDelete(null);
      setSelectedTaskId(null);
    }
  }, [taskToDelete, deleteTask]);

  const taskToDeleteDescription = taskToDelete
    ? flattenedTasks.find((t) => t.id === taskToDelete)?.description || ''
    : '';

  // Calculate task duration
  const getTaskDuration = (task: Task): number => {
    if (task.duration) return task.duration;
    if (task.endTime) return task.endTime - task.startTime;
    if (task.id === activeTaskId) return Date.now() - task.startTime;
    return 0;
  };

  if (!project) {
    return (
      <div className="page project-page">
        <div className="loading">Project not found</div>
      </div>
    );
  }

  return (
    <div className="page project-page">
      <div className="project-header">
        <div className="project-title-section">
          {isRenamingProject ? (
            <input
              ref={projectNameInputRef}
              type="text"
              className="project-title-input"
              value={projectNameEdit}
              onChange={(e) => setProjectNameEdit(e.target.value)}
              onBlur={() => {
                updateProject(currentProjectId!, { name: projectNameEdit });
                setIsRenamingProject(false);
              }}
            />
          ) : (
            <h1 className="project-title">
              {project.name || 'Unnamed Project'}
              {project.isOther && <span className="tag">Special</span>}
            </h1>
          )}

          <div className="project-tags">
            <span className="tag" data-tooltip={getTooltipDate(project.createdAt)}>
              Started {formatDateFull(project.createdAt)}
            </span>
            <span className="tag" data-tooltip={getTooltipDate(project.lastUsed)}>
              Last: {getRelativeDate(project.lastUsed)}
            </span>
            <span className="tag primary">Today: {formatDuration(getTodayDuration(currentProjectId!))}</span>
            <span className="tag success">Total: {formatDuration(getTotalDuration(currentProjectId!))}</span>
          </div>
        </div>

        <TimerIndicator
          globalDuration={getTodayGlobalDuration()}
          taskDuration={getCurrentTaskDuration()}
          isActive={globalTimerActive}
        />
      </div>

      <input
        ref={newTaskInputRef}
        type="text"
        className={`new-task-input ${isTypingNewTask ? 'typing' : ''}`}
        placeholder="Start typing to create a new task..."
        value={newTaskText}
        onChange={(e) => setNewTaskText(e.target.value)}
        onFocus={() => setIsTypingNewTask(true)}
        onBlur={() => {
          if (!newTaskText.trim()) {
            setIsTypingNewTask(false);
          }
        }}
      />

      <div className="tasks-section">
        {[...tasksByDay.entries()].map(([dateKey, dayTasks]) => {
          const isToday = isTimestampToday(dayTasks[0].startTime);

          return (
            <div key={dateKey} className="day-group">
              <div className="day-header">
                {isToday ? 'Today' : formatDateFull(dayTasks[0].startTime)}
              </div>
              <div className="tasks-list">
                {dayTasks.map((task) => {
                  const isActive = task.id === activeTaskId;
                  const isSelected = task.id === selectedTaskId;
                  const isEditing = task.id === editingTaskId;
                  const duration = getTaskDuration(task);

                  return (
                    <div
                      key={task.id}
                      className={`task-item ${isSelected ? 'selected' : ''} ${isActive ? 'active' : ''}`}
                      onClick={() => {
                        if (!isEditing) {
                          setSelectedTaskId(task.id);
                        }
                      }}
                      onDoubleClick={() => {
                        startTask(task.id);
                      }}
                    >
                      <span className="task-time">{formatTime(task.startTime)}</span>

                      {isEditing ? (
                        <input
                          ref={editTaskInputRef}
                          type="text"
                          className="task-description-input"
                          value={editingTaskText}
                          onChange={(e) => setEditingTaskText(e.target.value)}
                          onBlur={() => {
                            updateTask(task.id, { description: editingTaskText });
                            setEditingTaskId(null);
                            setEditingTaskText('');
                          }}
                        />
                      ) : (
                        <span className="task-description">{task.description}</span>
                      )}

                      <span className={`task-duration ${isActive ? 'active' : ''}`}>
                        {formatDuration(duration)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {flattenedTasks.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-text">
              No tasks yet. Start typing to create one.
            </div>
          </div>
        )}
      </div>

      <HelpPopup isOpen={showHelp} onClose={() => setShowHelp(false)} currentPage="project" />

      <ConfirmDialog
        isOpen={!!taskToDelete}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setTaskToDelete(null)}
        message="Are you sure you want to delete task"
        itemName={taskToDeleteDescription}
      />
    </div>
  );
}
