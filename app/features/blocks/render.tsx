import { Fragment } from "react";
import type {
  Block,
  CtaSection,
  HeroSection,
  ImageMediaSummary,
  ImageTextSection,
  Section,
} from "./blocks.ts";
import type { Run } from "./inline-runs.ts";
import { nonEmptySections } from "./sections.ts";

/**
 * Turns stored blocks into real elements for the public site - always JSX,
 * never `dangerouslySetInnerHTML` (D26, amended by D28): React escapes every
 * text node on its own, so there is nothing here to sanitize.
 *
 * Takes a plain `Block[]`, not an `Entry` - entry-type-agnostic on purpose, so
 * item 6 (pages) reuses this rather than a second renderer.
 *
 * `mediaById` resolves an image block's id to a real url - built once by the
 * loader (`collectImageMediaIds` -> a single query), not fetched per block.
 * An id with no entry renders nothing: the plan's own stance is that a
 * missing image drops silently while the surrounding text still serves.
 */
export function renderBlocks(blocks: Block[], mediaById: Record<string, ImageMediaSummary> = {}) {
  return blocks.map((block) => {
    switch (block.type) {
      case "text":
        return <p key={block.id}>{renderRuns(block.data.text)}</p>;
      case "heading": {
        const Heading = block.data.level === 2 ? "h2" : "h3";
        return <Heading key={block.id}>{renderRuns(block.data.text)}</Heading>;
      }
      case "list": {
        const List = block.data.style === "number" ? "ol" : "ul";
        return (
          <List key={block.id}>
            {block.data.items.map((item, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: items carry no id of their own
              <li key={index}>{renderRuns(item)}</li>
            ))}
          </List>
        );
      }
      case "image": {
        const media = mediaById[block.data.mediaId];
        if (!media) return null;
        return (
          <figure key={block.id}>
            <img
              src={media.url}
              alt={media.altText}
              width={media.width}
              height={media.height}
              loading="lazy"
            />
            <figcaption>{media.altText}</figcaption>
          </figure>
        );
      }
      default: {
        // Exhaustive: a fifth block type fails here at compile time, not
        // silently at render time.
        const exhaustive: never = block;
        throw new Error(`Unknown block type: ${JSON.stringify(exhaustive)}`);
      }
    }
  });
}

/**
 * A page's sections, in order, each a `<section>` around its blocks. An empty
 * section renders nothing - no empty element for a screen reader to land on.
 * A section with several columns wraps one `<div data-column>` per column, in
 * column order, which is also the reading order when they stack. An empty
 * column is kept so the next one does not slide into its cell; the page's CSS
 * hides it when stacked. The layout itself is the page stylesheet's job.
 */
export function renderSections(
  sections: Section[],
  mediaById: Record<string, ImageMediaSummary> = {},
) {
  return nonEmptySections(sections).map((section) => {
    if (section.type === "hero") return renderHero(section);
    if (section.type === "cta") return renderCta(section);
    if (section.type === "image-text") return renderImageText(section, mediaById);
    const columns = section.data.children;
    if (columns.length === 1)
      return <section key={section.id}>{renderBlocks(columns.flat(), mediaById)}</section>;
    return (
      <section key={section.id}>
        <div data-columns={columns.length}>
          {columns.map((column, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: columns carry no id of their own
            <div key={index} data-column="">
              {renderBlocks(column, mediaById)}
            </div>
          ))}
        </div>
      </section>
    );
  });
}

/**
 * A ready-made hero (item 12a): heading, optional text, optional button. The
 * slots are plain strings, rendered as React text nodes. The page's own `<h1>`
 * is the title, so the heading is an `<h2>`.
 */
function renderHero(hero: HeroSection) {
  const { heading, text, button } = hero.data;
  return (
    <section key={hero.id} data-kind="hero">
      <h2>{heading}</h2>
      {text ? <p>{text}</p> : null}
      {button ? (
        <p>
          <a href={button.href} data-hero-button="">
            {button.label}
          </a>
        </p>
      ) : null}
    </section>
  );
}

/** A ready-made call to action (item 12b): the hero's slots with the button
 *  always present, as React text nodes. */
function renderCta(cta: CtaSection) {
  const { heading, text, button } = cta.data;
  return (
    <section key={cta.id} data-kind="cta">
      <h2>{heading}</h2>
      {text ? <p>{text}</p> : null}
      <p>
        <a href={button.href} data-cta-button="">
          {button.label}
        </a>
      </p>
    </section>
  );
}

/**
 * A ready-made image and text (item 12c): the picture, then the heading, text
 * and optional button. The alt text is the media row's own and there is no
 * caption - the picture sits beside its own words. An id with no media row
 * drops the picture and the text still renders, as an image block does.
 */
function renderImageText(section: ImageTextSection, mediaById: Record<string, ImageMediaSummary>) {
  const { mediaId, heading, text, button } = section.data;
  const media = mediaById[mediaId];
  return (
    <section key={section.id} data-kind="image-text">
      {media ? (
        <div data-image="">
          <img
            src={media.url}
            alt={media.altText}
            width={media.width}
            height={media.height}
            loading="lazy"
          />
        </div>
      ) : null}
      <div data-text="">
        <h2>{heading}</h2>
        {text ? <p>{text}</p> : null}
        {button ? (
          <p>
            <a href={button.href} data-hero-button="">
              {button.label}
            </a>
          </p>
        ) : null}
      </div>
    </section>
  );
}

/** One run's marks nest as `<a><strong><em>text</em></strong></a>` - only the
 *  marks actually present. */
export function renderRuns(runs: Run[]) {
  return runs.map((run, index) => {
    let node: React.ReactNode = run.text;
    if (run.italic) node = <em>{node}</em>;
    if (run.bold) node = <strong>{node}</strong>;
    if (run.href) node = <a href={run.href}>{node}</a>;
    // biome-ignore lint/suspicious/noArrayIndexKey: runs carry no id of their own
    return <Fragment key={index}>{node}</Fragment>;
  });
}
