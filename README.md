# WorkTime

A keyboard-first time tracking web application for tracking time spent on different projects and tasks.

## Features

- **Three modes/pages:**
  - **Landing Page**: Large start button with time/date display. Press Enter to start tracking.
  - **Overview Page**: View all projects as cards, sorted by recently used. Quick keyboard navigation.
  - **Project Page**: Manage tasks within a project with detailed time tracking.

- **Keyboard-first design**: Everything is shortcuttable for maximum efficiency
- **Offline-first**: All data stored in IndexedDB, works without internet
- **Persistent timers**: Closing the browser doesn't affect running timers
- **Export/Import**: Full database backup and restore, plus daily exports as TXT/CSV

## Keyboard Shortcuts

### Landing Page
- `Enter` - Start tracking global time
- `?` - Show help

### Overview Page
- `Esc` - Go back to landing page (stops all timers)
- `1-0` - Filter projects by number
- `Arrow keys` - Navigate between projects
- `Enter` - Open selected project
- `n` - Create new project
- `o` - Open "Other" project
- `Delete` - Delete selected project
- `Ctrl+S` - Export today as TXT
- `Ctrl+E` - Export today as CSV
- `Ctrl+Shift+E` - Export full database
- `Ctrl+Shift+I` - Import database
- `Ctrl+O` - Open today overview
- `?` - Show help

### Project Page
- `Esc` - Go back to overview / cancel current action
- `Arrow keys` - Navigate between tasks
- `Enter` - Edit selected task
- `Delete` - Delete selected task
- `F2` - Rename project
- `Ctrl+S` - Export project today as TXT
- `Ctrl+E` - Export project today as CSV
- `Ctrl+Shift+S` - Export full project as TXT
- `Ctrl+Shift+E` - Export full project as CSV
- `?` - Show help
- Start typing to create a new task

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Technology Stack

- React 19 + TypeScript
- Vite
- IndexedDB (via idb library)
- date-fns for date formatting
