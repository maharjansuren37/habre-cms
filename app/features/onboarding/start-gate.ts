export type StartGate = { kind: "offer" } | { kind: "redirect"; to: "/admin" };

/**
 * Whether onboarding is offered: AI on, the site not suspended, nothing
 * published, and no AI draft used yet - a site uses one draft in v1 (18b4a).
 */
export function startGate(state: {
  aiOn: boolean;
  suspended: boolean;
  published: boolean;
  applied: boolean;
}): StartGate {
  if (!state.aiOn || state.suspended || state.published || state.applied) {
    return { kind: "redirect", to: "/admin" };
  }
  return { kind: "offer" };
}
