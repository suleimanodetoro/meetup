// hooks/useUpsellTrigger.ts
import { useState, useRef, useCallback, useEffect } from 'react';

interface VisibilityState {
  [index: number]: {
    visible: boolean;
    startTime: number | null;
  };
}

export function useUpsellTrigger() {
  const [showUpsellModal, setShowUpsellModal] = useState(false);
  const [hasTriggered, setHasTriggered] = useState(false);
  const [canRetrigger, setCanRetrigger] = useState(true);
  const visibilityState = useRef<VisibilityState>({});
  const debounceTimer = useRef<NodeJS.Timeout | undefined>(undefined);
  const sessionShownCount = useRef(0);
  const MAX_SHOWS_PER_SESSION = 3; // Limit to 3 shows per app session
  
  const handleCardVisibility = useCallback((index: number, isVisible: boolean) => {
    // Don't process if already triggered and can't retrigger
    if (hasTriggered && !canRetrigger) return;
    
    // Session-based limit
    if (sessionShownCount.current >= MAX_SHOWS_PER_SESSION) return;
    
    if (!visibilityState.current[index]) {
      visibilityState.current[index] = { visible: false, startTime: null };
    }
    
    const state = visibilityState.current[index];
    
    if (isVisible && !state.visible) {
      // Card became visible
      state.visible = true;
      state.startTime = Date.now();
      
      // Clear any existing debounce
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      
      // Set debounced trigger check (200ms debounce for fast scrolling)
      debounceTimer.current = setTimeout(() => {
        // Recheck if still visible after 120ms
        if (state.visible && state.startTime && 
            Date.now() - state.startTime >= 120 && !hasTriggered) {
          
          sessionShownCount.current += 1;
          setShowUpsellModal(true);
          setHasTriggered(true);
          setCanRetrigger(false);
        }
      }, 200);
      
    } else if (!isVisible && state.visible) {
      // Card became invisible
      state.visible = false;
      state.startTime = null;
      
      // Check if all blurred cards have left viewport
      const anyBlurredVisible = Object.values(visibilityState.current)
        .some(s => s.visible);
      
      if (!anyBlurredVisible && hasTriggered) {
        // Re-arm trigger after all blurred cards leave viewport
        setTimeout(() => {
          setCanRetrigger(true);
          setHasTriggered(false);
        }, 500);
      }
    }
  }, [hasTriggered, canRetrigger]);
  
  const dismissModal = useCallback(() => {
    setShowUpsellModal(false);
  }, []);
  
  const resetTrigger = useCallback(() => {
    setHasTriggered(false);
    setCanRetrigger(true);
    visibilityState.current = {};
    sessionShownCount.current = 0;
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);
  
  return {
    showUpsellModal,
    handleCardVisibility,
    dismissModal,
    resetTrigger,
  };
}