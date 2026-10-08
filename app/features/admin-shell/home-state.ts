export type HomeState = "ready" | "review" | "start" | "none";

/**
 * Which panel tops Home (item 18b4a): the ready panel once a draft is used and
 * nothing is published; while onboarding is offered, the way back to an unused
 * finished draft, else the way to start one; otherwise none.
 */
export function homeState(state: {
  published: boolean;
  applied: boolean;
  offered: boolean;
  latestFinished: "succeeded" | "applied" | null;
}): HomeState {
  if (state.applied && !state.published) return "ready";
  if (state.offered && state.latestFinished === "succeeded") return "review";
  if (state.offered) return "start";
  return "none";
}
