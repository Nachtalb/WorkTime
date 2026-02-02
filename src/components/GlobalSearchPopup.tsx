import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { Project } from '../types';

interface GlobalSearchPopupProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  onSelectProject: (projectId: string) => void;
  currentProjectId?: string | null;
}

export function GlobalSearchPopup({
  isOpen,
  onClose,
  projects,
  onSelectProject,
  currentProjectId,
}: GlobalSearchPopupProps) {
  const [searchText, setSearchText] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter and sort projects
  const filteredProjects = useMemo(() => {
    const searchLower = searchText.toLowerCase();

    // Filter projects
    let filtered = projects.filter((p) => {
      if (p.isOther || p.isTodo) return false; // Exclude special projects from search
      const nameMatch = p.name.toLowerCase().includes(searchLower);
      const subtitleMatch = p.subtitle?.toLowerCase().includes(searchLower);
      return nameMatch || subtitleMatch;
    });

    // Sort: active projects first, then by last used
    filtered.sort((a, b) => {
      // Current project first
      if (a.id === currentProjectId) return -1;
      if (b.id === currentProjectId) return 1;

      // Done projects last
      if (a.doneAt && !b.doneAt) return 1;
      if (!a.doneAt && b.doneAt) return -1;

      // On hold projects after active
      if (a.onHoldAt && !b.onHoldAt) return 1;
      if (!a.onHoldAt && b.onHoldAt) return -1;

      // Then by last used
      return b.lastUsed - a.lastUsed;
    });

    return filtered;
  }, [projects, searchText, currentProjectId]);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setSearchText('');
      setSelectedIndex(0);
      // Focus input after a brief delay to ensure modal is rendered
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  // Keep selected index in bounds
  useEffect(() => {
    if (selectedIndex >= filteredProjects.length) {
      setSelectedIndex(Math.max(0, filteredProjects.length - 1));
    }
  }, [filteredProjects.length, selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && filteredProjects.length > 0) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, filteredProjects.length]);

  // Handle Escape at document level to ensure it always works
  useEffect(() => {
    if (!isOpen) return;

    const handleDocumentKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    // Use capture phase to handle before other listeners
    document.addEventListener('keydown', handleDocumentKeyDown, true);
    return () => document.removeEventListener('keydown', handleDocumentKeyDown, true);
  }, [isOpen, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, filteredProjects.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredProjects.length > 0) {
        onSelectProject(filteredProjects[selectedIndex].id);
        onClose();
      }
    }
    // Escape is handled at document level
  }, [filteredProjects, selectedIndex, onSelectProject, onClose]);

  const handleSelect = useCallback((projectId: string) => {
    onSelectProject(projectId);
    onClose();
  }, [onSelectProject, onClose]);

  if (!isOpen) return null;

  return (
    <div className="global-search-overlay" onClick={onClose}>
      <div className="global-search-popup" onClick={(e) => e.stopPropagation()}>
        <div className="global-search-input-wrapper">
          <svg className="global-search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="global-search-input"
            placeholder="Search projects..."
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
          />
          <kbd className="global-search-hint">esc</kbd>
        </div>

        <div className="global-search-results" ref={listRef}>
          {filteredProjects.length === 0 ? (
            <div className="global-search-empty">
              {searchText ? 'No projects found' : 'Type to search projects'}
            </div>
          ) : (
            filteredProjects.map((project, index) => (
              <div
                key={project.id}
                className={`global-search-item ${index === selectedIndex ? 'selected' : ''} ${project.doneAt ? 'done' : ''} ${project.onHoldAt ? 'on-hold' : ''} ${project.id === currentProjectId ? 'current' : ''}`}
                onClick={() => handleSelect(project.id)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <span className="global-search-item-name">{project.name}</span>
                {project.subtitle && (
                  <span className="global-search-item-subtitle">{project.subtitle}</span>
                )}
                {project.id === currentProjectId && (
                  <span className="global-search-item-badge current">current</span>
                )}
                {project.doneAt && (
                  <span className="global-search-item-badge done">done</span>
                )}
                {project.onHoldAt && (
                  <span className="global-search-item-badge on-hold">on hold</span>
                )}
              </div>
            ))
          )}
        </div>

        <div className="global-search-footer">
          <span><kbd>↑↓</kbd> navigate</span>
          <span><kbd>↵</kbd> select</span>
          <span><kbd>esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
