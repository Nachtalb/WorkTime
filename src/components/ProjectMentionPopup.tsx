import { useEffect, useRef } from 'react';
import type { Project } from '../types';

interface ProjectMentionPopupProps {
  isOpen: boolean;
  projects: Project[];
  searchText: string;
  selectedIndex: number;
  position: { top: number; left: number };
  onSelect: (project: Project) => void;
  onClose: () => void;
}

export function ProjectMentionPopup({
  isOpen,
  projects,
  searchText,
  selectedIndex,
  position,
  onSelect,
  onClose,
}: ProjectMentionPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLDivElement>(null);

  // Filter projects based on search text (search both name and subtitle)
  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchText.toLowerCase()) ||
    p.subtitle?.toLowerCase().includes(searchText.toLowerCase())
  );

  // Scroll selected item into view
  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen || filteredProjects.length === 0) return null;

  return (
    <div
      ref={popupRef}
      className="mention-popup"
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      <div className="mention-popup-header">Projects</div>
      <div className="mention-popup-list">
        {filteredProjects.slice(0, 8).map((project, index) => (
          <div
            key={project.id}
            ref={index === selectedIndex ? selectedRef : null}
            className={`mention-popup-item ${index === selectedIndex ? 'selected' : ''}`}
            onClick={() => onSelect(project)}
            onMouseEnter={() => {
              // Could add hover selection here if needed
            }}
          >
            <span className="mention-project-name">{project.name}</span>
            {project.subtitle && (
              <span className="mention-project-subtitle">{project.subtitle}</span>
            )}
            {project.isOther && <span className="mention-tag">Special</span>}
            {project.isTodo && <span className="mention-tag">ToDo</span>}
          </div>
        ))}
      </div>
      <div className="mention-popup-hint">
        <kbd>↑↓</kbd> navigate <kbd>Enter</kbd> select <kbd>Esc</kbd> close
      </div>
    </div>
  );
}
