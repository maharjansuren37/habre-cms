import { useEffect, useRef, useState } from "react";
import { applyBrandProperties } from "#app/features/brand/apply-brand.ts";
import { parseBrandColor } from "#app/features/brand/brand-colours.ts";
import { colourWord } from "#app/features/brand/logo-colours.ts";
import styles from "./brand-fields.module.css";
import {
  brandSwatches,
  type ColourChoice,
  choiceAfterLogoChange,
  choiceColour,
} from "./brand-swatches.ts";
import { type Logo, LogoField } from "./logo-field.tsx";
import { stylePresetSchema } from "./settings-input.ts";

const STYLE_PRESETS = [
  { value: "classic", label: "Classic", sample: "Serif headings" },
  { value: "modern", label: "Modern", sample: "Clean and sharp" },
  { value: "friendly", label: "Friendly", sample: "Soft and round" },
] as const;

function capitalise(word: string) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** Through the CSSOM, never a style attribute: the admin's style-src has no 'unsafe-inline'. */
function setSwatchColour(element: HTMLElement | null, colour: string) {
  element?.style.setProperty("--swatch", colour);
}

/** What a site has saved for the Brand section. */
export type SavedBrand = {
  logoMediaId: string | null;
  logoUrl: string | null;
  logoColours: string[];
  /** `#rrggbb`, or `""` for No colour. */
  brandColor: string;
  stylePreset: string;
  siteTitle: string;
};

/** What the last post of the form carried, when a save was refused: it wins over the saved
 *  values, so the choices a person made survive the refusal. */
export type SubmittedBrand = {
  /** `null` when the post carried no Brand section. */
  brandColor: string | null;
  stylePreset: string | null;
  errors: { brandColor?: string; stylePreset?: string };
};

/** The Logo field, Brand colour, Style and the live preview. It renders form fields
 *  (logoMediaId, brandColor, stylePreset) into whichever form contains it, and owns the
 *  logo, the colour choice and the preview state. */
