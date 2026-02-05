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

  // Get the last (most recent/current) timer of today
  const currentTimer = todayTimers[todayTimers.length - 1];
  // Get the previous timer (the one before current) for overlap validation
  const previousTimer = todayTimers.length > 1 ? todayTimers[todayTimers.length - 2] : null;

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

    // Check for overlap with previous session
    if (previousTimer) {
      const previousEnd = previousTimer.endTime || previousTimer.startTime;
      if (newStartTime < previousEnd) {
        setError(`Start time cannot be before previous session ended (${formatTime(previousEnd)})`);
        return;
      }
    }

    setError(null);
    await onUpdateTimer(currentTimer.id, newStartTime);
    onClose();
  }, [currentTimer, timeValue, onUpdateTimer, onClose, previousTimer]);

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
    <Modal isOpen={isOpen} onClose={onClose} title="Change Current Session Start Time">
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
