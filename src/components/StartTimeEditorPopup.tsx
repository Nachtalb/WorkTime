import { useState, useEffect, useCallback, useRef } from 'react';
import { Modal } from './Modal';
import type { GlobalTimer } from '../types';
import { formatTime, getTodayDateString } from '../utils/time';

interface StartTimeEditorPopupProps {
  isOpen: boolean;
  onClose: () => void;
  globalTimers: GlobalTimer[];
  onUpdateTimer: (timerId: string, newStartTime: number) => Promise<void>;
}

export function StartTimeEditorPopup({
  isOpen,
  onClose,
  globalTimers,
  onUpdateTimer,
}: StartTimeEditorPopupProps) {
  const today = getTodayDateString();
  const todayTimers = globalTimers
    .filter((t) => t.date === today)
    .sort((a, b) => a.startTime - b.startTime);

  // Get the first (earliest) timer of today - this is the "work start" time
  const currentTimer = todayTimers[0];

  const [timeValue, setTimeValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && currentTimer) {
      // Set the input to the current start time
      const date = new Date(currentTimer.startTime);
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      setTimeValue(`${hours}:${minutes}`);
      setError(null);
    }
  }, [isOpen, currentTimer]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isOpen]);

  const handleSave = useCallback(async () => {
    if (!currentTimer || !timeValue) return;

    const [hours, minutes] = timeValue.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return;

    // Create new date with the same day but new time
    const newDate = new Date(currentTimer.startTime);
    newDate.setHours(hours, minutes, 0, 0);
    const newStartTime = newDate.getTime();

    // Validate: start time cannot be later than current time
    if (newStartTime > Date.now()) {
      setError('Start time cannot be in the future');
      return;
    }

    // Validate: start time cannot be later than end time (if timer has ended)
    if (currentTimer.endTime && newStartTime > currentTimer.endTime) {
      setError('Start time cannot be after end time');
      return;
    }

    // Check for overlaps with other timers on the same day
    const otherTimers = todayTimers.filter(t => t.id !== currentTimer.id);
    for (const timer of otherTimers) {
      const timerEnd = timer.endTime || Date.now();
      // Check if new start time would be during another timer's session
      if (newStartTime >= timer.startTime && newStartTime < timerEnd) {
        setError('Start time would overlap with another work session');
        return;
      }
    }

    setError(null);
    await onUpdateTimer(currentTimer.id, newStartTime);
    onClose();
  }, [currentTimer, timeValue, onUpdateTimer, onClose, todayTimers]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      }
    },
    [handleSave]
  );

  if (!currentTimer) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Change Start Time">
        <p>No active work session today. Start tracking first.</p>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Change Work Start Time">
      <div style={{ marginBottom: '16px' }}>
        <p style={{ marginBottom: '12px', color: 'var(--color-text-secondary)' }}>
          Current start time: <strong>{formatTime(currentTimer.startTime)}</strong>
        </p>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
          New start time:
        </label>
        <input
          ref={inputRef}
          type="time"
          value={timeValue}
          onChange={(e) => {
            setError(null);
            setTimeValue(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '18px',
            border: `2px solid ${error ? 'var(--color-danger)' : 'var(--color-border)'}`,
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-bg-secondary)',
          }}
        />
        {error && (
          <p style={{ color: 'var(--color-danger)', marginTop: '8px', fontSize: '14px' }}>
            {error}
          </p>
        )}
      </div>
      <p className="confirm-hint">
        Press <kbd>Enter</kbd> to save, <kbd>Esc</kbd> to cancel
      </p>
      <div className="modal-actions">
        <button className="btn btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={handleSave}>
          Save
        </button>
      </div>
    </Modal>
  );
}
