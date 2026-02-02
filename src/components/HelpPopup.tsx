import { Modal } from './Modal';
import type { Page } from '../types';

interface Shortcut {
  keys: string[];
  description: string;
}

interface ShortcutCategory {
  title: string;
  shortcuts: Shortcut[];
}

const landingShortcuts: ShortcutCategory[] = [
  {
    title: 'Actions',
    shortcuts: [
      { keys: ['Enter'], description: 'Start tracking' },
      { keys: ['Ctrl', 'O'], description: 'Today overview' },
      { keys: ['Ctrl', 'T'], description: 'Global todos' },
      { keys: ['?'], description: 'Show help' },
    ],
  },
];

const overviewShortcuts: ShortcutCategory[] = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['Esc'], description: 'Back to landing' },
      { keys: ['↑/↓'], description: 'Navigate rows' },
      { keys: ['←/→'], description: 'Navigate columns' },
      { keys: ['Enter'], description: 'Open project' },
      { keys: ['1-9'], description: 'Filter by number' },
    ],
  },
  {
    title: 'Projects',
    shortcuts: [
      { keys: ['/','f'], description: 'Focus search' },
      { keys: ['n'], description: 'New project' },
      { keys: ['o'], description: 'Open "Other"' },
      { keys: ['t'], description: 'Open "ToDo"' },
      { keys: ['h'], description: 'Hide/show done' },
      { keys: ['s'], description: 'Cycle sort' },
      { keys: ['a'], description: 'Toggle asc/desc' },
      { keys: ['Del'], description: 'Delete project' },
      { keys: ['Ctrl', '↑/↓'], description: 'Project priority' },
    ],
  },
  {
    title: 'Export',
    shortcuts: [
      { keys: ['Ctrl', 'S'], description: 'Today as TXT' },
      { keys: ['Ctrl', 'E'], description: 'Today as CSV' },
      { keys: ['Ctrl', 'Alt', 'E'], description: 'Full database' },
      { keys: ['Ctrl', 'Alt', 'I'], description: 'Import DB' },
    ],
  },
  {
    title: 'Other',
    shortcuts: [
      { keys: ['Ctrl', 'O'], description: 'Today overview' },
      { keys: ['Ctrl', 'T'], description: 'Global todos' },
      { keys: ['Ctrl', 'Alt', 'C'], description: 'Edit start time' },
      { keys: ['?'], description: 'Show help' },
    ],
  },
];

const projectShortcuts: ShortcutCategory[] = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['Esc'], description: 'Back / Cancel' },
      { keys: ['↑/↓'], description: 'Navigate items' },
      { keys: ['←/→'], description: 'Switch columns' },
      { keys: ['Enter'], description: 'Edit selected' },
    ],
  },
  {
    title: 'Tasks & Notes',
    shortcuts: [
      { keys: ['Space'], description: 'Duplicate task / Toggle todo' },
      { keys: ['Del'], description: 'Delete item' },
      { keys: ['Ctrl', 'Z'], description: 'Undo delete' },
      { keys: ['Ctrl', '↑/↓'], description: 'Project priority' },
    ],
  },
  {
    title: 'Project',
    shortcuts: [
      { keys: ['F2'], description: 'Rename project' },
      { keys: ['F3'], description: 'Edit subtitle' },
      { keys: ['Ctrl', 'D'], description: 'Mark as done' },
      { keys: ['Ctrl', 'H'], description: 'Toggle on hold' },
    ],
  },
  {
    title: 'Other',
    shortcuts: [
      { keys: ['Ctrl', 'O'], description: 'Today overview' },
      { keys: ['Ctrl', 'T'], description: 'Global todos' },
      { keys: ['Ctrl', 'S'], description: 'Today as TXT' },
      { keys: ['Ctrl', 'E'], description: 'Today as CSV' },
      { keys: ['Ctrl', 'Alt', 'S'], description: 'Full as TXT' },
      { keys: ['Ctrl', 'Alt', 'E'], description: 'Full as CSV' },
      { keys: ['?'], description: 'Show help' },
    ],
  },
];

interface HelpPopupProps {
  isOpen: boolean;
  onClose: () => void;
  currentPage: Page;
}

export function HelpPopup({ isOpen, onClose, currentPage }: HelpPopupProps) {
  const categories =
    currentPage === 'landing'
      ? landingShortcuts
      : currentPage === 'overview'
      ? overviewShortcuts
      : projectShortcuts;

  const pageTitle =
    currentPage === 'landing'
      ? 'Landing'
      : currentPage === 'overview'
      ? 'Overview'
      : 'Project';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Shortcuts - ${pageTitle}`}>
      <div className="shortcuts-grid">
        {categories.map((category, catIndex) => (
          <div key={catIndex} className="shortcut-category">
            <h4 className="shortcut-category-title">{category.title}</h4>
            <div className="shortcuts-list">
              {category.shortcuts.map((shortcut, index) => (
                <div key={index} className="shortcut-item">
                  <span className="shortcut-desc">{shortcut.description}</span>
                  <div className="shortcut-keys">
                    {shortcut.keys.map((key, keyIndex) => (
                      <kbd key={keyIndex}>{key}</kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
