import { useState, useCallback, useEffect } from 'react';
import { Modal } from './Modal';
import { ConfirmDialog } from './ConfirmDialog';
import type { Task, Project, GlobalTimer } from '../types';
import { formatTime, formatDuration, isTimestampToday, getTodayDateString } from '../utils/time';

interface TodayOverviewPopupProps {
  isOpen: boolean;
  onClose: () => void;
  globalTimers: GlobalTimer[];
  tasks: Task[];
  projects: Project[];
  activeTaskId?: string | null;
  onUpdateTimerTimes?: (timerId: string, newStartTime: number, newEndTime: number) => Promise<void>;
  onUpdateTaskTimes?: (taskId: string, newStartTime: number, newEndTime?: number) => Promise<void>;
  onDeleteTask?: (taskId: string) => Promise<void>;
  onProjectClick?: (projectId: string) => void;
}

export function TodayOverviewPopup({
  isOpen,
  onClose,
  globalTimers,
  tasks,
  projects,
  activeTaskId,
  onUpdateTimerTimes,
  onUpdateTaskTimes,
  onDeleteTask,
  onProjectClick,
}: TodayOverviewPopupProps) {
  const today = getTodayDateString();
  const todayTimers = globalTimers.filter((t) => t.date === today).sort((a, b) => a.startTime - b.startTime);

  // Session editing state
  const [editingTimerId, setEditingTimerId] = useState<string | null>(null);
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  // Task editing state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskEditStartTime, setTaskEditStartTime] = useState('');
  const [taskEditEndTime, setTaskEditEndTime] = useState('');
  const [taskEditError, setTaskEditError] = useState<string | null>(null);

  // Task delete state
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

  const startEditing = useCallback((timer: GlobalTimer) => {
    if (!timer.endTime) return; // Can't edit ongoing sessions
    const startDate = new Date(timer.startTime);
    const endDate = new Date(timer.endTime);
    setEditStartTime(`${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')}`);
    setEditEndTime(`${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`);
    setEditingTimerId(timer.id);
    setEditError(null);
  }, []);

  const startTaskEditing = useCallback((task: Task) => {
    const startDate = new Date(task.startTime);
    setTaskEditStartTime(`${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')}`);
    if (task.endTime) {
      const endDate = new Date(task.endTime);
      setTaskEditEndTime(`${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`);
    } else {
      setTaskEditEndTime('');
    }
    setEditingTaskId(task.id);
    setTaskEditError(null);
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingTimerId(null);
    setEditError(null);
    setEditingTaskId(null);
    setTaskEditError(null);
  }, []);

  // Handle close - first cancel editing if active, then close popup
  const handleClose = useCallback(() => {
    if (editingTimerId || editingTaskId) {
      cancelEditing();
    } else {
      onClose();
    }
  }, [editingTimerId, editingTaskId, cancelEditing, onClose]);

  // Handle ESC key - cancel editing first, then close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (editingTimerId || editingTaskId) {
          cancelEditing();
        } else {
          onClose();
        }
      }
    };

    // Use capture phase to intercept before Modal's handler
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, editingTimerId, editingTaskId, cancelEditing, onClose]);

  const saveEditing = useCallback(async () => {
    if (!editingTimerId || !onUpdateTimerTimes) return;

    const timer = todayTimers.find(t => t.id === editingTimerId);
    if (!timer) return;

    const [startHours, startMinutes] = editStartTime.split(':').map(Number);
    const [endHours, endMinutes] = editEndTime.split(':').map(Number);

    if (isNaN(startHours) || isNaN(startMinutes) || isNaN(endHours) || isNaN(endMinutes)) {
      setEditError('Invalid time format');
      return;
    }

    const newStartDate = new Date(timer.startTime);
    newStartDate.setHours(startHours, startMinutes, 0, 0);
    const newStartTime = newStartDate.getTime();

    const newEndDate = new Date(timer.startTime);
    newEndDate.setHours(endHours, endMinutes, 0, 0);
    const newEndTime = newEndDate.getTime();

    // Validate: end must be after start
    if (newEndTime <= newStartTime) {
      setEditError('End time must be after start time');
      return;
    }

    // Validate: times cannot be in the future
    if (newEndTime > Date.now()) {
      setEditError('End time cannot be in the future');
      return;
    }

    // Find adjacent timers for boundary validation
    const timerIndex = todayTimers.findIndex(t => t.id === editingTimerId);
    const prevTimer = timerIndex > 0 ? todayTimers[timerIndex - 1] : null;
    const nextTimer = timerIndex < todayTimers.length - 1 ? todayTimers[timerIndex + 1] : null;

    // Validate: cannot overlap with previous session
    if (prevTimer && prevTimer.endTime && newStartTime < prevTimer.endTime) {
      setEditError(`Start time cannot be before previous session ended (${formatTime(prevTimer.endTime)})`);
      return;
    }

    // Validate: cannot overlap with next session
    if (nextTimer && newEndTime > nextTimer.startTime) {
      setEditError(`End time cannot be after next session started (${formatTime(nextTimer.startTime)})`);
      return;
    }

    await onUpdateTimerTimes(editingTimerId, newStartTime, newEndTime);
    setEditingTimerId(null);
    setEditError(null);
  }, [editingTimerId, editStartTime, editEndTime, todayTimers, onUpdateTimerTimes]);

  const todayTasks = tasks.filter((t) => isTimestampToday(t.startTime)).sort((a, b) => a.startTime - b.startTime);

  const saveTaskEditing = useCallback(async () => {
    if (!editingTaskId || !onUpdateTaskTimes) return;

    const task = todayTasks.find(t => t.id === editingTaskId);
    if (!task) return;

    const [startHours, startMinutes] = taskEditStartTime.split(':').map(Number);

    if (isNaN(startHours) || isNaN(startMinutes)) {
      setTaskEditError('Invalid start time format');
      return;
    }

    const newStartDate = new Date(task.startTime);
    newStartDate.setHours(startHours, startMinutes, 0, 0);
    const newStartTime = newStartDate.getTime();

    let newEndTime: number | undefined;
    if (taskEditEndTime) {
      const [endHours, endMinutes] = taskEditEndTime.split(':').map(Number);

      if (isNaN(endHours) || isNaN(endMinutes)) {
        setTaskEditError('Invalid end time format');
        return;
      }

      const newEndDate = new Date(task.startTime);
      newEndDate.setHours(endHours, endMinutes, 0, 0);
      newEndTime = newEndDate.getTime();

      // Validate: end must be after start
      if (newEndTime <= newStartTime) {
        setTaskEditError('End time must be after start time');
        return;
      }

      // Validate: end time cannot be in the future
      if (newEndTime > Date.now()) {
        setTaskEditError('End time cannot be in the future');
        return;
      }
    }

    // Validate: start time cannot be in the future
    if (newStartTime > Date.now()) {
      setTaskEditError('Start time cannot be in the future');
      return;
    }

    await onUpdateTaskTimes(editingTaskId, newStartTime, newEndTime);
    setEditingTaskId(null);
    setTaskEditError(null);
  }, [editingTaskId, taskEditStartTime, taskEditEndTime, todayTasks, onUpdateTaskTimes]);

  // Calculate total work time
  const totalWorkTime = todayTimers.reduce((total, timer) => {
    const endTime = timer.endTime || Date.now();
    return total + (endTime - timer.startTime);
  }, 0);

  // Calculate time per project
  const projectDurations = new Map<string, number>();
  for (const task of todayTasks) {
    const duration =
      task.duration || (task.endTime ? task.endTime - task.startTime : Date.now() - task.startTime);
    const existing = projectDurations.get(task.projectId) || 0;
    projectDurations.set(task.projectId, existing + duration);
  }

  // Sort projects by duration
  const sortedProjects = [...projectDurations.entries()].sort((a, b) => b[1] - a[1]);

  // Calculate total project time
  const totalProjectTime = sortedProjects.reduce((total, [, duration]) => total + duration, 0);

  // Get max duration for bar scaling
  const maxDuration = sortedProjects.length > 0 ? sortedProjects[0][1] : 0;

  const handleProjectClick = useCallback((projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onProjectClick) {
      onClose();
      onProjectClick(projectId);
    }
  }, [onProjectClick, onClose]);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Today's Overview" wide>
      <div className="overview-stats">
        <div className="stat-card">
          <div className="stat-value">{formatDuration(totalWorkTime)}</div>
          <div className="stat-label">Total Work Time</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{formatDuration(totalProjectTime)}</div>
          <div className="stat-label">Project Time</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{todayTasks.length}</div>
          <div className="stat-label">Tasks Today</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{projectDurations.size}</div>
          <div className="stat-label">Projects Worked</div>
        </div>
      </div>

      <div className="overview-two-columns">
        <div className="overview-column">
          <div className="work-sessions">
            <h4>Work Sessions</h4>
            {todayTimers.length === 0 ? (
              <p className="empty-state-text">No work sessions today</p>
            ) : (
              todayTimers.map((timer) => {
                const endTime = timer.endTime || Date.now();
                const duration = endTime - timer.startTime;
                const isEditing = editingTimerId === timer.id;
                const canEdit = timer.endTime && onUpdateTimerTimes;

                if (isEditing) {
                  return (
                    <div key={timer.id} className="session-item editing">
                      <div className="session-edit-row">
                        <input
                          type="time"
                          value={editStartTime}
                          onChange={(e) => { setEditError(null); setEditStartTime(e.target.value); }}
                          className="session-time-input"
                        />
                        <span className="session-time-separator">-</span>
                        <input
                          type="time"
                          value={editEndTime}
                          onChange={(e) => { setEditError(null); setEditEndTime(e.target.value); }}
                          className="session-time-input"
                        />
                        <button className="session-edit-btn save" onClick={saveEditing} title="Save">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        </button>
                        <button className="session-edit-btn cancel" onClick={cancelEditing} title="Cancel">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      </div>
                      {editError && <div className="session-edit-error">{editError}</div>}
                    </div>
                  );
                }

                return (
                  <div
                    key={timer.id}
                    className={`session-item ${canEdit ? 'editable' : ''}`}
                    onClick={() => canEdit && startEditing(timer)}
                    title={canEdit ? 'Click to edit times' : undefined}
                  >
                    <span className="session-time">
                      {formatTime(timer.startTime)} - {timer.endTime ? formatTime(timer.endTime) : 'ongoing'}
                    </span>
                    <span className="session-duration">({formatDuration(duration)})</span>
                    {canEdit && (
                      <span className="session-edit-icon">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="project-breakdown">
            <h4>Project Breakdown</h4>
            {sortedProjects.length === 0 ? (
              <p className="empty-state-text">No project work today</p>
            ) : (
              sortedProjects.map(([projectId, duration]) => {
                const project = projects.find((p) => p.id === projectId);
                const projectName = project?.name || projectId;
                const percentage = maxDuration > 0 ? (duration / maxDuration) * 100 : 0;

                return (
                  <div key={projectId} className="breakdown-item">
                    <span
                      className={`breakdown-label ${onProjectClick ? 'clickable' : ''}`}
                      onClick={(e) => handleProjectClick(projectId, e)}
                    >
                      {projectName}
                    </span>
                    <div className="breakdown-bar-container">
                      <div className="breakdown-bar" style={{ width: `${percentage}%` }} />
                    </div>
                    <span className="breakdown-value">{formatDuration(duration)}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="overview-column">
          <div className="tasks-today">
            <h4>Tasks Today</h4>
            {todayTasks.length === 0 ? (
              <p className="empty-state-text">No tasks today</p>
            ) : (
              todayTasks.map((task) => {
                const project = projects.find((p) => p.id === task.projectId);
                const projectName = project?.name || 'Unknown';
                const endTime = task.endTime || Date.now();
                const duration = task.duration || (endTime - task.startTime);
                const isEditing = editingTaskId === task.id;
                const isActive = task.id === activeTaskId;
                const canEdit = onUpdateTaskTimes !== undefined;

                if (isEditing) {
                  return (
                    <div key={task.id} className="session-item editing">
                      <div className="session-edit-row">
                        <input
                          type="time"
                          value={taskEditStartTime}
                          onChange={(e) => { setTaskEditError(null); setTaskEditStartTime(e.target.value); }}
                          className="session-time-input"
                        />
                        <span className="session-time-separator">-</span>
                        <input
                          type="time"
                          value={taskEditEndTime}
                          onChange={(e) => { setTaskEditError(null); setTaskEditEndTime(e.target.value); }}
                          className="session-time-input"
                          placeholder={isActive ? 'ongoing' : undefined}
                          disabled={isActive}
                        />
                        <button className="session-edit-btn save" onClick={saveTaskEditing} title="Save">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        </button>
                        <button className="session-edit-btn cancel" onClick={cancelEditing} title="Cancel">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      </div>
                      {taskEditError && <div className="session-edit-error">{taskEditError}</div>}
                    </div>
                  );
                }

                return (
                  <div
                    key={task.id}
                    className={`task-item-overview ${isActive ? 'active' : ''}`}
                  >
                    <div className="task-item-header">
                      <span className="session-time">
                        {formatTime(task.startTime)} - {task.endTime ? formatTime(task.endTime) : 'ongoing'}
                      </span>
                      <span
                        className={`task-project-name ${onProjectClick ? 'clickable' : ''}`}
                        onClick={(e) => handleProjectClick(task.projectId, e)}
                      >
                        {projectName}
                      </span>
                      <span className="session-duration">({formatDuration(duration)})</span>
                      <div className="task-actions-overview">
                        {canEdit && (
                          <button
                            className="task-edit-time-btn"
                            onClick={() => startTaskEditing(task)}
                            title="Edit times"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          </button>
                        )}
                        {onDeleteTask && !isActive && (
                          <button
                            className="task-delete-btn"
                            onClick={() => setTaskToDelete(task)}
                            title="Delete task"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6"/>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="task-item-description">{task.description}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!taskToDelete}
        onConfirm={async () => {
          if (taskToDelete && onDeleteTask) {
            await onDeleteTask(taskToDelete.id);
            setTaskToDelete(null);
          }
        }}
        onCancel={() => setTaskToDelete(null)}
        message="Are you sure you want to delete task"
        itemName={taskToDelete?.description}
      />
    </Modal>
  );
}
