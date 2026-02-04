import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Modal } from './Modal';
import { ConfirmDialog } from './ConfirmDialog';
import { Toast, useToast } from './Toast';
import type { Task, Project, GlobalTimer } from '../types';
import {
  formatTime,
  formatDuration,
  formatDate,
  getTodayDateString,
  getOverviewTitle,
  isDateInFuture,
} from '../utils/time';

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

// Get heatmap color intensity (0-1) based on work duration
// 4h = minimum visible, 10h = maximum intensity
function getHeatmapIntensity(durationMs: number): number {
  const hours = durationMs / (1000 * 60 * 60);
  const minHours = 4;
  const maxHours = 10;

  if (hours < minHours) return hours / minHours * 0.3; // Very light for < 4h
  const normalized = (Math.min(hours, maxHours) - minHours) / (maxHours - minHours);
  return 0.3 + normalized * 0.7; // 0.3 to 1.0 range
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
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [datePickerShake, setDatePickerShake] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return { year: today.getFullYear(), month: today.getMonth() };
  });
  const calendarRef = useRef<HTMLDivElement>(null);

  const { toasts, showToast, removeToast } = useToast();

  // Reset to today when popup opens
  useEffect(() => {
    if (isOpen) {
      setSelectedDate(getTodayDateString());
      const today = new Date();
      setCalendarMonth({ year: today.getFullYear(), month: today.getMonth() });
    }
  }, [isOpen]);

  // Close calendar when clicking outside
  useEffect(() => {
    if (!showCalendar) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        setShowCalendar(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCalendar]);

  // Get all dates that have data with their work durations
  const dateDataMap = useMemo(() => {
    const map = new Map<string, number>();

    // Calculate work duration from global timers
    for (const timer of globalTimers) {
      const duration = (timer.endTime || Date.now()) - timer.startTime;
      const existing = map.get(timer.date) || 0;
      map.set(timer.date, existing + duration);
    }

    // Also track dates with tasks (even if no timer)
    for (const task of tasks) {
      const dateStr = formatDate(task.startTime);
      if (!map.has(dateStr)) {
        map.set(dateStr, 0);
      }
    }

    return map;
  }, [globalTimers, tasks]);

  // Get sorted list of dates with data
  const sortedDatesWithData = useMemo(() => {
    return Array.from(dateDataMap.keys()).sort();
  }, [dateDataMap]);

  // Check if a date has data
  const hasDataForDate = useCallback((dateString: string) => {
    return dateDataMap.has(dateString);
  }, [dateDataMap]);

  // Find closest date with data in a direction
  const findClosestDateWithData = useCallback((fromDate: string, direction: 'prev' | 'next'): string | null => {
    const sortedDates = sortedDatesWithData;
    const currentIndex = sortedDates.indexOf(fromDate);

    if (direction === 'prev') {
      // Find the closest previous date
      if (currentIndex > 0) {
        return sortedDates[currentIndex - 1];
      }
      // If current date is not in list, find the closest one before it
      for (let i = sortedDates.length - 1; i >= 0; i--) {
        if (sortedDates[i] < fromDate) {
          return sortedDates[i];
        }
      }
    } else {
      // Find the closest next date
      const today = getTodayDateString();
      if (currentIndex >= 0 && currentIndex < sortedDates.length - 1) {
        const nextDate = sortedDates[currentIndex + 1];
        if (nextDate <= today) {
          return nextDate;
        }
      }
      // If current date is not in list, find the closest one after it
      for (let i = 0; i < sortedDates.length; i++) {
        if (sortedDates[i] > fromDate && sortedDates[i] <= today) {
          return sortedDates[i];
        }
      }
    }

    return null;
  }, [sortedDatesWithData]);

  // Filter data for selected date
  const selectedTimers = useMemo(() => {
    return globalTimers
      .filter((t) => t.date === selectedDate)
      .sort((a, b) => a.startTime - b.startTime);
  }, [globalTimers, selectedDate]);

  const selectedTasks = useMemo(() => {
    return tasks
      .filter((t) => formatDate(t.startTime) === selectedDate)
      .sort((a, b) => a.startTime - b.startTime);
  }, [tasks, selectedDate]);

  // Check if navigation is possible
  const canGoNext = useMemo(() => {
    return findClosestDateWithData(selectedDate, 'next') !== null;
  }, [selectedDate, findClosestDateWithData]);

  const canGoPrev = useMemo(() => {
    return findClosestDateWithData(selectedDate, 'prev') !== null;
  }, [selectedDate, findClosestDateWithData]);

  // Navigation handlers
  const goToNextDate = useCallback(() => {
    const nextDate = findClosestDateWithData(selectedDate, 'next');
    if (nextDate) {
      setSelectedDate(nextDate);
    }
  }, [selectedDate, findClosestDateWithData]);

  const goToPrevDate = useCallback(() => {
    const prevDate = findClosestDateWithData(selectedDate, 'prev');
    if (prevDate) {
      setSelectedDate(prevDate);
    }
  }, [selectedDate, findClosestDateWithData]);

  const handleDateSelect = useCallback((dateString: string) => {
    if (isDateInFuture(dateString)) {
      showToast('Cannot view future dates', 'error');
      setDatePickerShake(true);
      setTimeout(() => setDatePickerShake(false), 500);
      return;
    }

    if (!hasDataForDate(dateString)) {
      showToast('No data for this date', 'error');
      setDatePickerShake(true);
      setTimeout(() => setDatePickerShake(false), 500);
      return;
    }

    setSelectedDate(dateString);
    setShowCalendar(false);
  }, [hasDataForDate, showToast]);

  // Generate calendar days for current month view
  const calendarDays = useMemo(() => {
    const { year, month } = calendarMonth;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = (firstDay.getDay() + 6) % 7; // Monday = 0

    const days: { date: string; dayNum: number; isCurrentMonth: boolean; isToday: boolean; isFuture: boolean; hasData: boolean; intensity: number }[] = [];

    // Add days from previous month
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const day = prevMonthLastDay - i;
      const date = new Date(year, month - 1, day);
      const dateStr = formatDate(date.getTime());
      const duration = dateDataMap.get(dateStr) || 0;
      days.push({
        date: dateStr,
        dayNum: day,
        isCurrentMonth: false,
        isToday: dateStr === getTodayDateString(),
        isFuture: isDateInFuture(dateStr),
        hasData: hasDataForDate(dateStr),
        intensity: getHeatmapIntensity(duration),
      });
    }

    // Add days of current month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month, day);
      const dateStr = formatDate(date.getTime());
      const duration = dateDataMap.get(dateStr) || 0;
      days.push({
        date: dateStr,
        dayNum: day,
        isCurrentMonth: true,
        isToday: dateStr === getTodayDateString(),
        isFuture: isDateInFuture(dateStr),
        hasData: hasDataForDate(dateStr),
        intensity: getHeatmapIntensity(duration),
      });
    }

    // Add days from next month to fill the grid
    const remaining = 42 - days.length; // 6 rows * 7 days
    for (let day = 1; day <= remaining; day++) {
      const date = new Date(year, month + 1, day);
      const dateStr = formatDate(date.getTime());
      const duration = dateDataMap.get(dateStr) || 0;
      days.push({
        date: dateStr,
        dayNum: day,
        isCurrentMonth: false,
        isToday: dateStr === getTodayDateString(),
        isFuture: isDateInFuture(dateStr),
        hasData: hasDataForDate(dateStr),
        intensity: getHeatmapIntensity(duration),
      });
    }

    return days;
  }, [calendarMonth, dateDataMap, hasDataForDate]);

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];

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
        if (showCalendar) {
          setShowCalendar(false);
        } else if (editingTimerId || editingTaskId) {
          cancelEditing();
        } else {
          onClose();
        }
      }
    };

    // Use capture phase to intercept before Modal's handler
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, editingTimerId, editingTaskId, showCalendar, cancelEditing, onClose]);

  const saveEditing = useCallback(async () => {
    if (!editingTimerId || !onUpdateTimerTimes) return;

    const timer = selectedTimers.find(t => t.id === editingTimerId);
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
    const timerIndex = selectedTimers.findIndex(t => t.id === editingTimerId);
    const prevTimer = timerIndex > 0 ? selectedTimers[timerIndex - 1] : null;
    const nextTimer = timerIndex < selectedTimers.length - 1 ? selectedTimers[timerIndex + 1] : null;

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
  }, [editingTimerId, editStartTime, editEndTime, selectedTimers, onUpdateTimerTimes]);

  const saveTaskEditing = useCallback(async () => {
    if (!editingTaskId || !onUpdateTaskTimes) return;

    const task = selectedTasks.find(t => t.id === editingTaskId);
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
  }, [editingTaskId, taskEditStartTime, taskEditEndTime, selectedTasks, onUpdateTaskTimes]);

  // Calculate total work time
  const totalWorkTime = selectedTimers.reduce((total, timer) => {
    const endTime = timer.endTime || Date.now();
    return total + (endTime - timer.startTime);
  }, 0);

  // Calculate time per project
  const projectDurations = new Map<string, number>();
  for (const task of selectedTasks) {
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

  const title = getOverviewTitle(selectedDate);
  const isToday = selectedDate === getTodayDateString();

  // Format selected date for display
  const selectedDateFormatted = useMemo(() => {
    const [year, month, day] = selectedDate.split('-');
    return `${day}.${month}.${year}`;
  }, [selectedDate]);

  // Custom title component with date navigation
  const titleContent = (
    <div className="overview-title-nav">
      <span className="overview-title-text">{title}</span>
      <div className="overview-date-nav">
        <button
          className="overview-nav-btn"
          onClick={goToPrevDate}
          disabled={!canGoPrev}
          title="Previous day with data"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="overview-date-picker-container" ref={calendarRef}>
          <button
            className={`overview-date-picker-btn ${datePickerShake ? 'shake' : ''}`}
            onClick={() => setShowCalendar(!showCalendar)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <span>{selectedDateFormatted}</span>
          </button>
          {showCalendar && (
            <div className="overview-calendar">
              <div className="calendar-header">
                <button
                  className="calendar-nav-btn"
                  onClick={() => setCalendarMonth(prev => {
                    if (prev.month === 0) {
                      return { year: prev.year - 1, month: 11 };
                    }
                    return { ...prev, month: prev.month - 1 };
                  })}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                <span className="calendar-month-year">
                  {monthNames[calendarMonth.month]} {calendarMonth.year}
                </span>
                <button
                  className="calendar-nav-btn"
                  onClick={() => setCalendarMonth(prev => {
                    if (prev.month === 11) {
                      return { year: prev.year + 1, month: 0 };
                    }
                    return { ...prev, month: prev.month + 1 };
                  })}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
              <div className="calendar-weekdays">
                <span>Mo</span>
                <span>Tu</span>
                <span>We</span>
                <span>Th</span>
                <span>Fr</span>
                <span>Sa</span>
                <span>Su</span>
              </div>
              <div className="calendar-days">
                {calendarDays.map((day, i) => (
                  <button
                    key={i}
                    className={`calendar-day ${!day.isCurrentMonth ? 'other-month' : ''} ${day.isToday ? 'today' : ''} ${day.date === selectedDate ? 'selected' : ''} ${day.isFuture ? 'future' : ''} ${!day.hasData && !day.isFuture ? 'no-data' : ''}`}
                    onClick={() => handleDateSelect(day.date)}
                    disabled={day.isFuture}
                    style={day.hasData && !day.isFuture ? {
                      backgroundColor: `rgba(34, 197, 94, ${day.intensity})`,
                    } : undefined}
                    title={day.hasData ? formatDuration(dateDataMap.get(day.date) || 0) : undefined}
                  >
                    {day.dayNum}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <button
          className="overview-nav-btn"
          onClick={goToNextDate}
          disabled={!canGoNext}
          title="Next day with data"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={titleContent} wide>
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
          <div className="stat-value">{selectedTasks.length}</div>
          <div className="stat-label">Tasks {isToday ? 'Today' : ''}</div>
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
            {selectedTimers.length === 0 ? (
              <p className="empty-state-text">No work sessions {isToday ? 'today' : 'this day'}</p>
            ) : (
              selectedTimers.map((timer) => {
                const endTime = timer.endTime || Date.now();
                const duration = endTime - timer.startTime;
                const isEditing = editingTimerId === timer.id;
                const canEdit = timer.endTime && onUpdateTimerTimes && isToday;

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
              <p className="empty-state-text">No project work {isToday ? 'today' : 'this day'}</p>
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
            <h4>Tasks {isToday ? 'Today' : ''}</h4>
            {selectedTasks.length === 0 ? (
              <p className="empty-state-text">No tasks {isToday ? 'today' : 'this day'}</p>
            ) : (
              selectedTasks.map((task) => {
                const project = projects.find((p) => p.id === task.projectId);
                const projectName = project?.name || 'Unknown';
                const endTime = task.endTime || Date.now();
                const duration = task.duration || (endTime - task.startTime);
                const isEditing = editingTaskId === task.id;
                const isActive = task.id === activeTaskId;
                const canEdit = onUpdateTaskTimes !== undefined && isToday;

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
                        {onDeleteTask && !isActive && isToday && (
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

      <Toast messages={toasts} onRemove={removeToast} />
    </Modal>
  );
}
