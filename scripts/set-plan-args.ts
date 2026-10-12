// The argument rule for `npm run set-plan`, kept apart from the command so it
// can be unit-tested without a database.
export type SetPlanArgs = { address: string; plan: "free" | "paid" };

export function parseSetPlanArgs(input: {
  address?: string | undefined;
  plan?: string | undefined;
}): SetPlanArgs | { error: string } {
  const address = (input.address ?? "").trim().toLowerCase();
  if (address === "") return { error: "Missing --address <address>." };
  const plan = (input.plan ?? "").trim().toLowerCase();
  if (plan === "") return { error: "Missing --plan free|paid." };
  if (plan !== "free" && plan !== "paid") {
    return { error: `Unknown plan "${plan}": --plan must be free or paid.` };
  }
  return { address, plan };
}
