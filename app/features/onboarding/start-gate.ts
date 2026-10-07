export type StartGate = { kind: "offer" } | { kind: "redirect"; to: "/admin" };

/** Whether onboarding is offered: AI on, the site not suspended, nothing published. */
export function startGate(state: {
  aiOn: boolean;
  suspended: boolean;
  published: boolean;
}): StartGate {
  if (!state.aiOn || state.suspended || state.published) return { kind: "redirect", to: "/admin" };
  return { kind: "offer" };
}
