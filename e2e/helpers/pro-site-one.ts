import { setSiteLevel } from "./site-settings.ts";
import { siteOneId } from "./sites.ts";

/**
 * Users is a Pro screen (item 20), and several specs sign in to site 1 and visit
 * it. Site 1 is one shared row two workers read at once, so a spec that switched
 * it for itself would race another's; it is Pro for the whole run instead, and
 * put back to Simple, its default, when the run ends. The level and dark-mode
 * behaviour itself is tested on a site of its own (levels.spec.ts).
 */
export default async function globalSetup(): Promise<() => Promise<void>> {
  const siteId = await siteOneId();
  await setSiteLevel(siteId, "pro");
  return async () => {
    await setSiteLevel(siteId, "simple");
  };
}
