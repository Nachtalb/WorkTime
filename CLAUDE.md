# CLAUDE.md - AI Assistant Guide for WorkTime

## Project Overview

WorkTime is a keyboard-first time tracking web application built with React 19 and TypeScript. It uses IndexedDB for fully offline data persistence with no server required.

## Quick Commands

```bash
npm install     # Install dependencies
npm run dev     # Start development server (Vite, typically localhost:5173)
npm run build   # TypeScript check + production build
npm run lint    # ESLint code quality check
npm run preview # Preview production build
```

**Always run `npm run lint` before committing changes.**

## Architecture

### Tech Stack
- **Frontend**: React 19.2.0 + TypeScript 5.9.3
- **Build Tool**: Vite 7.2.4
- **Persistence**: IndexedDB via idb 8.0.3 (fully offline-first)
- **Utilities**: date-fns 4.1.0, uuid 13.0.0
- **Linting**: ESLint 9 with TypeScript + React hooks plugins

### Directory Structure

```
src/
├── pages/              # 3 main views (LandingPage, OverviewPage, ProjectPage)
├── components/         # Reusable UI components (Modal, Toast, popups, etc.)
├── hooks/              # State management
│   ├── AppContext.tsx  # React Context provider
│   ├── useAppState.ts  # Central state hook (650+ lines, 80+ methods)
│   └── useLiveTick.ts  # Timer re-render trigger
├── services/
│   └── database.ts     # IndexedDB CRUD operations
├── types/
│   └── index.ts        # TypeScript interfaces
├── utils/
│   ├── time.ts         # Date/time formatting (15+ functions)
│   ├── export.ts       # TXT/CSV export functionality
│   └── search.ts       # Word-based fuzzy matching
├── App.tsx             # Main app component
├── main.tsx            # React entry point
└── index.css           # Global styles with CSS variables (~1200 lines)
```

## Data Model

### Core Entities (in `src/types/index.ts`)

```typescript
Project {
  id, name, subtitle?, createdAt, lastUsed,
  isOther?, isTodo?, isIdeas?,  // Special project flags
  priority?, doneAt?, onHoldAt?
}

Task {
  id, projectId, description,
  startTime, endTime?, duration  // endTime null = ongoing
}

Note {
  id, projectId, content, createdAt,
  completed?, completedAt?
}

GlobalTimer {
  id, date (YYYY-MM-DD), startTime, endTime?
}
```

### Database Schema (version 2)
- **Projects**: keyPath=id, indexes: isOther, isTodo, isIdeas
- **Tasks**: keyPath=id, index: projectId
- **Notes**: keyPath=id, index: projectId (added in v2)
- **GlobalTimers**: keyPath=id, index: date
- **AppState**: keyPath=id (single record for app state)

## Code Conventions

### React Patterns
- **Functional components only** - no class components
- **Hooks-based state**: useState, useEffect, useCallback, useMemo, useRef, useContext
- **Context API for global state**: `useApp()` hook provides all state and mutations
- **All mutations go through `useAppState.ts`**: Never modify IndexedDB directly from components

### TypeScript Practices
- Strict mode enabled
- `noUnusedLocals: true`, `noUnusedParameters: true`
- All data structures have interfaces in `src/types/index.ts`
- Use explicit return types for exported functions

### State Management Pattern
```typescript
// All state mutations follow this pattern:
const updateTask = useCallback(async (id: string, updates: Partial<Task>) => {
  await db.updateTask(id, updates);  // Persist to IndexedDB
  setTasks(prev => prev.map(t =>     // Update React state
    t.id === id ? { ...t, ...updates } : t
  ));
}, []);
```

### CSS Conventions
- Global styles in `src/index.css` with CSS variables
- CSS variables for theming:
  - `--color-bg`, `--color-text`, `--color-primary`
  - `--color-success`, `--color-warning`, `--color-danger`
  - `--radius-sm/md/lg/xl`, `--shadow-sm/md/lg`
  - `--transition-fast/normal`
- Component-specific styles use descriptive class names

### Text Formatting (in task descriptions and notes)
Supported markdown-like syntax:
- Bold: `**text**`
- Italic: `*text*` or `_text_`
- Underline: `__text__`
- Strikethrough: `~~text~~`
- Monospace: `` `text` ``
- Nested formatting is supported

## Key Implementation Details

### Special Projects
Three reserved project types with special behavior:
- **"Other"** (`isOther=true`): Catch-all for miscellaneous time
- **ToDo"** (`isTodo=true`): Global todo list with completion tracking
- **"Ideas"** (`isIdeas=true`): Idea capture project

### Timer Logic
- Ongoing tasks have `endTime = null`
- `useLiveTick` hook triggers re-renders for live duration display
- Closing browser doesn't stop timers (persisted in IndexedDB)
- Global timer tracks overall work session independently of project tasks

### Search Algorithm (`src/utils/search.ts`)
Word-based fuzzy matching with scoring:
- Exact start match: score 0 (best)
- Substring match: score 1
- Fuzzy match: score 100+ (based on edit distance)

### Export Formats
- **TXT**: Chronological with ASCII formatting
- **CSV**: Structured with headers for spreadsheet import
- Supports: today-only, full project, full database exports

## Adding Features

### Adding a New Page
1. Create component in `src/pages/`
2. Add page type to `AppState.currentPage` in types
3. Handle navigation in `useAppState.ts`
4. Add keyboard shortcuts in the page component
5. Update help popup if needed

### Adding a New Data Entity
1. Add interface to `src/types/index.ts`
2. Add IndexedDB store in `src/services/database.ts` (increment DB_VERSION)
3. Add state and methods to `src/hooks/useAppState.ts`
4. Handle migration for existing databases

### Adding a New Component
1. Create in `src/components/`
2. Use `useApp()` hook for state access
3. Follow existing patterns for modals/popups
4. Handle keyboard events consistently (Escape to close)

## Common Pitfalls

- **Stale closures**: Use refs (`useRef`) to access latest values in event handlers
- **Database migrations**: Always handle upgrade path in `database.ts` openDB call
- **Timer state**: Remember ongoing tasks have `endTime = null`, not 0
- **Keyboard events**: Check `e.target` to avoid capturing input field keystrokes
- **Date handling**: Use date-fns functions, store dates as ISO strings or timestamps

## Testing

No automated tests are currently configured. When making changes:
1. Run `npm run lint` to catch TypeScript and linting errors
2. Test manually in browser:
   - Create/edit/delete projects and tasks
   - Test timer start/stop/persistence
   - Test keyboard shortcuts
   - Test export/import functionality
   - Test browser refresh (data persistence)

## File Reference

| File | Purpose |
|------|---------|
| `src/hooks/useAppState.ts` | Central state management - start here for understanding data flow |
| `src/services/database.ts` | IndexedDB schema and operations |
| `src/pages/*.tsx` | Main views and their keyboard handlers |
| `src/utils/time.ts` | Date/time formatting utilities |
| `src/types/index.ts` | All TypeScript interfaces |
| `src/index.css` | All styling and CSS variables |
