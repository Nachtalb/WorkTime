import { useState, useCallback, useEffect } from 'react';
import { Modal } from './Modal';
import type { Task, Project, GlobalTimer } from '../types';
import { formatTime, formatDuration, isTimestampToday, getTodayDateString } from '../utils/time';

interface TodayOverviewPopupProps {
  isOpen: boolean;
  onClose: () => void;
  globalTimers: GlobalTimer[];
  tasks: Task[];
  projects: Project[];
  onUpdateTimerTimes?: (timerId: string, newStartTime: number, newEndTime: number) => Promise<void>;
}

export function TodayOverviewPopup({
  isOpen,
  onClose,
  globalTimers,
  tasks,
  projects,
  onUpdateTimerTimes,
}: TodayOverviewPopupProps) {
  const today = getTodayDateString();
  const todayTimers = globalTimers.filter((t) => t.date === today).sort((a, b) => a.startTime - b.startTime);

  // Editing state
  const [editingTimerId, setEditingTimerId] = useState<string | null>(null);
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  const startEditing = useCallback((timer: GlobalTimer) => {
    if (!timer.endTime) return; // Can't edit ongoing sessions
    const startDate = new Date(timer.startTime);
    const endDate = new Date(timer.endTime);
    setEditStartTime(`${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')}`);
    setEditEndTime(`${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`);
    setEditingTimerId(timer.id);
    setEditError(null);
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingTimerId(null);
    setEditError(null);
  }, []);

  // Handle close - first cancel editing if active, then close popup
  const handleClose = useCallback(() => {
    if (editingTimerId) {
      cancelEditing();
    } else {
      onClose();
    }
  }, [editingTimerId, cancelEditing, onClose]);

  // Handle ESC key - cancel editing first, then close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (editingTimerId) {
          cancelEditing();
        } else {
          onClose();
        }
      }
    };

    // Use capture phase to intercept before Modal's handler
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, editingTimerId, cancelEditing, onClose]);

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
  const todayTasks = tasks.filter((t) => isTimestampToday(t.startTime));

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

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Today's Overview">
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
                <span className="breakdown-label">{projectName}</span>
                <div className="breakdown-bar-container">
                  <div className="breakdown-bar" style={{ width: `${percentage}%` }} />
                </div>
                <span className="breakdown-value">{formatDuration(duration)}</span>
              </div>
            );
          })
        )}
      </div>
    </Modal>
  );
}
