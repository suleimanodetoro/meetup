// hooks/useUpsellTrigger.ts
import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_DWELL_MS = 200;
// Single fire per session. Apple has historically rejected apps that show a
// paywall multiple times in one session — and from a UX standpoint, once the
// user has dismissed it they've made a decision, nagging twice more is rude.
// If a fundraising flow ever needs the old 3-per-session "nag-on-scroll"
// behaviour, raise this — the per-index dwell logic supports it cleanly.
const DEFAULT_MAX_PER_SESSION = 1;

interface Options {
  /** Milliseconds a qualifying card must stay in view before the modal fires. */
  dwellMs?: number;
  /** Soft cap so a free user isn't nagged repeatedly per session. */
  maxPerSession?: number;
}

/**
 * Tiny state machine: "card at index N entered → start a per-index timer; if
 * the card leaves before the dwell completes, cancel the timer; if a timer
 * completes, fire the modal and cancel all the others."
 *
 * The hook intentionally knows nothing about subscription status, blur
 * thresholds, or which list it's wired to. The caller is responsible for
 * deciding which indices are "paywall-eligible" and only reporting those.
 * That keeps this hook's contract narrow and easy to verify.
 *
 * Replaces a prior version that shared a single timer across all indices
 * and tracked too much implicit state — see the rewrite commit for context.
 */
export function useUpsellTrigger(opts: Options = {}) {
  const dwellMs = opts.dwellMs ?? DEFAULT_DWELL_MS;
  const maxPerSession = opts.maxPerSession ?? DEFAULT_MAX_PER_SESSION;

  const [visible, setVisible] = useState(false);
  const shownCountRef = useRef(0);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const cancelAllTimers = useCallback(() => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current.clear();
  }, []);

  const cardEntered = useCallback(
    (index: number) => {
      if (visible) return; // modal already open — no new dwell tracking
      if (shownCountRef.current >= maxPerSession) return;
      if (timersRef.current.has(index)) return; // already armed for this index

      const timer = setTimeout(() => {
        timersRef.current.delete(index);
        // Re-check the cap at fire time in case multiple dwells overlapped.
        if (shownCountRef.current >= maxPerSession) return;
        shownCountRef.current += 1;
        // Cancel every other pending dwell — the modal is about to take over
        // the screen, those dwells would just queue redundant fires.
        cancelAllTimers();
        setVisible(true);
      }, dwellMs);

      timersRef.current.set(index, timer);
    },
    [dwellMs, maxPerSession, visible, cancelAllTimers],
  );

  const cardLeft = useCallback((index: number) => {
    const t = timersRef.current.get(index);
    if (t) {
      clearTimeout(t);
      timersRef.current.delete(index);
    }
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    // Clear pending timers so a queued-up dwell doesn't immediately re-open
    // the modal after the user has just dismissed it.
    cancelAllTimers();
  }, [cancelAllTimers]);

  // Belt-and-suspenders cleanup if the consumer unmounts mid-dwell.
  useEffect(() => () => cancelAllTimers(), [cancelAllTimers]);

  return { visible, cardEntered, cardLeft, dismiss };
}
