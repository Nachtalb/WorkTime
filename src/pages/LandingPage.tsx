import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../hooks/AppContext';
import { getCurrentTime, getCurrentDate } from '../utils/time';
import { HelpPopup } from '../components/HelpPopup';
import { TodayOverviewPopup } from '../components/TodayOverviewPopup';
import { GlobalSearchPopup } from '../components/GlobalSearchPopup';

export function LandingPage() {
  const { startGlobalTimer, goToOverview, goToOverviewBrowse, goToProjectBrowse, globalTimers, tasks, projects, activeTaskId, updateGlobalTimerTimes, updateTaskTimes, deleteTask } = useApp();
  const [time, setTime] = useState(getCurrentTime());
  const [date, setDate] = useState(getCurrentDate());
  const [showHelp, setShowHelp] = useState(false);
  const [showTodayOverview, setShowTodayOverview] = useState(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);

  // Update time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setTime(getCurrentTime());
      setDate(getCurrentDate());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleStart = useCallback(async () => {
    await startGlobalTimer();
    goToOverview();
  }, [startGlobalTimer, goToOverview]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if a modal is open
      if (showHelp || showTodayOverview || showGlobalSearch) return;

      // Handle Ctrl+K for global search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowGlobalSearch(true);
        return;
      }

      // Handle / for global search (when not in an input)
      if (e.key === '/' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setShowGlobalSearch(true);
        return;
      }

      // Handle Ctrl+O for today overview
      if (e.ctrlKey && e.key === 'o') {
        e.preventDefault();
        setShowTodayOverview(true);
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        handleStart();
      } else if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        goToOverviewBrowse();
      } else if (e.key === '?') {
        e.preventDefault();
        setShowHelp(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleStart, goToOverviewBrowse, showHelp, showTodayOverview, showGlobalSearch]);

  return (
    <div className="page landing-page">
      <div className="landing-datetime">
        <div className="landing-time">{time}</div>
        <div className="landing-date">{date}</div>
      </div>

      <button className="start-button" onClick={handleStart}>
        START
      </button>

      <button className="browse-link" onClick={goToOverviewBrowse}>
        or just browse
      </button>

      <p className="landing-hint">
        Press <kbd>Enter</kbd> to start &middot; <kbd>B</kbd> to browse &middot; <kbd>/</kbd> search &middot; <kbd>?</kbd> help
      </p>

      <HelpPopup isOpen={showHelp} onClose={() => setShowHelp(false)} currentPage="landing" />

      <TodayOverviewPopup
        isOpen={showTodayOverview}
        onClose={() => setShowTodayOverview(false)}
        globalTimers={globalTimers}
        tasks={tasks}
        projects={projects}
        activeTaskId={activeTaskId}
        onUpdateTimerTimes={updateGlobalTimerTimes}
        onUpdateTaskTimes={updateTaskTimes}
        onDeleteTask={deleteTask}
        onProjectClick={goToProjectBrowse}
      />

      <GlobalSearchPopup
        isOpen={showGlobalSearch}
        onClose={() => setShowGlobalSearch(false)}
        projects={projects}
        onSelectProject={goToProjectBrowse}
      />
    </div>
  );
}
