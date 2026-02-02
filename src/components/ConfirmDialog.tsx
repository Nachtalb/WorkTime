import { useEffect, useCallback } from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  message: string;
  itemName?: string;
  confirmText?: string;
}

export function ConfirmDialog({
  isOpen,
  onConfirm,
  onCancel,
  message,
  itemName,
  confirmText = 'Delete',
}: ConfirmDialogProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    },
    [onCancel]
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
            <kbd>Tab</kbd> to navigate, <kbd>Enter</kbd> to select, <kbd>Esc</kbd> to cancel
          </p>
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-danger" onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
