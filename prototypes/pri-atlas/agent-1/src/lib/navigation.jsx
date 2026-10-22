import React, { createContext, useCallback, useContext } from 'react';
import { flushSync } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { destinationHref, normalizeContext, SUBJECTS } from './contract.js';

const NavigationContext = createContext(null);

export function NavigationProvider({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const context = normalizeContext(location.search);
  const rawDestination = location.pathname.slice(1).split('/')[0] || 'command';
  const destination = ['command', 'atlas', 'laboratory', 'paper', 'insight'].includes(rawDestination) ? rawDestination : 'command';

  const go = useCallback((next, overrides = {}) => {
    const merged = { ...context, ...overrides };
    if (overrides.subject && overrides.subject !== context.subject && overrides.concept === undefined) {
      merged.concept = null;
    }
    if (merged.subject && !SUBJECTS.includes(merged.subject)) return;
    const target = destinationHref(next, merged);
    const change = () => flushSync(() => navigate(target));
    // Native View Transitions preserve spatial continuity without a
    // heavy animation framework. React routing remains the fallback.
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!reduced && document.startViewTransition) {
      document.startViewTransition(change);
    } else change();
  }, [navigate, context.subject, context.concept]);

  return (
    <NavigationContext.Provider value={{ context, destination, go }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useAtlasNavigation() {
  const value = useContext(NavigationContext);
  if (!value) throw new Error('useAtlasNavigation requires NavigationProvider');
  return value;
}