export function BrandFields({
  saved,
  submitted,
  aiColour,
  split,
}: {
  saved: SavedBrand;
  submitted?: SubmittedBrand | undefined;
  /** `undefined`: Settings, no AI swatch. `null`: offer Let the AI choose with no colour yet.
   *  A `#rrggbb`: the colour the AI suggested. */
  aiColour?: string | null | undefined;
  /** Onboarding step 3: from 1024px the preview sits beside the fields and stays in view. */
  split?: boolean;
}) {
  const offersAi = aiColour !== undefined;
  const errors = submitted?.errors ?? {};
  const [logo, setLogo] = useState<Logo | null>(
    saved.logoMediaId && saved.logoUrl
      ? {
          id: saved.logoMediaId,
          url: saved.logoUrl,
          filename: "",
          colours: saved.logoColours,
        }
      : null,
  );
  const savedColour = saved.brandColor;
  const submittedColour = parseBrandColor(submitted?.brandColor ?? "");
  const colourDefault = submitted?.brandColor != null ? submittedColour : savedColour;
  const submittedPreset = stylePresetSchema.safeParse(submitted?.stylePreset);
  const presetDefault = submittedPreset.success ? submittedPreset.data : saved.stylePreset;
  // "Other colour" holds whatever the colour picker says. It starts on the saved
  // colour (or a neutral green to start from) and is only checked when the
  // colour in play is neither No colour nor the saved one.
  const startsOnLogoColour =
    colourDefault !== "" &&
    colourDefault !== savedColour &&
    saved.logoColours.includes(colourDefault);
  const otherIsChecked =
    colourDefault !== "" && colourDefault !== savedColour && !startsOnLogoColour;
  const [otherColour, setOtherColour] = useState(
    otherIsChecked ? colourDefault : savedColour || "#2f6b5a",
  );
  // Which swatch is chosen. Controlled, because a radio checked by script would not tell
  // React it changed (its value tracker would swallow the next click on the one it unchecked).
  const [colourChoice, setColourChoice] = useState<ColourChoice>(
    offersAi && colourDefault === ""
      ? "ai"
      : startsOnLogoColour
        ? colourDefault
        : otherIsChecked
          ? "other"
          : colourDefault === ""
            ? "none"
            : "saved",
  );
  const previewColour = choiceColour(colourChoice, savedColour, otherColour, aiColour);
  // A chosen colour never moves by itself when the logo changes or goes.
  function changeLogo(next: Logo | null) {
    const kept = choiceAfterLogoChange(colourChoice, savedColour, next?.colours ?? [], otherColour);
    setLogo(next);
    setColourChoice(kept.choice);
    setOtherColour(kept.other);
  }
  // What the preview shows for Style: the saved choice to start with, then whatever is picked.
  const [previewPreset, setPreviewPreset] = useState<string>(presetDefault);
  const previewFrameRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    applyBrandProperties(previewFrameRef.current, previewColour);
  }, [previewColour]);

  return (
    <>
      <input type="hidden" name="logoMediaId" value={logo?.id ?? ""} />
      <LogoField logo={logo} onChange={changeLogo} />
      <div className={split ? `${styles.brandArea} ${styles.brandAreaSplit}` : styles.brandArea}>
        <fieldset className={styles.brandField} aria-describedby="brandColor-hint">
          <legend className={styles.logoLabel}>Brand colour</legend>
          <p id="brandColor-hint" className={styles.navHint}>
            Buttons and links use it. We adjust the shade where needed so text on your site stays
            easy to read.
          </p>
          {/* A list of swatches, so the logo's colours (item 18a2) are appended here. Each
        colour reaches its swatch through the CSSOM (setSwatchColour): a style attribute
        is blocked by the admin's style-src. */}
          <ul className={styles.swatches}>
            {brandSwatches(
              savedColour,
              logo?.colours ?? [],
              colourChoice,
              otherColour,
              offersAi ? { colour: aiColour } : undefined,
            ).map((swatch) => {
              if (swatch.kind === "none") {
                return (
                  <li key={swatch.key}>
                    <label className={`${styles.swatch} ${styles.swatchInk}`}>
                      <input
                        type="radio"
                        name="brandColor"
                        value=""
                        checked={swatch.checked}
                        onChange={() => setColourChoice("none")}
                      />
                      <span className={styles.swatchDot} aria-hidden="true" />
                      <span className={styles.swatchName}>
                        No colour<span className="visually-hidden"> (black and white)</span>
                      </span>
                    </label>
                  </li>
                );
              }
              if (swatch.kind === "ai") {
                const aiHex = swatch.colour ?? null;
                return (
                  <li key={swatch.key}>
                    <label className={styles.swatch}>
                      <input
                        type="radio"
                        name="brandColor"
                        value=""
                        checked={swatch.checked}
                        onChange={() => setColourChoice("ai")}
                      />
                      <span
                        className={`${styles.swatchDot} ${aiHex ? "" : styles.swatchAiPending}`}
                        aria-hidden="true"
                        ref={(el) => setSwatchColour(el, aiHex ?? "")}
                      />
                      <span className={styles.swatchName}>
                        {aiHex ? (
                          <>
                            <span className="visually-hidden">
                              {capitalise(colourWord(aiHex))}, suggested by AI{" "}
                            </span>
                            {aiHex}
                          </>
                        ) : (
                          "Let the AI choose"
                        )}
                      </span>
                    </label>
                  </li>
                );
              }
              if (swatch.kind === "other") {
                return (
                  <li key={swatch.key} className={styles.otherSwatch}>
                    <label className={styles.swatch}>
                      <input
                        type="radio"
                        name="brandColor"
                        value={swatch.value}
                        checked={swatch.checked}
                        onChange={() => setColourChoice("other")}
                      />
                      <span
                        className={styles.swatchDot}
                        aria-hidden="true"
                        ref={(el) => setSwatchColour(el, swatch.value)}
                      />
                      <span className={styles.swatchName}>Other colour</span>
                    </label>
                    <input
                      type="color"
                      className={styles.colourInput}
                      aria-label="Pick other colour"
                      value={otherColour}
                      // Opening the picker selects Other; so does a new colour (a click is not
                      // needed to change one by keyboard). Focus alone does not, so tabbing
                      // past it changes nothing.
                      onClick={() => setColourChoice("other")}
                      onChange={(event) => {
                        setOtherColour(event.target.value);
                        setColourChoice("other");
                      }}
                    />
                  </li>
                );
              }
              const isLogo = swatch.kind === "logo";
              return (
                <li key={swatch.key}>
                  <label className={styles.swatch}>
                    <input
                      type="radio"
                      name="brandColor"
                      value={swatch.value}
                      checked={swatch.checked}
                      onChange={() => setColourChoice(isLogo ? swatch.value : "saved")}
                    />
                    <span
                      className={styles.swatchDot}
                      aria-hidden="true"
                      ref={(el) => setSwatchColour(el, swatch.value)}
                    />
                    <span className={styles.swatchName}>
                      <span className="visually-hidden">
                        {isLogo
                          ? `${capitalise(colourWord(swatch.value))} from your logo, `
                          : "Saved colour "}
                      </span>
                      {swatch.value}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          {errors.brandColor && <p className={styles.fieldError}>{errors.brandColor}</p>}
        </fieldset>
        <fieldset
          className={styles.brandField}
          aria-describedby="stylePreset-hint"
          onChange={(event) => {
            if (event.target instanceof HTMLInputElement) setPreviewPreset(event.target.value);
          }}
        >
          <legend className={styles.logoLabel}>Style</legend>
          <p id="stylePreset-hint" className={styles.navHint}>
            Fonts and corners. Your colour stays the same.
          </p>
          <div className={styles.presetCards}>
            {STYLE_PRESETS.map((preset) => (
              <label key={preset.value} className={styles.presetCard}>
                <input
                  type="radio"
                  name="stylePreset"
                  value={preset.value}
                  defaultChecked={presetDefault === preset.value}
                />
                <span
                  className={styles.presetSample}
                  data-surface="site"
                  data-style={preset.value}
                  aria-hidden="true"
                >
                  <span className={styles.presetAa}>Aa</span>
                  <span className={styles.presetText}>{preset.sample}</span>
                  <span className={styles.presetButton}>Book</span>
                </span>
                <span className={styles.presetTitle}>{preset.label}</span>
              </label>
            ))}
          </div>
          {errors.stylePreset && <p className={styles.fieldError}>{errors.stylePreset}</p>}
        </fieldset>
        {/* The mock's half-size preview (start-brand.html): an image to assistive technology,
      so its contents are presentational and add nothing to the page's outline. The
      frame's colours are set through the CSSOM (applyBrandProperties). */}
        <div className={styles.preview}>
          <div
            className={styles.previewWindow}
            role="img"
            aria-label="Preview of your site with this logo, colour and style"
          >
            <div
              className={styles.previewFrame}
              ref={previewFrameRef}
              data-surface="site"
              data-style={previewPreset}
              aria-hidden="true"
            >
              <div className={styles.previewBar}>
                <span className={styles.previewBrand}>
                  {logo ? (
                    <img src={logo.url} alt="" className={styles.previewLogo} />
                  ) : (
                    <span className={styles.previewWordmark} data-preview="name">
                      {saved.siteTitle}
                    </span>
                  )}
                </span>
                <span className={styles.previewMenu}>Home &nbsp; About &nbsp; Contact</span>
              </div>
              <div className={styles.previewBody}>
                <p className={styles.previewHeading} data-preview="heading">
                  Welcome to your site
                </p>
                <p className={styles.previewText}>A few words about what you do and who for.</p>
                <span className={styles.previewButton} data-preview="button">
                  Get in touch
                </span>
                <span className={styles.previewLink} data-preview="link">
                  Read more
                </span>
              </div>
            </div>
          </div>
          <p className={styles.previewCaption}>Your home page, as visitors will see it.</p>
        </div>
      </div>
    </>
  );
}
