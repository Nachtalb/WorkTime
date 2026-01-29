import { useEffect, useCallback } from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  message: string;
  itemName?: string;
}

export function ConfirmDialog({
  isOpen,
  onConfirm,
  onCancel,
  message,
  itemName,
}: ConfirmDialogProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onConfirm();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    },
    [onConfirm, onCancel]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Confirm</h3>
        </div>
        <div className="modal-content">
          <p className="confirm-message">
            {message}
            {itemName && <strong> "{itemName}"</strong>}?
          </p>
          <p className="confirm-hint">
            Press <kbd>Enter</kbd> or <kbd>Space</kbd> to confirm, <kbd>Esc</kbd> to cancel
          </p>
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-danger" onClick={onConfirm}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
