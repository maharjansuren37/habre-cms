import { NAV_MAX_ITEMS, type NavItem, navigationSchema } from "./navigation-input.ts";

/** One editable row of the navigation editor - always both fields present as
 *  strings, whichever the writer has used, so the row stays editable until
 *  Save turns it into a real `NavItem`. */
export type NavDraftRow = { label: string; pageId: string; url: string };

const emptyRow = (): NavDraftRow => ({ label: "", pageId: "", url: "" });

/** The saved navigation, as rows the editor can render and resubmit. */
export function navItemsToDraftRows(items: NavItem[]): NavDraftRow[] {
  return items.map((item) => ({
    label: item.label,
    pageId: "pageId" in item ? item.pageId : "",
    url: "url" in item ? item.url : "",
  }));
}

/** The rows as the writer last submitted them - every add/remove/move/save
 *  intent reads the form's current state rather than the stored settings, so
 *  an edit made to one row survives a button pressed on another. A count
 *  past the real cap is trimmed rather than trusted (a crafted request has no
 *  reason to send more than `NAV_MAX_ITEMS` rows, and the schema would refuse
 *  them at save anyway). */
export function parseDraftRows(form: FormData): NavDraftRow[] {
  const count = Math.min(Number(form.get("nav-count")), NAV_MAX_ITEMS);
  if (!Number.isInteger(count) || count < 0) return [];
  const rows: NavDraftRow[] = [];
  for (let index = 0; index < count; index++) {
    rows.push({
      label: String(form.get(`nav-label-${index}`) ?? ""),
      pageId: String(form.get(`nav-pageId-${index}`) ?? ""),
      url: String(form.get(`nav-url-${index}`) ?? ""),
    });
  }
  return rows;
}

export function addRow(rows: NavDraftRow[]): NavDraftRow[] {
  return rows.length >= NAV_MAX_ITEMS ? rows : [...rows, emptyRow()];
}

export function removeRow(rows: NavDraftRow[], index: number): NavDraftRow[] {
  return rows.filter((_, rowIndex) => rowIndex !== index);
}

export function moveRow(
  rows: NavDraftRow[],
  index: number,
  direction: "up" | "down",
): NavDraftRow[] {
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || index >= rows.length || target < 0 || target >= rows.length) return rows;
  const next = [...rows];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/**
 * Reshapes the draft for an add/remove/move button, or `null` when `intent`
 * is not one of those - the caller's signal to treat this as a save instead.
 * No validation here: reshaping only ever rearranges what was already
 * submitted, never writes to the database (current-work.md, Step 2).
 */
export function applyNavIntent(intent: string, rows: NavDraftRow[]): NavDraftRow[] | null {
  if (intent === "nav-add") return addRow(rows);
  const match = /^nav-(remove|move-up|move-down)-(\d+)$/.exec(intent);
  if (!match) return null;
  const index = Number(match[2]);
  if (match[1] === "remove") return removeRow(rows, index);
  return moveRow(rows, index, match[1] === "move-up" ? "up" : "down");
}

export type NavigationParseResult = { ok: true; items: NavItem[] } | { ok: false; message: string };

/**
 * Turns the submitted rows into the stored shape, or the one sentence the
 * admin reads. `validPageIds` is checked at save time (current status doesn't
 * matter here, current-work.md's Data and contracts) - a page removed since
 * the dropdown was rendered gets the same "choose it again" message F-89
 * already established for the logo, rather than an unhandled foreign-key-less
 * write of a dangling id.
 */
export function draftRowsToNavItems(
  rows: NavDraftRow[],
  validPageIds: ReadonlySet<string>,
): NavigationParseResult {
  const candidates: Record<string, unknown>[] = [];
  for (const [index, row] of rows.entries()) {
    const label = row.label.trim();
    const pageId = row.pageId.trim();
    const url = row.url.trim();
    // A row added and never touched again is dropped rather than forcing a
    // Remove click for something that was never really an item.
    if (label === "" && pageId === "" && url === "") continue;
    if (pageId !== "" && url !== "") {
      return {
        ok: false,
        message: `Item ${index + 1}: choose a page or type a web address, not both.`,
      };
    }
    if (pageId === "" && url === "") {
      return { ok: false, message: `Item ${index + 1}: choose a page or type a web address.` };
    }
    if (pageId !== "" && !validPageIds.has(pageId)) {
      return {
        ok: false,
        message: `Item ${index + 1}'s page could not be saved. Choose it again.`,
      };
    }
    candidates.push(pageId !== "" ? { label, pageId } : { label, url });
  }
  // The single source of truth for the stored shape's own rules (label
  // length, href safety, the item cap) - checked here once rather than
  // duplicated between this loop and the schema.
  const parsed = navigationSchema.safeParse(candidates);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "The menu could not be saved.",
    };
  }
  return { ok: true, items: parsed.data };
}
