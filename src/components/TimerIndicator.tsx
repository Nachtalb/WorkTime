import { formatDurationShort } from '../utils/time';

interface TimerIndicatorProps {
  globalDuration: number;
  taskDuration: number;
  isActive: boolean;
  activeTaskInfo?: { projectName: string; taskDescription: string } | null;
}

export function TimerIndicator({ globalDuration, taskDuration, isActive, activeTaskInfo }: TimerIndicatorProps) {
  if (!isActive && globalDuration === 0) {
    return null;
  }

  // Truncate task description if too long
  const truncatedDescription = activeTaskInfo?.taskDescription
    ? activeTaskInfo.taskDescription.length > 30
      ? activeTaskInfo.taskDescription.substring(0, 30) + '...'
      : activeTaskInfo.taskDescription
    : null;

  return (
    <div className="timer-indicator">
      <div className="timer-main">
        {isActive && <div className="timer-dot" />}
        <span>{formatDurationShort(globalDuration)}</span>
      </div>
      {taskDuration > 0 && activeTaskInfo && (
        <div className="timer-secondary">
          {activeTaskInfo.projectName} - {truncatedDescription} {formatDurationShort(taskDuration)}
        </div>
      )}
    </div>
  );
}
