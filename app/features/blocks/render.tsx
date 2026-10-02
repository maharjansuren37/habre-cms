import { Fragment } from "react";
import type {
  Block,
  CtaSection,
  HeroSection,
  ImageMediaSummary,
  ImageTextSection,
  Section,
} from "./blocks.ts";
import content from "./content.module.css";
import {
  type Block as Block4,
  type Document,
  findMainHeading,
  type Heading,
  isEmptyBlock,
  isEmptySection,
  type TextNode,
} from "./document-nodes.ts";
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

/**
 * A v4 document (item 14a1, D169) as the public site shows it: each node its
 * own element, built as JSX like everything above - never raw HTML. An empty
 * section, paragraph, heading, list item or block renders nothing, so a screen
 * reader never lands on an empty element (D118's rule, kept).
 *
 * Only the main heading a page chose (`findMainHeading`) is drawn as an `h1`,
 * and the caller then leaves the title out; a post's title is always its `h1`. Any other level-1 heading - a
 * post's, or a page's second, which `parseDocument` refuses but a stored row
 * could still hold - is drawn as an `h2`, so a page never has two `h1`s.
 *
 * Sections, columns and blocks take `content.module.css`, the one stylesheet
 * the editor's canvas shares (item 14a1, step 3), so both stack the same way.
 */
export function renderDocument(document: Document, type: "post" | "page") {
  const mainHeading = type === "page" ? findMainHeading(document) : undefined;
  return (
    <div className={content.document}>
      {document.content.map((section, sectionIndex) => {
        if (isEmptySection(section)) return null;
        return (
          <section
            // biome-ignore lint/suspicious/noArrayIndexKey: v4 nodes carry no id (D169)
            key={sectionIndex}
            className={content.section}
            data-align={section.attrs.align}
            data-background={section.attrs.background}
          >
            <div className={content.columns}>
              {section.content.map((column, columnIndex) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: v4 nodes carry no id (D169)
                <div key={columnIndex} className={content.column}>
                  {column.content.map((block, blockIndex) =>
                    renderDocumentBlock(block, `${blockIndex}`, mainHeading),
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

const HEADING_TAGS = ["h1", "h2", "h3", "h4", "h5", "h6"] as const;

function renderDocumentBlock(block: Block4, key: string, mainHeading: Heading | undefined) {
  if (isEmptyBlock(block)) return null;
  switch (block.type) {
    case "paragraph":
      return <p key={key}>{renderText(block.content)}</p>;
    case "heading": {
      const level = block.attrs.level === 1 && block !== mainHeading ? 2 : block.attrs.level;
      const Tag = HEADING_TAGS[level - 1] ?? "h6";
      return <Tag key={key}>{renderText(block.content)}</Tag>;
    }
    case "bulletList":
    case "orderedList": {
      const List = block.type === "orderedList" ? "ol" : "ul";
      return (
        <List key={key}>
          {block.content.map((item, index) =>
            isEmptyBlock(item.content[0]) ? null : (
              // biome-ignore lint/suspicious/noArrayIndexKey: v4 nodes carry no id (D169)
              <li key={index}>{renderText(item.content[0].content)}</li>
            ),
          )}
        </List>
      );
    }
    case "blockquote":
      return (
        <blockquote key={key}>
          {block.content.map((paragraph, index) =>
            isEmptyBlock(paragraph) ? null : (
              // biome-ignore lint/suspicious/noArrayIndexKey: v4 nodes carry no id (D169)
              <p key={index}>{renderText(paragraph.content)}</p>
            ),
          )}
        </blockquote>
      );
    default: {
      const exhaustive: never = block;
      throw new Error(`Unknown block type: ${JSON.stringify(exhaustive)}`);
    }
  }
}

/** One text node's marks nest as `<a><strong><em>text</em></strong></a>`, the
 *  same order `renderRuns` uses. */
function renderText(nodes: TextNode[] = []) {
  return nodes.map((node, index) => {
    let element: React.ReactNode = node.text;
    const marks = node.marks ?? [];
    if (marks.some((mark) => mark.type === "italic")) element = <em>{element}</em>;
    if (marks.some((mark) => mark.type === "bold")) element = <strong>{element}</strong>;
    const link = marks.find((mark) => mark.type === "link");
    if (link) element = <a href={link.attrs.href}>{element}</a>;
    // biome-ignore lint/suspicious/noArrayIndexKey: v4 nodes carry no id (D169)
    return <Fragment key={index}>{element}</Fragment>;
  });
}
