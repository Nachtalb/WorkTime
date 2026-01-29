import { formatDurationShort } from '../utils/time';

interface TimerIndicatorProps {
  globalDuration: number;
  taskDuration: number;
  isActive: boolean;
}

export function TimerIndicator({ globalDuration, taskDuration, isActive }: TimerIndicatorProps) {
  if (!isActive && globalDuration === 0) {
    return null;
  }

  return (
    <div className="timer-indicator">
      <div className="timer-main">
        {isActive && <div className="timer-dot" />}
        <span>{formatDurationShort(globalDuration)}</span>
      </div>
      {taskDuration > 0 && (
        <div className="timer-secondary">Task: {formatDurationShort(taskDuration)}</div>
      )}
    </div>
  );
}
