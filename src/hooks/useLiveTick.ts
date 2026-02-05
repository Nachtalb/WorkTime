import { useState, useEffect } from 'react';

/**
 * Hook that returns a tick value that increments every second.
 * Use this to force re-renders for live timer displays.
 * Only ticks when isActive is true to avoid unnecessary updates.
 */
export function useLiveTick(isActive: boolean): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (isActive) {
      const interval = setInterval(() => {
        setTick((t) => t + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isActive]);

  return tick;
}
