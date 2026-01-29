import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../hooks/AppContext';
import { getCurrentTime, getCurrentDate } from '../utils/time';
import { HelpPopup } from '../components/HelpPopup';

export function LandingPage() {
  const { startGlobalTimer, goToOverview } = useApp();
  const [time, setTime] = useState(getCurrentTime());
  const [date, setDate] = useState(getCurrentDate());
  const [showHelp, setShowHelp] = useState(false);

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
      if (showHelp) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        handleStart();
      } else if (e.key === '?') {
        e.preventDefault();
        setShowHelp(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleStart, showHelp]);

  return (
    <div className="page landing-page">
      <div className="landing-datetime">
        <div className="landing-time">{time}</div>
        <div className="landing-date">{date}</div>
      </div>

      <button className="start-button" onClick={handleStart}>
        START
      </button>

      <p className="landing-hint">
        Press <kbd>Enter</kbd> to start tracking &middot; Press <kbd>?</kbd> for help
      </p>

      <HelpPopup isOpen={showHelp} onClose={() => setShowHelp(false)} currentPage="landing" />
    </div>
  );
}
