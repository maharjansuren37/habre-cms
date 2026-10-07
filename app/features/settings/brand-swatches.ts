/** What is chosen: a swatch kind, or - for one of the logo's colours - its `#rrggbb`. */
export type ColourChoice = "none" | "saved" | "other" | (string & {});

export type Swatch = {
  key: string;
  kind: "none" | "saved" | "logo" | "other";
  /** The radio's value: "" for No colour. */
  value: string;
  checked: boolean;
};

/** The brand colour row: No colour, the saved colour, the logo's colours, Other colour. A logo
 *  colour equal to the saved one is listed once, as the logo's. Only `choice` checks a swatch -
 *  a logo colour is never chosen by itself (AI and the logo suggest, the user applies). */
export function brandSwatches(
  saved: string,
  logoColours: string[],
  choice: ColourChoice,
  other = "",
): Swatch[] {
  const savedIsLogo = saved !== "" && logoColours.includes(saved);
  const swatches: Swatch[] = [{ key: "none", kind: "none", value: "", checked: choice === "none" }];
  if (saved && !savedIsLogo) {
    swatches.push({ key: "saved", kind: "saved", value: saved, checked: choice === "saved" });
  }
  for (const hex of logoColours) {
    const standsForSaved = hex === saved && choice === "saved";
    swatches.push({
      key: `logo-${hex}`,
      kind: "logo",
      value: hex,
      checked: choice === hex || standsForSaved,
    });
  }
  swatches.push({ key: "other", kind: "other", value: other, checked: choice === "other" });
  return swatches;
}

/** The colour a choice stands for; "" is no colour. */
export function choiceColour(choice: ColourChoice, saved: string, other: string): string {
  if (choice === "none") return "";
  if (choice === "saved") return saved;
  if (choice === "other") return other;
  return choice;
}

/** The logo changed or went. A chosen logo colour that is no longer offered stays chosen as
 *  Other colour with the same hex, so the preview never changes unasked. */
export function choiceAfterLogoChange(
  choice: ColourChoice,
  saved: string,
  newLogoColours: string[],
  other: string,
): { choice: ColourChoice; other: string } {
  if (choice === "none" || choice === "saved" || choice === "other") return { choice, other };
  if (newLogoColours.includes(choice)) return { choice, other };
  if (choice === saved) return { choice: "saved", other };
  return { choice: "other", other: choice };
}
