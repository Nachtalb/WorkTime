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
      { keys: ['Alt', 'T'], description: 'Global todos' },
      { keys: ['?'], description: 'Show help' },
    ],
  },
];

const overviewShortcuts: ShortcutCategory[] = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['↑/↓'], description: 'Navigate rows' },
      { keys: ['←/→'], description: 'Navigate columns' },
      { keys: ['Enter'], description: 'Open project' },
      { keys: ['Backspace'], description: 'Previous project' },
      { keys: ['Esc'], description: 'Back to landing' },
    ],
  },
  {
    title: 'Projects',
    shortcuts: [
      { keys: ['/','f'], description: 'Focus search' },
      { keys: ['n'], description: 'New project' },
      { keys: ['o'], description: 'Other project' },
      { keys: ['t'], description: 'ToDo project' },
      { keys: ['i'], description: 'Ideas project' },
      { keys: ['Del'], description: 'Delete project' },
      { keys: ['Ctrl', '↑/↓'], description: 'Change priority' },
    ],
  },
  {
    title: 'View',
    shortcuts: [
      { keys: ['h'], description: 'Hide/show done' },
      { keys: ['s'], description: 'Cycle sort' },
      { keys: ['a'], description: 'Toggle asc/desc' },
      { keys: ['1-9'], description: 'Filter by number' },
    ],
  },
  {
    title: 'Global',
    shortcuts: [
      { keys: ['Ctrl', 'G'], description: 'Search' },
      { keys: ['Ctrl', 'O'], description: 'Today overview' },
      { keys: ['Alt', 'T'], description: 'Todos' },
      { keys: ['Ctrl', 'Alt', 'C'], description: 'Edit start time' },
      { keys: ['?'], description: 'Help' },
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
];

const projectShortcuts: ShortcutCategory[] = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['↑/↓'], description: 'Navigate items' },
      { keys: ['←/→', 'l/r'], description: 'Switch columns' },
      { keys: ['Enter'], description: 'Edit selected' },
      { keys: ['Backspace'], description: 'Previous project' },
      { keys: ['Esc'], description: 'Back / Cancel' },
    ],
  },
  {
    title: 'Formatting',
    shortcuts: [
      { keys: ['Ctrl', 'B/2'], description: 'Bold' },
      { keys: ['Ctrl', 'I/3'], description: 'Italic' },
      { keys: ['Ctrl', 'U/4'], description: 'Underline' },
      { keys: ['Ctrl', '5'], description: 'Strikethrough' },
      { keys: ['Ctrl', '6'], description: 'Code' },
      { keys: ['Ctrl', 'K'], description: 'Link' },
    ],
  },
  {
    title: 'Items',
    shortcuts: [
      { keys: ['Ctrl', '←/→'], description: 'Task/note mode' },
      { keys: ['Space'], description: 'Duplicate / Toggle' },
      { keys: ['Del'], description: 'Delete item' },
      { keys: ['Ctrl', 'Z'], description: 'Undo delete' },
    ],
  },
  {
    title: 'Project',
    shortcuts: [
      { keys: ['F2'], description: 'Rename' },
      { keys: ['F3'], description: 'Edit subtitle' },
      { keys: ['Ctrl', 'D'], description: 'Mark done' },
      { keys: ['Ctrl', 'H'], description: 'Toggle on hold' },
      { keys: ['Ctrl', '↑/↓'], description: 'Change priority' },
    ],
  },
  {
    title: 'Global',
    shortcuts: [
      { keys: ['Ctrl', 'G'], description: 'Search' },
      { keys: ['Ctrl', 'O'], description: 'Today overview' },
      { keys: ['Alt', 'T'], description: 'Todos' },
      { keys: ['?'], description: 'Help' },
    ],
  },
  {
    title: 'Export',
    shortcuts: [
      { keys: ['Ctrl', 'S'], description: 'Today TXT' },
      { keys: ['Ctrl', 'E'], description: 'Today CSV' },
      { keys: ['Ctrl', 'Alt', 'S'], description: 'Full TXT' },
      { keys: ['Ctrl', 'Alt', 'E'], description: 'Full CSV' },
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
