import { Modal } from './Modal';
import type { Page } from '../types';

interface Shortcut {
  keys: string[];
  description: string;
}

const landingShortcuts: Shortcut[] = [
  { keys: ['Enter'], description: 'Start tracking global time' },
  { keys: ['Ctrl', 'O'], description: 'Open today overview' },
  { keys: ['?'], description: 'Show this help' },
];

const overviewShortcuts: Shortcut[] = [
  { keys: ['Esc'], description: 'Go back to landing page (stops all timers)' },
  { keys: ['1-0'], description: 'Filter projects by number' },
  { keys: ['Arrow keys'], description: 'Navigate between projects' },
  { keys: ['Enter'], description: 'Open selected project' },
  { keys: ['n'], description: 'Create new project' },
  { keys: ['o'], description: 'Open "Other" project' },
  { keys: ['Delete'], description: 'Delete selected project' },
  { keys: ['Ctrl', 'S'], description: 'Export today as TXT' },
  { keys: ['Ctrl', 'E'], description: 'Export today as CSV' },
  { keys: ['Ctrl', 'Alt', 'E'], description: 'Export full database' },
  { keys: ['Ctrl', 'Alt', 'I'], description: 'Import database' },
  { keys: ['Ctrl', 'Alt', 'C'], description: 'Change global timer start time' },
  { keys: ['Ctrl', 'O'], description: 'Open today overview' },
  { keys: ['?'], description: 'Show this help' },
];

const projectShortcuts: Shortcut[] = [
  { keys: ['Esc'], description: 'Go back to overview (or cancel current action)' },
  { keys: ['Arrow keys'], description: 'Navigate between tasks' },
  { keys: ['Enter'], description: 'Start selected task / confirm rename' },
  { keys: ['Delete'], description: 'Delete selected task' },
  { keys: ['Space'], description: 'Start new task with same description' },
  { keys: ['F2'], description: 'Rename project' },
  { keys: ['Ctrl', 'S'], description: 'Export project today as TXT' },
  { keys: ['Ctrl', 'E'], description: 'Export project today as CSV' },
  { keys: ['Ctrl', 'Alt', 'S'], description: 'Export full project as TXT' },
  { keys: ['Ctrl', 'Alt', 'E'], description: 'Export full project as CSV' },
  { keys: ['?'], description: 'Show this help' },
];

interface HelpPopupProps {
  isOpen: boolean;
  onClose: () => void;
  currentPage: Page;
}

export function HelpPopup({ isOpen, onClose, currentPage }: HelpPopupProps) {
  const shortcuts =
    currentPage === 'landing'
      ? landingShortcuts
      : currentPage === 'overview'
      ? overviewShortcuts
      : projectShortcuts;

  const pageTitle =
    currentPage === 'landing'
      ? 'Landing Page'
      : currentPage === 'overview'
      ? 'Overview Page'
      : 'Project Page';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Keyboard Shortcuts - ${pageTitle}`}>
      <div className="shortcuts-list">
        {shortcuts.map((shortcut, index) => (
          <div key={index} className="shortcut-item">
            <span>{shortcut.description}</span>
            <div className="shortcut-keys">
              {shortcut.keys.map((key, keyIndex) => (
                <kbd key={keyIndex}>{key}</kbd>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
