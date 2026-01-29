import { useRef, useCallback } from 'react';
import { Modal } from './Modal';

interface ImportPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (file: File) => Promise<void>;
}

export function ImportPopup({ isOpen, onClose, onImport }: ImportPopupProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        try {
          await onImport(file);
          onClose();
        } catch (error) {
          console.error('Import failed:', error);
          alert('Failed to import database. Please check the file format.');
        }
      }
    },
    [onImport, onClose]
  );

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Import Database">
      <div className="import-dropzone" onClick={handleClick}>
        <input
          ref={inputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
        />
        <p>Click to select a backup file</p>
        <p className="confirm-hint">Accepts .json files exported from WorkTime</p>
      </div>
      <div className="modal-actions">
        <button className="btn btn-secondary" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  );
}
