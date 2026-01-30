import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useApp } from '../hooks/AppContext';
import { useLiveTick } from '../hooks/useLiveTick';
import type { Task, Note } from '../types';
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

type Column = 'tasks' | 'notes';

export function ProjectPage() {
  const {
    currentProjectId,
    tasks,
    notes,
    activeTaskId,
    globalTimerActive,
    goToOverview,
    getProjectById,
    getTasksByProject,
    getNotesByProject,
    createTask,
    createNote,
    startTask,
    updateTask,
    updateNote,
    updateProject,
    deleteTask,
    deleteNote,
    getTodayDuration,
    getTotalDuration,
    getTodayGlobalDuration,
    getCurrentTaskDuration,
    getActiveTaskInfo,
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

  // Notes state
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [isTypingNewNote, setIsTypingNewNote] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);

  // Column selection (tasks or notes)
  const [activeColumn, setActiveColumn] = useState<Column>('tasks');

  // Live tick for updating timer displays every second
  useLiveTick(globalTimerActive || activeTaskId !== null);

  const newTaskInputRef = useRef<HTMLInputElement>(null);
  const editTaskInputRef = useRef<HTMLInputElement>(null);
  const projectNameInputRef = useRef<HTMLInputElement>(null);
  const editNoteInputRef = useRef<HTMLTextAreaElement>(null);

  const project = currentProjectId ? getProjectById(currentProjectId) : null;
  const projectTasks = currentProjectId ? getTasksByProject(currentProjectId) : [];
  const projectNotes = currentProjectId ? getNotesByProject(currentProjectId) : [];

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

  // Group notes by day
  const notesByDay = useMemo(() => {
    const grouped = new Map<string, Note[]>();
    const sorted = [...projectNotes].sort((a, b) => b.createdAt - a.createdAt);

    for (const note of sorted) {
      const dateKey = formatDate(note.createdAt);
      const existing = grouped.get(dateKey) || [];
      existing.push(note);
      grouped.set(dateKey, existing);
    }

    return grouped;
  }, [projectNotes]);

  // Flatten notes for keyboard navigation
  const flattenedNotes = useMemo(() => {
    const result: Note[] = [];
    const sortedDays = [...notesByDay.keys()].sort().reverse();
    for (const day of sortedDays) {
      const dayNotes = notesByDay.get(day) || [];
      result.push(...dayNotes);
    }
    return result;
  }, [notesByDay]);

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
    if (editingNoteId && editNoteInputRef.current) {
      editNoteInputRef.current.focus();
    }
  }, [editingNoteId]);

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
      if (showHelp || taskToDelete || noteToDelete) return;

      // Handle Escape
      if (e.key === 'Escape') {
        e.preventDefault();
        if (isTypingNewTask) {
          setIsTypingNewTask(false);
          setNewTaskText('');
        } else if (isTypingNewNote) {
          setIsTypingNewNote(false);
          setNewNoteText('');
        } else if (editingTaskId) {
          setEditingTaskId(null);
          setEditingTaskText('');
        } else if (editingNoteId) {
          setEditingNoteId(null);
          setEditingNoteText('');
        } else if (isRenamingProject) {
          setIsRenamingProject(false);
          setProjectNameEdit('');
        } else if (selectedTaskId || selectedNoteId) {
          setSelectedTaskId(null);
          setSelectedNoteId(null);
        } else {
          goToOverview();
        }
        return;
      }

      // Handle F2 for renaming project (only when not in edit mode)
      if (e.key === 'F2' && !isTypingNewTask && !isTypingNewNote && !editingTaskId && !editingNoteId && !isRenamingProject && project && !project.isOther) {
        e.preventDefault();
        setIsRenamingProject(true);
        return;
      }

      // Handle ? for help
      if (e.key === '?' && !isTypingNewTask && !isTypingNewNote && !editingTaskId && !editingNoteId && !isRenamingProject) {
        e.preventDefault();
        setShowHelp(true);
        return;
      }

      // Handle Ctrl+T for new task
      if (e.ctrlKey && e.key === 't' && !isTypingNewTask && !isTypingNewNote && !editingTaskId && !editingNoteId && !isRenamingProject) {
        e.preventDefault();
        setActiveColumn('tasks');
        setIsTypingNewTask(true);
        setNewTaskText('');
        setSelectedTaskId(null);
        setSelectedNoteId(null);
        return;
      }

      // Handle Ctrl+N for new note
      if (e.ctrlKey && e.key === 'n' && !isTypingNewTask && !isTypingNewNote && !editingTaskId && !editingNoteId && !isRenamingProject) {
        e.preventDefault();
        setActiveColumn('notes');
        setIsTypingNewNote(true);
        setNewNoteText('');
        setSelectedTaskId(null);
        setSelectedNoteId(null);
        return;
      }

      // Handle Ctrl+S for export TXT
      if (e.ctrlKey && e.key === 's' && !e.shiftKey && !e.altKey && project) {
        e.preventDefault();
        const txt = exportProjectAsTxt(project, tasks, true, notes);
        downloadFile(txt, `${project.name || 'project'}-today.txt`, 'text/plain');
        return;
      }

      // Handle Ctrl+E for export CSV
      if (e.ctrlKey && e.key === 'e' && !e.shiftKey && !e.altKey && project) {
        e.preventDefault();
        const csv = exportProjectAsCsv(project, tasks, true, notes);
        downloadFile(csv, `${project.name || 'project'}-today.csv`, 'text/csv');
        return;
      }

      // Handle Ctrl+Alt+S for full project TXT export
      if (e.ctrlKey && e.altKey && e.key === 's' && project) {
        e.preventDefault();
        const txt = exportProjectAsTxt(project, tasks, false, notes);
        downloadFile(txt, `${project.name || 'project'}-full.txt`, 'text/plain');
        return;
      }

      // Handle Ctrl+Alt+E for full project CSV export
      if (e.ctrlKey && e.altKey && e.key === 'e' && project) {
        e.preventDefault();
        const csv = exportProjectAsCsv(project, tasks, false, notes);
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

      // If editing a note
      if (editingNoteId) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          updateNote(editingNoteId, { content: editingNoteText });
          setEditingNoteId(null);
          setEditingNoteText('');
        }
        return;
      }

      // If typing a new task
      if (isTypingNewTask) {
        if (e.key === 'Enter' && newTaskText.trim()) {
          e.preventDefault();
          createTask(currentProjectId!, newTaskText.trim()).then(() => {
            setNewTaskText('');
            setIsTypingNewTask(false);
          });
        }
        return;
      }

      // If typing a new note
      if (isTypingNewNote) {
        if (e.key === 'Enter' && !e.shiftKey && newNoteText.trim()) {
          e.preventDefault();
          createNote(currentProjectId!, newNoteText.trim()).then(() => {
            setNewNoteText('');
            setIsTypingNewNote(false);
          });
        }
        return;
      }

      // Handle Enter for editing selected task or note
      if (e.key === 'Enter') {
        e.preventDefault();
        if (activeColumn === 'tasks' && selectedTaskId) {
          const task = flattenedTasks.find((t) => t.id === selectedTaskId);
          if (task) {
            setEditingTaskId(task.id);
            setEditingTaskText(task.description);
          }
        } else if (activeColumn === 'notes' && selectedNoteId) {
          const note = flattenedNotes.find((n) => n.id === selectedNoteId);
          if (note) {
            setEditingNoteId(note.id);
            setEditingNoteText(note.content);
          }
        }
        return;
      }

      // Handle Delete for selected task or note
      if (e.key === 'Delete') {
        e.preventDefault();
        if (activeColumn === 'tasks' && selectedTaskId) {
          setTaskToDelete(selectedTaskId);
        } else if (activeColumn === 'notes' && selectedNoteId) {
          setNoteToDelete(selectedNoteId);
        }
        return;
      }

      // Handle Space for duplicating selected task as new active task
      if (e.key === ' ' && activeColumn === 'tasks' && selectedTaskId && !isTypingNewTask && !editingTaskId) {
        e.preventDefault();
        const task = flattenedTasks.find((t) => t.id === selectedTaskId);
        if (task && currentProjectId) {
          createTask(currentProjectId, task.description);
        }
        return;
      }

      // Handle Left/Right arrow keys for column switching
      if (e.key === 'ArrowLeft' && activeColumn === 'notes') {
        e.preventDefault();
        setActiveColumn('tasks');
        setSelectedNoteId(null);
        if (flattenedTasks.length > 0 && !selectedTaskId) {
          setSelectedTaskId(flattenedTasks[0].id);
        }
        return;
      }

      if (e.key === 'ArrowRight' && activeColumn === 'tasks') {
        e.preventDefault();
        setActiveColumn('notes');
        setSelectedTaskId(null);
        if (flattenedNotes.length > 0 && !selectedNoteId) {
          setSelectedNoteId(flattenedNotes[0].id);
        }
        return;
      }

      // Handle Up/Down arrow keys for navigation within column
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (activeColumn === 'tasks' && flattenedTasks.length > 0) {
          if (!selectedTaskId) {
            setSelectedTaskId(flattenedTasks[0].id);
          } else {
            const currentIndex = flattenedTasks.findIndex((t) => t.id === selectedTaskId);
            if (currentIndex > 0) {
              setSelectedTaskId(flattenedTasks[currentIndex - 1].id);
            }
          }
        } else if (activeColumn === 'notes' && flattenedNotes.length > 0) {
          if (!selectedNoteId) {
            setSelectedNoteId(flattenedNotes[0].id);
          } else {
            const currentIndex = flattenedNotes.findIndex((n) => n.id === selectedNoteId);
            if (currentIndex > 0) {
              setSelectedNoteId(flattenedNotes[currentIndex - 1].id);
            }
          }
        }
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (activeColumn === 'tasks' && flattenedTasks.length > 0) {
          if (!selectedTaskId) {
            setSelectedTaskId(flattenedTasks[0].id);
          } else {
            const currentIndex = flattenedTasks.findIndex((t) => t.id === selectedTaskId);
            if (currentIndex < flattenedTasks.length - 1) {
              setSelectedTaskId(flattenedTasks[currentIndex + 1].id);
            }
          }
        } else if (activeColumn === 'notes' && flattenedNotes.length > 0) {
          if (!selectedNoteId) {
            setSelectedNoteId(flattenedNotes[0].id);
          } else {
            const currentIndex = flattenedNotes.findIndex((n) => n.id === selectedNoteId);
            if (currentIndex < flattenedNotes.length - 1) {
              setSelectedNoteId(flattenedNotes[currentIndex + 1].id);
            }
          }
        }
        return;
      }

      // Start typing with any printable character based on active column
      if (
        e.key.length === 1 &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !isTypingNewTask &&
        !isTypingNewNote &&
        !editingTaskId &&
        !editingNoteId
      ) {
        e.preventDefault();
        if (activeColumn === 'tasks') {
          setIsTypingNewTask(true);
          setNewTaskText(e.key);
          setSelectedTaskId(null);
        } else {
          setIsTypingNewNote(true);
          setNewNoteText(e.key);
          setSelectedNoteId(null);
        }
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    showHelp,
    taskToDelete,
    noteToDelete,
    isTypingNewTask,
    isTypingNewNote,
    editingTaskId,
    editingNoteId,
    isRenamingProject,
    selectedTaskId,
    selectedNoteId,
    activeColumn,
    newTaskText,
    newNoteText,
    editingTaskText,
    editingNoteText,
    projectNameEdit,
    flattenedTasks,
    flattenedNotes,
    goToOverview,
    createTask,
    createNote,
    startTask,
    updateTask,
    updateNote,
    updateProject,
    currentProjectId,
    project,
    tasks,
    notes,
  ]);

  const handleDeleteConfirm = useCallback(() => {
    if (taskToDelete) {
      deleteTask(taskToDelete);
      setTaskToDelete(null);
      setSelectedTaskId(null);
    }
  }, [taskToDelete, deleteTask]);

  const handleNoteDeleteConfirm = useCallback(() => {
    if (noteToDelete) {
      deleteNote(noteToDelete);
      setNoteToDelete(null);
      setSelectedNoteId(null);
    }
  }, [noteToDelete, deleteNote]);

  const taskToDeleteDescription = taskToDelete
    ? flattenedTasks.find((t) => t.id === taskToDelete)?.description || ''
    : '';

  const noteToDeleteContent = noteToDelete
    ? flattenedNotes.find((n) => n.id === noteToDelete)?.content.substring(0, 50) || ''
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
        <button className="back-button" onClick={goToOverview} title="Back to Overview (Esc)">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
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
          activeTaskInfo={getActiveTaskInfo()}
        />
      </div>

      <input
        ref={newTaskInputRef}
        type="text"
        className={`new-task-input ${isTypingNewTask || isTypingNewNote ? 'typing' : ''}`}
        placeholder={activeColumn === 'tasks' ? 'Start typing to create a new task...' : 'Start typing to create a new note...'}
        value={activeColumn === 'tasks' ? newTaskText : newNoteText}
        onChange={(e) => {
          if (activeColumn === 'tasks') {
            setNewTaskText(e.target.value);
          } else {
            setNewNoteText(e.target.value);
          }
        }}
        onFocus={() => {
          if (activeColumn === 'tasks') {
            setIsTypingNewTask(true);
          } else {
            setIsTypingNewNote(true);
          }
        }}
        onBlur={() => {
          if (activeColumn === 'tasks' && !newTaskText.trim()) {
            setIsTypingNewTask(false);
          } else if (activeColumn === 'notes' && !newNoteText.trim()) {
            setIsTypingNewNote(false);
          }
        }}
      />

      <div className="columns-container">
        {/* Tasks Column */}
        <div className={`column tasks-column ${activeColumn === 'tasks' ? 'active-column' : ''}`}>
          <div
            className="column-header"
            onClick={() => {
              setActiveColumn('tasks');
              setSelectedNoteId(null);
            }}
          >
            Tasks
          </div>
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
                      const isSelected = task.id === selectedTaskId && activeColumn === 'tasks';
                      const isEditing = task.id === editingTaskId;
                      const duration = getTaskDuration(task);

                      return (
                        <div
                          key={task.id}
                          className={`task-item ${isSelected ? 'selected' : ''} ${isActive ? 'active' : ''}`}
                          onClick={() => {
                            if (!isEditing) {
                              setActiveColumn('tasks');
                              setSelectedTaskId(task.id);
                              setSelectedNoteId(null);
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
        </div>

        {/* Notes Column */}
        <div className={`column notes-column ${activeColumn === 'notes' ? 'active-column' : ''}`}>
          <div
            className="column-header"
            onClick={() => {
              setActiveColumn('notes');
              setSelectedTaskId(null);
            }}
          >
            Notes
          </div>
          <div className="notes-section">
            {[...notesByDay.entries()].map(([dateKey, dayNotes]) => {
              const isToday = isTimestampToday(dayNotes[0].createdAt);

              return (
                <div key={dateKey} className="day-group">
                  <div className="day-header">
                    {isToday ? 'Today' : formatDateFull(dayNotes[0].createdAt)}
                  </div>
                  <div className="notes-list">
                    {dayNotes.map((note) => {
                      const isSelected = note.id === selectedNoteId && activeColumn === 'notes';
                      const isEditing = note.id === editingNoteId;

                      return (
                        <div
                          key={note.id}
                          className={`note-item ${isSelected ? 'selected' : ''}`}
                          onClick={() => {
                            if (!isEditing) {
                              setActiveColumn('notes');
                              setSelectedNoteId(note.id);
                              setSelectedTaskId(null);
                            }
                          }}
                        >
                          <span className="note-time">{formatTime(note.createdAt)}</span>

                          {isEditing ? (
                            <textarea
                              ref={editNoteInputRef}
                              className="note-content-input"
                              value={editingNoteText}
                              onChange={(e) => setEditingNoteText(e.target.value)}
                              onBlur={() => {
                                updateNote(note.id, { content: editingNoteText });
                                setEditingNoteId(null);
                                setEditingNoteText('');
                              }}
                            />
                          ) : (
                            <span className="note-content">{note.content}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {flattenedNotes.length === 0 && (
              <div className="empty-state">
                <div className="empty-state-text">
                  No notes yet. Press Ctrl+N to create one.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <HelpPopup isOpen={showHelp} onClose={() => setShowHelp(false)} currentPage="project" />

      <ConfirmDialog
        isOpen={!!taskToDelete}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setTaskToDelete(null)}
        message="Are you sure you want to delete task"
        itemName={taskToDeleteDescription}
      />

      <ConfirmDialog
        isOpen={!!noteToDelete}
        onConfirm={handleNoteDeleteConfirm}
        onCancel={() => setNoteToDelete(null)}
        message="Are you sure you want to delete note"
        itemName={noteToDeleteContent}
      />
    </div>
  );
}
