import { Modal } from './Modal';
import type { Task, Project, GlobalTimer } from '../types';
import { formatTime, formatDuration, isTimestampToday, getTodayDateString } from '../utils/time';

interface TodayOverviewPopupProps {
  isOpen: boolean;
  onClose: () => void;
  globalTimers: GlobalTimer[];
  tasks: Task[];
  projects: Project[];
}

export function TodayOverviewPopup({
  isOpen,
  onClose,
  globalTimers,
  tasks,
  projects,
}: TodayOverviewPopupProps) {
  const today = getTodayDateString();
  const todayTimers = globalTimers.filter((t) => t.date === today).sort((a, b) => a.startTime - b.startTime);
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
    <Modal isOpen={isOpen} onClose={onClose} title="Today's Overview">
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
            return (
              <div key={timer.id} className="session-item">
                <span className="session-time">
                  {formatTime(timer.startTime)} - {timer.endTime ? formatTime(timer.endTime) : 'ongoing'}
                </span>
                <span className="session-duration">({formatDuration(duration)})</span>
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
