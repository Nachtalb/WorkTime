import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useApp } from '../hooks/AppContext';
import { useLiveTick } from '../hooks/useLiveTick';
import type { Task, Note, ProjectPriority } from '../types';
import { TimerIndicator } from '../components/TimerIndicator';
import { HelpPopup } from '../components/HelpPopup';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ProjectMentionPopup } from '../components/ProjectMentionPopup';
import { TextWithProjectRefs, detectNoteTagType, NOTE_TAG_PATTERNS, type NoteTagType } from '../components/TextWithProjectRefs';
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
    projects,
    tasks,
    notes,
    activeTaskId,
    globalTimerActive,
    browseMode,
    goToOverview,
    goToProject,
    exitBrowseMode,
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
    toggleNoteCompleted,
    markProjectDone,
    reopenProject,
    toggleProjectOnHold,
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
  const [isEditingSubtitle, setIsEditingSubtitle] = useState(false);
  const [subtitleEdit, setSubtitleEdit] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

  // Notes state
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [isTypingNewNote, setIsTypingNewNote] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [showDoneConfirm, setShowDoneConfirm] = useState(false);
  const [showActionError, setShowActionError] = useState(false);
  const [showInputError, setShowInputError] = useState(false);

  // Mention popup state
  const [mentionPopupOpen, setMentionPopupOpen] = useState(false);
  const [mentionSearchText, setMentionSearchText] = useState('');
  const [mentionSelectedIndex, setMentionSelectedIndex] = useState(0);
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [mentionStartIndex, setMentionStartIndex] = useState(0);
  const [mentionInputType, setMentionInputType] = useState<'newTask' | 'newNote' | 'editTask' | 'editNote' | null>(null);

  // Column selection (tasks or notes)
  const [activeColumn, setActiveColumn] = useState<Column>('tasks');

  // For ToDo projects, always use notes column
  const project = currentProjectId ? getProjectById(currentProjectId) : null;
  const effectiveActiveColumn = project?.isTodo ? 'notes' : activeColumn;

  // Live tick for updating timer displays every second
  useLiveTick(globalTimerActive || activeTaskId !== null);

  const newTaskInputRef = useRef<HTMLInputElement>(null);
  const editTaskInputRef = useRef<HTMLInputElement>(null);
  const projectNameInputRef = useRef<HTMLInputElement>(null);
  const subtitleInputRef = useRef<HTMLInputElement>(null);
  const editNoteInputRef = useRef<HTMLTextAreaElement>(null);

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

  // Get note tags with their content for the current project
  const projectNoteTags = useMemo((): Array<{ type: Exclude<NoteTagType, null>; content: string }> => {
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
  }, [projectNotes]);

  // Cycle project priority
  const cyclePriority = useCallback((direction: 'up' | 'down') => {
    if (!project || project.isOther) return;

    // Don't allow priority change on done projects - show error shake
    if (project.doneAt) {
      setShowActionError(true);
      setTimeout(() => setShowActionError(false), 400);
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
      updateProject(currentProjectId!, { priority: priorities[newIndex] });
    }
  }, [project, currentProjectId, updateProject]);

  // Get filtered projects for mention popup
  const filteredMentionProjects = useMemo(() => {
    return projects.filter((p) =>
      p.name.toLowerCase().includes(mentionSearchText.toLowerCase())
    );
  }, [projects, mentionSearchText]);

  // Handle mention popup keyboard navigation
  const handleMentionKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (!mentionPopupOpen) return false;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setMentionSelectedIndex((prev) =>
        Math.min(prev + 1, Math.min(filteredMentionProjects.length - 1, 7))
      );
      return true;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setMentionSelectedIndex((prev) => Math.max(prev - 1, 0));
      return true;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const selectedProject = filteredMentionProjects[mentionSelectedIndex];
      if (selectedProject) {
        insertMentionProject(selectedProject);
      }
      return true;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      closeMentionPopup();
      return true;
    }

    return false;
  }, [mentionPopupOpen, filteredMentionProjects, mentionSelectedIndex]);

  // Insert selected project into the current input
  const insertMentionProject = useCallback((selectedProject: { name: string }) => {
    const projectRef = `#${selectedProject.name}`;

    if (mentionInputType === 'newTask' || mentionInputType === 'newNote') {
      const currentText = mentionInputType === 'newTask' ? newTaskText : newNoteText;
      const beforeMention = currentText.substring(0, mentionStartIndex);
      const afterMention = currentText.substring(mentionStartIndex + 1 + mentionSearchText.length);
      const newText = beforeMention + projectRef + afterMention;

      if (mentionInputType === 'newTask') {
        setNewTaskText(newText);
      } else {
        setNewNoteText(newText);
      }
    } else if (mentionInputType === 'editTask') {
      const beforeMention = editingTaskText.substring(0, mentionStartIndex);
      const afterMention = editingTaskText.substring(mentionStartIndex + 1 + mentionSearchText.length);
      setEditingTaskText(beforeMention + projectRef + afterMention);
    } else if (mentionInputType === 'editNote') {
      const beforeMention = editingNoteText.substring(0, mentionStartIndex);
      const afterMention = editingNoteText.substring(mentionStartIndex + 1 + mentionSearchText.length);
      setEditingNoteText(beforeMention + projectRef + afterMention);
    }

    closeMentionPopup();
  }, [mentionInputType, mentionStartIndex, mentionSearchText, newTaskText, newNoteText, editingTaskText, editingNoteText]);

  // Close mention popup
  const closeMentionPopup = useCallback(() => {
    setMentionPopupOpen(false);
    setMentionSearchText('');
    setMentionSelectedIndex(0);
    setMentionInputType(null);
  }, []);

  // Check for # trigger in text and open mention popup
  const checkForMentionTrigger = useCallback((
    text: string,
    cursorPosition: number,
    inputType: 'newTask' | 'newNote' | 'editTask' | 'editNote',
    inputElement: HTMLInputElement | HTMLTextAreaElement | null
  ) => {
    // Find the last # before cursor that isn't followed by a space before cursor
    let hashIndex = -1;
    for (let i = cursorPosition - 1; i >= 0; i--) {
      if (text[i] === '#') {
        hashIndex = i;
        break;
      }
      // If we hit a space or newline, stop looking
      if (text[i] === ' ' || text[i] === '\n') {
        break;
      }
    }

    if (hashIndex >= 0) {
      const searchText = text.substring(hashIndex + 1, cursorPosition);
      setMentionSearchText(searchText);
      setMentionStartIndex(hashIndex);
      setMentionSelectedIndex(0);
      setMentionInputType(inputType);

      // Calculate popup position
      if (inputElement) {
        const rect = inputElement.getBoundingClientRect();
        setMentionPosition({
          top: rect.bottom + 4,
          left: rect.left,
        });
      }

      setMentionPopupOpen(true);
    } else {
      if (mentionPopupOpen) {
        closeMentionPopup();
      }
    }
  }, [mentionPopupOpen, closeMentionPopup]);

  // Focus management
  useEffect(() => {
    if (isTypingNewTask && newTaskInputRef.current) {
      newTaskInputRef.current.focus();
    }
  }, [isTypingNewTask]);

  useEffect(() => {
    if (editingTaskId && editTaskInputRef.current) {
      const input = editTaskInputRef.current;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }, [editingTaskId]);

  useEffect(() => {
    if (editingNoteId && editNoteInputRef.current) {
      const textarea = editNoteInputRef.current;
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }
  }, [editingNoteId]);

  useEffect(() => {
    if (isRenamingProject && projectNameInputRef.current) {
      const input = projectNameInputRef.current;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }, [isRenamingProject]);

  useEffect(() => {
    if (isEditingSubtitle && subtitleInputRef.current) {
      const input = subtitleInputRef.current;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }, [isEditingSubtitle]);

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
      if (showHelp || taskToDelete || noteToDelete || showDoneConfirm) return;

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
        } else if (isEditingSubtitle) {
          setIsEditingSubtitle(false);
          setSubtitleEdit('');
        } else if (selectedTaskId || selectedNoteId) {
          setSelectedTaskId(null);
          setSelectedNoteId(null);
        } else {
          goToOverview();
        }
        return;
      }

      // Handle F2 for renaming project (only when not in edit mode)
      if (e.key === 'F2' && !isTypingNewTask && !isTypingNewNote && !editingTaskId && !editingNoteId && !isRenamingProject && !isEditingSubtitle && project && !project.isOther) {
        e.preventDefault();
        setIsRenamingProject(true);
        return;
      }

      // Handle F3 for editing subtitle (only when not in edit mode)
      if (e.key === 'F3' && !isTypingNewTask && !isTypingNewNote && !editingTaskId && !editingNoteId && !isRenamingProject && !isEditingSubtitle && project && !project.isOther) {
        e.preventDefault();
        setSubtitleEdit(project.subtitle || '');
        setIsEditingSubtitle(true);
        return;
      }

      // Handle ? for help
      if (e.key === '?' && !isTypingNewTask && !isTypingNewNote && !editingTaskId && !editingNoteId && !isRenamingProject) {
        e.preventDefault();
        setShowHelp(true);
        return;
      }

      // Handle Ctrl+D for marking project as done
      if (e.ctrlKey && e.key === 'd' && !isTypingNewTask && !isTypingNewNote && !editingTaskId && !editingNoteId && !isRenamingProject && project && !project.isOther && !project.doneAt) {
        e.preventDefault();
        setShowDoneConfirm(true);
        return;
      }

      // Handle Ctrl+H for toggling on hold status
      if (e.ctrlKey && e.key === 'h' && !isTypingNewTask && !isTypingNewNote && !editingTaskId && !editingNoteId && !isRenamingProject && project && !project.isOther) {
        e.preventDefault();
        // Don't allow toggling on-hold for done projects
        if (project.doneAt) {
          setShowActionError(true);
          setTimeout(() => setShowActionError(false), 400);
          return;
        }
        toggleProjectOnHold(currentProjectId!);
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

      // If typing a new task or note, let the input's onKeyDown handle Enter
      if (isTypingNewTask || isTypingNewNote) {
        return;
      }

      // Handle Enter for editing selected task or note
      if (e.key === 'Enter') {
        e.preventDefault();
        if (effectiveActiveColumn === 'tasks' && selectedTaskId) {
          const task = flattenedTasks.find((t) => t.id === selectedTaskId);
          if (task) {
            setEditingTaskId(task.id);
            setEditingTaskText(task.description);
          }
        } else if (effectiveActiveColumn === 'notes' && selectedNoteId) {
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
        if (effectiveActiveColumn === 'tasks' && selectedTaskId) {
          setTaskToDelete(selectedTaskId);
        } else if (effectiveActiveColumn === 'notes' && selectedNoteId) {
          setNoteToDelete(selectedNoteId);
        }
        return;
      }

      // Handle Space for toggling todo completion or duplicating task
      if (e.key === ' ' && !isTypingNewTask && !isTypingNewNote && !editingTaskId && !editingNoteId && !isRenamingProject && !isEditingSubtitle) {
        e.preventDefault();
        // For ToDo project: toggle note completion
        if (project?.isTodo && selectedNoteId) {
          toggleNoteCompleted(selectedNoteId);
          return;
        }
        // For regular projects: duplicate selected task
        if (effectiveActiveColumn === 'tasks' && selectedTaskId) {
          // Don't allow adding tasks to done projects or in browse mode
          if (project?.doneAt || browseMode) {
            setShowActionError(true);
            setTimeout(() => setShowActionError(false), 400);
            return;
          }
          const task = flattenedTasks.find((t) => t.id === selectedTaskId);
          if (task && currentProjectId) {
            createTask(currentProjectId, task.description);
          }
        }
        return;
      }

      // Handle Left/Right arrow keys for column switching (skip for ToDo projects and when editing subtitle)
      if (e.key === 'ArrowLeft' && effectiveActiveColumn === 'notes' && !project?.isTodo && !isEditingSubtitle) {
        e.preventDefault();
        setActiveColumn('tasks');
        setSelectedNoteId(null);
        if (flattenedTasks.length > 0 && !selectedTaskId) {
          setSelectedTaskId(flattenedTasks[0].id);
        }
        return;
      }

      if (e.key === 'ArrowRight' && effectiveActiveColumn === 'tasks' && !project?.isTodo && !isEditingSubtitle) {
        e.preventDefault();
        setActiveColumn('notes');
        setSelectedTaskId(null);
        if (flattenedNotes.length > 0 && !selectedNoteId) {
          setSelectedNoteId(flattenedNotes[0].id);
        }
        return;
      }

      // Handle Ctrl+Up/Down for project priority
      if (e.ctrlKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        cyclePriority(e.key === 'ArrowUp' ? 'up' : 'down');
        return;
      }

      // Handle Up/Down arrow keys for navigation within column
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (effectiveActiveColumn === 'tasks' && flattenedTasks.length > 0) {
          if (!selectedTaskId) {
            setSelectedTaskId(flattenedTasks[0].id);
          } else {
            const currentIndex = flattenedTasks.findIndex((t) => t.id === selectedTaskId);
            if (currentIndex > 0) {
              setSelectedTaskId(flattenedTasks[currentIndex - 1].id);
            }
          }
        } else if (effectiveActiveColumn === 'notes' && flattenedNotes.length > 0) {
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
        if (effectiveActiveColumn === 'tasks' && flattenedTasks.length > 0) {
          if (!selectedTaskId) {
            setSelectedTaskId(flattenedTasks[0].id);
          } else {
            const currentIndex = flattenedTasks.findIndex((t) => t.id === selectedTaskId);
            if (currentIndex < flattenedTasks.length - 1) {
              setSelectedTaskId(flattenedTasks[currentIndex + 1].id);
            }
          }
        } else if (effectiveActiveColumn === 'notes' && flattenedNotes.length > 0) {
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
        !editingNoteId &&
        !isRenamingProject &&
        !isEditingSubtitle
      ) {
        e.preventDefault();
        if (effectiveActiveColumn === 'tasks') {
          setIsTypingNewTask(true);
          setNewTaskText(e.key);
          setSelectedTaskId(null);
        } else {
          setIsTypingNewNote(true);
          setNewNoteText(e.key);
          setSelectedNoteId(null);
        }
        // Immediately focus the input so subsequent keystrokes go directly to it
        newTaskInputRef.current?.focus();
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    showHelp,
    taskToDelete,
    noteToDelete,
    showDoneConfirm,
    isTypingNewTask,
    isTypingNewNote,
    editingTaskId,
    editingNoteId,
    isRenamingProject,
    isEditingSubtitle,
    selectedTaskId,
    selectedNoteId,
    activeColumn,
    effectiveActiveColumn,
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
    toggleProjectOnHold,
    toggleNoteCompleted,
    currentProjectId,
    project,
    tasks,
    notes,
    cyclePriority,
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

  const handleMarkDoneConfirm = useCallback(() => {
    if (currentProjectId) {
      markProjectDone(currentProjectId);
      setShowDoneConfirm(false);
      goToOverview();
    }
  }, [currentProjectId, markProjectDone, goToOverview]);

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
      {browseMode && (
        <div className="browse-mode-banner">
          <span>Browse Mode - Tasks disabled</span>
          <button className="start-work-btn" onClick={exitBrowseMode}>
            Start Working
          </button>
        </div>
      )}
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
            <h1 className={`project-title ${showActionError ? 'error-shake' : ''}`}>
              {project.priority === 'high' && <span className="priority-indicator">‼️</span>}
              {project.priority === 'medium' && <span className="priority-indicator">❗</span>}
              {project.name || 'Unnamed Project'}
              {project.isOther && <span className="tag">Special</span>}
            </h1>
          )}

          {isEditingSubtitle ? (
            <input
              ref={subtitleInputRef}
              type="text"
              className="project-subtitle-input"
              placeholder="Add a subtitle..."
              value={subtitleEdit}
              onChange={(e) => setSubtitleEdit(e.target.value)}
              onBlur={() => {
                updateProject(currentProjectId!, { subtitle: subtitleEdit || undefined });
                setIsEditingSubtitle(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  updateProject(currentProjectId!, { subtitle: subtitleEdit || undefined });
                  setIsEditingSubtitle(false);
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  e.stopPropagation();
                  setSubtitleEdit(project.subtitle || '');
                  setIsEditingSubtitle(false);
                }
                // Allow normal input behavior for arrow keys
                if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                  e.stopPropagation();
                }
              }}
            />
          ) : (
            !project.isOther && (
              <div
                className={`project-subtitle ${!project.subtitle ? 'empty' : ''}`}
                onClick={() => {
                  setSubtitleEdit(project.subtitle || '');
                  setIsEditingSubtitle(true);
                }}
                title="Click to edit subtitle (F3)"
              >
                {project.subtitle || 'Add subtitle...'}
              </div>
            )
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
            {project.doneAt && (
              <span className="tag done" data-tooltip={getTooltipDate(project.doneAt)}>
                Done: {formatDateFull(project.doneAt)}
              </span>
            )}
            {project.onHoldAt && (
              <span className="tag on-hold" data-tooltip={getTooltipDate(project.onHoldAt)}>
                On Hold: {formatDateFull(project.onHoldAt)}
              </span>
            )}
            {projectNoteTags.map((tag) => (
              <span key={tag.content} className={`tag tag-${tag.type}`} title={NOTE_TAG_PATTERNS[tag.type].label}>
                {tag.content}
              </span>
            ))}
          </div>
        </div>

        {!project.isOther && (
          <div className="project-actions">
            {!project.doneAt && (
              <button
                className="done-button"
                onClick={() => setShowDoneConfirm(true)}
                title="Mark project as done (Ctrl+D)"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                <span className="action-label">Done</span>
              </button>
            )}

            {project.doneAt && (
              <button
                className="reopen-button"
                onClick={() => reopenProject(currentProjectId!)}
                title="Reopen project"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                  <path d="M21 3v5h-5"/>
                  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                  <path d="M3 21v-5h5"/>
                </svg>
                <span className="action-label">Reopen</span>
              </button>
            )}

            <button
              className={`hold-button ${project.onHoldAt ? 'active' : ''} ${project.doneAt ? 'disabled' : ''}`}
              onClick={() => {
                if (project.doneAt) {
                  setShowActionError(true);
                  setTimeout(() => setShowActionError(false), 400);
                  return;
                }
                toggleProjectOnHold(currentProjectId!);
              }}
              title={project.doneAt ? 'Cannot toggle hold on done project' : project.onHoldAt ? 'Resume project (Ctrl+H)' : 'Put on hold (Ctrl+H)'}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="6" y="4" width="4" height="16"/>
                <rect x="14" y="4" width="4" height="16"/>
              </svg>
              <span className="action-label">{project.onHoldAt ? 'Resume' : 'Hold'}</span>
            </button>
          </div>
        )}

        <TimerIndicator
          globalDuration={getTodayGlobalDuration()}
          taskDuration={getCurrentTaskDuration()}
          isActive={globalTimerActive}
          activeTaskInfo={getActiveTaskInfo()}
          onProjectClick={goToProject}
        />
      </div>

      <div className="input-with-mention">
        <input
          ref={newTaskInputRef}
          type="text"
          className={`new-task-input ${isTypingNewTask || isTypingNewNote ? 'typing' : ''} ${showInputError ? 'error-shake' : ''}`}
          placeholder={effectiveActiveColumn === 'tasks' ? 'Start typing to create a new task...' : (project?.isTodo ? 'Start typing to add a todo item...' : 'Start typing to create a new note...')}
          value={effectiveActiveColumn === 'tasks' ? newTaskText : newNoteText}
          onChange={(e) => {
            const value = e.target.value;
            const cursorPos = e.target.selectionStart || 0;
            if (effectiveActiveColumn === 'tasks') {
              setNewTaskText(value);
              if (!value) {
                setIsTypingNewTask(false);
                newTaskInputRef.current?.blur();
                closeMentionPopup();
              } else if (!isTypingNewTask) {
                setIsTypingNewTask(true);
              }
              checkForMentionTrigger(value, cursorPos, 'newTask', e.target);
            } else {
              setNewNoteText(value);
              if (!value) {
                setIsTypingNewNote(false);
                newTaskInputRef.current?.blur();
                closeMentionPopup();
              } else if (!isTypingNewNote) {
                setIsTypingNewNote(true);
              }
              checkForMentionTrigger(value, cursorPos, 'newNote', e.target);
            }
          }}
          onKeyDown={(e) => {
            // Handle mention popup navigation first
            if (handleMentionKeyDown(e)) {
              return;
            }
            if (e.key === 'Enter') {
              e.preventDefault();
              if (effectiveActiveColumn === 'tasks' && newTaskText.trim()) {
                // Block task creation for done projects or browse mode - shake the input
                if (project?.doneAt || browseMode) {
                  setShowInputError(true);
                  setTimeout(() => setShowInputError(false), 400);
                  return;
                }
                createTask(currentProjectId!, newTaskText.trim()).then(() => {
                  setNewTaskText('');
                  setIsTypingNewTask(false);
                  newTaskInputRef.current?.blur();
                });
              } else if (effectiveActiveColumn === 'notes' && newNoteText.trim()) {
                createNote(currentProjectId!, newNoteText.trim()).then(() => {
                  setNewNoteText('');
                  setIsTypingNewNote(false);
                  newTaskInputRef.current?.blur();
                });
              }
            }
          }}
          onFocus={() => {
            if (effectiveActiveColumn === 'tasks') {
              setIsTypingNewTask(true);
            } else {
              setIsTypingNewNote(true);
            }
          }}
          onBlur={() => {
            if (effectiveActiveColumn === 'tasks' && !newTaskText.trim()) {
              setIsTypingNewTask(false);
            } else if (effectiveActiveColumn === 'notes' && !newNoteText.trim()) {
              setIsTypingNewNote(false);
            }
            // Delay closing mention popup to allow click on items
            setTimeout(() => {
              if (mentionInputType === 'newTask' || mentionInputType === 'newNote') {
                closeMentionPopup();
              }
            }, 200);
          }}
        />
        <ProjectMentionPopup
          isOpen={mentionPopupOpen && (mentionInputType === 'newTask' || mentionInputType === 'newNote')}
          projects={projects}
          searchText={mentionSearchText}
          selectedIndex={mentionSelectedIndex}
          position={mentionPosition}
          onSelect={insertMentionProject}
          onClose={closeMentionPopup}
        />
      </div>

      <div className={`columns-container ${project?.isTodo ? 'todo-only' : ''}`}>
        {/* Tasks Column - hidden for ToDo project */}
        {!project?.isTodo && (
        <div className={`column tasks-column ${effectiveActiveColumn === 'tasks' ? 'active-column' : ''}`}>
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
                      const isSelected = task.id === selectedTaskId && effectiveActiveColumn === 'tasks';
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
                            <div className="edit-input-with-mention">
                              <input
                                ref={editTaskInputRef}
                                type="text"
                                className="task-description-input"
                                value={editingTaskText}
                                onChange={(e) => {
                                  setEditingTaskText(e.target.value);
                                  const cursorPos = e.target.selectionStart || 0;
                                  checkForMentionTrigger(e.target.value, cursorPos, 'editTask', e.target);
                                }}
                                onKeyDown={(e) => {
                                  if (handleMentionKeyDown(e)) {
                                    return;
                                  }
                                }}
                                onBlur={() => {
                                  updateTask(task.id, { description: editingTaskText });
                                  setEditingTaskId(null);
                                  setEditingTaskText('');
                                  setTimeout(() => {
                                    if (mentionInputType === 'editTask') {
                                      closeMentionPopup();
                                    }
                                  }, 200);
                                }}
                              />
                              <ProjectMentionPopup
                                isOpen={mentionPopupOpen && mentionInputType === 'editTask'}
                                projects={projects}
                                searchText={mentionSearchText}
                                selectedIndex={mentionSelectedIndex}
                                position={mentionPosition}
                                onSelect={insertMentionProject}
                                onClose={closeMentionPopup}
                              />
                            </div>
                          ) : (
                            <span className="task-description">
                              <TextWithProjectRefs
                                text={task.description}
                                projects={projects}
                                onProjectClick={goToProject}
                              />
                            </span>
                          )}

                          <span className={`task-duration ${isActive ? 'active' : ''}`}>
                            {formatDuration(duration)}
                          </span>

                          {!isEditing && (
                            <button
                              className="edit-button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingTaskId(task.id);
                                setEditingTaskText(task.description);
                              }}
                              title="Edit task"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                            </button>
                          )}
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
        )}

        {/* Notes Column */}
        <div className={`column notes-column ${effectiveActiveColumn === 'notes' ? 'active-column' : ''}`}>
          <div
            className="column-header"
            onClick={() => {
              setActiveColumn('notes');
              setSelectedTaskId(null);
            }}
          >
            {project?.isTodo ? 'ToDo Items' : 'Notes'}
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
                      const isSelected = note.id === selectedNoteId && effectiveActiveColumn === 'notes';
                      const isEditing = note.id === editingNoteId;
                      const noteTagType = detectNoteTagType(note.content);

                      return (
                        <div
                          key={note.id}
                          className={`note-item ${isSelected ? 'selected' : ''} ${note.completed ? 'completed' : ''} ${noteTagType ? `note-tag-${noteTagType}` : ''}`}
                          onClick={() => {
                            if (!isEditing) {
                              setActiveColumn('notes');
                              setSelectedNoteId(note.id);
                              setSelectedTaskId(null);
                            }
                          }}
                        >
                          {project?.isTodo && (
                            <span
                              className={`todo-checkbox ${note.completed ? 'checked' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleNoteCompleted(note.id);
                              }}
                            >
                              {note.completed ? '☑' : '☐'}
                            </span>
                          )}
                          {!project?.isTodo && (
                            <span className="note-time">{formatTime(note.createdAt)}</span>
                          )}

                          {isEditing ? (
                            <div className="edit-input-with-mention">
                              <textarea
                                ref={editNoteInputRef}
                                className="note-content-input"
                                value={editingNoteText}
                                onChange={(e) => {
                                  setEditingNoteText(e.target.value);
                                  const cursorPos = e.target.selectionStart || 0;
                                  checkForMentionTrigger(e.target.value, cursorPos, 'editNote', e.target);
                                }}
                                onKeyDown={(e) => {
                                  if (handleMentionKeyDown(e)) {
                                    return;
                                  }
                                }}
                                onBlur={() => {
                                  updateNote(note.id, { content: editingNoteText });
                                  setEditingNoteId(null);
                                  setEditingNoteText('');
                                  setTimeout(() => {
                                    if (mentionInputType === 'editNote') {
                                      closeMentionPopup();
                                    }
                                  }, 200);
                                }}
                              />
                              <ProjectMentionPopup
                                isOpen={mentionPopupOpen && mentionInputType === 'editNote'}
                                projects={projects}
                                searchText={mentionSearchText}
                                selectedIndex={mentionSelectedIndex}
                                position={mentionPosition}
                                onSelect={insertMentionProject}
                                onClose={closeMentionPopup}
                              />
                            </div>
                          ) : (
                            <span className="note-content">
                              <TextWithProjectRefs
                                text={note.content}
                                projects={projects}
                                onProjectClick={goToProject}
                              />
                            </span>
                          )}

                          {!isEditing && (
                            <button
                              className="edit-button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingNoteId(note.id);
                                setEditingNoteText(note.content);
                              }}
                              title="Edit note"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                            </button>
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
                  {project?.isTodo ? 'No todo items yet. Start typing to add one.' : 'No notes yet. Start typing to add one.'}
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

      <ConfirmDialog
        isOpen={showDoneConfirm}
        onConfirm={handleMarkDoneConfirm}
        onCancel={() => setShowDoneConfirm(false)}
        message="Are you sure you want to mark this project as done?"
        confirmText="Mark Done"
      />

          </div>
  );
}
