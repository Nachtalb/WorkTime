import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { Project, Note } from '../types';
import { searchProjects, filterAndSortProjects } from '../utils/search';

interface GlobalSearchPopupProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  notes: Note[];
  onSelectProject: (projectId: string) => void;
  currentProjectId?: string | null;
}

/** Render text with matched characters highlighted */
function HighlightedText({ text, matchedIndices }: { text: string; matchedIndices: number[] }) {
  if (matchedIndices.length === 0) {
    return <>{text}</>;
  }

  const matchSet = new Set(matchedIndices);
  const result: React.ReactNode[] = [];
  let currentRun = '';
  let currentIsHighlight = false;

  for (let i = 0; i < text.length; i++) {
    const isHighlight = matchSet.has(i);

    if (i === 0) {
      currentIsHighlight = isHighlight;
      currentRun = text[i];
    } else if (isHighlight === currentIsHighlight) {
      currentRun += text[i];
    } else {
      // Flush current run
      if (currentIsHighlight) {
        result.push(<mark key={result.length}>{currentRun}</mark>);
      } else {
        result.push(currentRun);
      }
      currentRun = text[i];
      currentIsHighlight = isHighlight;
    }
  }

  // Flush final run
  if (currentRun) {
    if (currentIsHighlight) {
      result.push(<mark key={result.length}>{currentRun}</mark>);
    } else {
      result.push(currentRun);
    }
  }

  return <>{result}</>;
}

/** Get label for match field */
function getFieldLabel(field: 'name' | 'subtitle' | 'notes'): string {
  switch (field) {
    case 'name':
      return 'Name';
    case 'subtitle':
      return 'Subtitle';
    case 'notes':
      return 'Note';
  }
}

export function GlobalSearchPopup({
  isOpen,
  onClose,
  projects,
  notes,
  onSelectProject,
  currentProjectId,
}: GlobalSearchPopupProps) {
  const [searchText, setSearchText] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter and sort projects using shared search utility
  const searchResults = useMemo(() => {
    const results = searchProjects(projects, notes, searchText, {
      excludeSpecial: true,
      currentProjectId,
    });

    return filterAndSortProjects(results, {
      currentProjectId,
      sortDoneLast: true,
      sortOnHoldAfterActive: true,
    });
  }, [projects, notes, searchText, currentProjectId]);

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
    if (selectedIndex >= searchResults.length) {
      setSelectedIndex(Math.max(0, searchResults.length - 1));
    }
  }, [searchResults.length, selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && searchResults.length > 0) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, searchResults.length]);

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
      setSelectedIndex((prev) => Math.min(prev + 1, searchResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (searchResults.length > 0) {
        onSelectProject(searchResults[selectedIndex].project.id);
        onClose();
      }
    }
    // Escape is handled at document level
  }, [searchResults, selectedIndex, onSelectProject, onClose]);

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
          {searchResults.length === 0 ? (
            <div className="global-search-empty">
              {searchText ? 'No projects found' : 'Type to search projects'}
            </div>
          ) : (
            searchResults.map((result, index) => {
              const { project, matchDetails } = result;
              const showMatchLine = searchText && matchDetails && matchDetails.field !== 'name';

              return (
                <div
                  key={project.id}
                  className={`global-search-item ${index === selectedIndex ? 'selected' : ''} ${project.doneAt ? 'done' : ''} ${project.onHoldAt ? 'on-hold' : ''} ${project.id === currentProjectId ? 'current' : ''}`}
                  onClick={() => handleSelect(project.id)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="global-search-item-content">
                    <div className="global-search-item-row">
                      <span className="global-search-item-name">
                        {searchText && matchDetails?.field === 'name' ? (
                          <HighlightedText text={project.name} matchedIndices={matchDetails.matchedIndices} />
                        ) : (
                          project.name
                        )}
                      </span>
                      {project.subtitle && (
                        <span className="global-search-item-subtitle">
                          {project.subtitle}
                        </span>
                      )}
                    </div>
                    {showMatchLine && matchDetails && (
                      <div className="global-search-item-match">
                        <span className="global-search-match-label">{getFieldLabel(matchDetails.field)}:</span>
                        <span className="global-search-match-text">
                          <HighlightedText
                            text={matchDetails.text.length > 80 ? matchDetails.text.substring(0, 80) + '...' : matchDetails.text}
                            matchedIndices={matchDetails.matchedIndices.filter(i => i < 80)}
                          />
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="global-search-item-badges">
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
                </div>
              );
            })
          )}
        </div>

        <div className="modal-hint">
          <kbd>↑↓</kbd> navigate
          <kbd>Enter</kbd> select
          <kbd>Esc</kbd> close
        </div>
      </div>
    </div>
  );
}
