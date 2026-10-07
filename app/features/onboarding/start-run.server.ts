import { runner } from "#app/features/ai/runner.server.ts";
import { createStartRun } from "./start-run.ts";

/** Starts a run for onboarding; `null` when AI is off, so onboarding is not offered. */
export const startRun = runner ? createStartRun({ runner }) : null;
