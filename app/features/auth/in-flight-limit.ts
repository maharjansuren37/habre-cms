export type InFlightLimit = {
  /** Takes a slot if one is free; the caller must `release()` it on every path. */
  tryAcquire(): boolean;
  release(): void;
};

/** Caps how many operations run at once, refusing the rest rather than queueing them. */
export function createInFlightLimit(max: number): InFlightLimit {
  let inFlight = 0;
  return {
    tryAcquire() {
      if (inFlight >= max) return false;
      inFlight += 1;
      return true;
    },
    release() {
      inFlight = Math.max(0, inFlight - 1);
    },
  };
}
