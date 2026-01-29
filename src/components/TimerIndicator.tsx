import { useState, useEffect } from 'react';
import { formatDurationShort } from '../utils/time';

interface TimerIndicatorProps {
  globalDuration: number;
  taskDuration: number;
  isActive: boolean;
}

export function TimerIndicator({ globalDuration, taskDuration, isActive }: TimerIndicatorProps) {
  const [, setTick] = useState(0);

  // Force re-render every second to update the timer display
  useEffect(() => {
    if (isActive) {
      const interval = setInterval(() => setTick((t) => t + 1), 1000);
      return () => clearInterval(interval);
    }
  }, [isActive]);

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
