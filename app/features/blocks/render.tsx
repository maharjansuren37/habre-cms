import { Fragment } from "react";
import content from "./content.module.css";
import {
  type Block,
  blocksOf,
  type Document,
  type DocumentMedia,
  findMainHeading,
  type Heading,
  isEmptyBlock,
  isRenderedBlock,
  type TextNode,
} from "./document-nodes.ts";
import { imageSizes } from "./image-sizes.ts";

/**
 * A v4 document (item 14a1, D169) as the public site shows it: each node its
 * own element, always built as JSX, never `dangerouslySetInnerHTML` (D26,
 * amended by D28) - React escapes every text node on its own, so there is
 * nothing here to sanitize. An empty section, paragraph, heading, list item or
 * block renders nothing, so a screen reader never lands on an empty element
 * (D118's rule, kept). A section in which nothing renders - empty text, spaces,
 * a button without text or an address, an image whose media is gone - is
 * dropped whole (item 14a2).
 *
 * An image is an `img` with its media's alt text and never a `figure` or
 * `figcaption`, so a screen reader reads the alt text once (F-79). The first
 * image in the document loads at once with high priority, the rest lazily
 * (D174). A button is a link; a line is an `hr`; a space is an empty,
 * hidden `div` that only takes room.
 *
 * Only the main heading a page chose (`findMainHeading`) is drawn as an `h1`,
 * and the caller then leaves the title out; a post's title is always its `h1`.
 * Any other level-1 heading - a post's, or a page's second, which
 * `parseDocument` refuses but a stored row could still hold - is drawn as an
 * `h2`, so a page never has two `h1`s.
 *
 * Sections, columns and blocks take `content.module.css`, the one stylesheet
 * the editor's canvas shares (item 14a1, step 3), so both stack the same way.
 *
 * `hrefFor` rewrites a button's and an inline link's address; the admin's
 * preview uses it to keep links inside the preview. The public site passes
 * nothing, so its output is unchanged.
 */
export function renderDocument(
  document: Document,
  type: "post" | "page",
  mediaById: Readonly<Record<string, DocumentMedia>>,
  hrefFor: (href: string) => string = (href) => href,
) {
  const mainHeading = type === "page" ? findMainHeading(document) : undefined;
  const firstImage = blocksOf(document).find(
    (block) => block.type === "image" && isRenderedBlock(block, mediaById),
  );
  return (
    <div className={content.document}>
      {document.content.map((section, sectionIndex) => {
        const rendersSomething = section.content.some((column) =>
          column.content.some((block) => isRenderedBlock(block, mediaById)),
        );
        if (!rendersSomething) return null;
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
                    renderDocumentBlock(
                      block,
                      `${blockIndex}`,
                      mainHeading,
                      mediaById,
                      block === firstImage,
                      section.content.length,
                      hrefFor,
                    ),
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

function renderDocumentBlock(
  block: Block,
  key: string,
  mainHeading: Heading | undefined,
  mediaById: Readonly<Record<string, DocumentMedia>>,
  isFirstImage: boolean,
  columns: number,
  hrefFor: (href: string) => string,
) {
  // A space is not "rendered" (it cannot keep a section alive) but still takes
  // room between the blocks that are.
  if (block.type === "space") return <div key={key} className={content.space} aria-hidden="true" />;
  if (!isRenderedBlock(block, mediaById)) return null;
  switch (block.type) {
    case "paragraph":
      return <p key={key}>{renderText(block.content, hrefFor)}</p>;
    case "heading": {
      const level = block.attrs.level === 1 && block !== mainHeading ? 2 : block.attrs.level;
      const Tag = HEADING_TAGS[level - 1] ?? "h6";
      return <Tag key={key}>{renderText(block.content, hrefFor)}</Tag>;
    }
    case "bulletList":
    case "orderedList": {
      const List = block.type === "orderedList" ? "ol" : "ul";
      return (
        <List key={key}>
          {block.content.map((item, index) =>
            isEmptyBlock(item.content[0]) ? null : (
              // biome-ignore lint/suspicious/noArrayIndexKey: v4 nodes carry no id (D169)
              <li key={index}>{renderText(item.content[0].content, hrefFor)}</li>
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
              <p key={index}>{renderText(paragraph.content, hrefFor)}</p>
            ),
          )}
        </blockquote>
      );
    case "image": {
      const media = mediaById[block.attrs.mediaId];
      if (!media) return null; // isRenderedBlock said it exists; keeps the type honest
      return (
        <img
          key={key}
          className={content.image}
          src={media.url}
          {...(media.srcset ? { srcSet: media.srcset, sizes: imageSizes(columns) } : {})}
          alt={media.altText}
          width={media.width}
          height={media.height}
          {...(isFirstImage ? { fetchPriority: "high" as const } : { loading: "lazy" as const })}
        />
      );
    }
    case "button":
      return (
        <a
          key={key}
          href={hrefFor(block.attrs.href)}
          className={`${content.button} ${block.attrs.style === "outline" ? content.outline : content.filled}`}
        >
          {block.attrs.label}
        </a>
      );
    case "contactForm":
      return null;
    case "horizontalRule":
      return <hr key={key} className={content.line} />;
    default: {
      const exhaustive: never = block;
      throw new Error(`Unknown block type: ${JSON.stringify(exhaustive)}`);
    }
  }
}

/** One text node's marks nest as `<a><strong><em>text</em></strong></a>` - only
 *  the marks actually present. */
function renderText(nodes: TextNode[] | undefined, hrefFor: (href: string) => string) {
  return (nodes ?? []).map((node, index) => {
    let element: React.ReactNode = node.text;
    const marks = node.marks ?? [];
    if (marks.some((mark) => mark.type === "italic")) element = <em>{element}</em>;
    if (marks.some((mark) => mark.type === "bold")) element = <strong>{element}</strong>;
    const link = marks.find((mark) => mark.type === "link");
    if (link) element = <a href={hrefFor(link.attrs.href)}>{element}</a>;
    // biome-ignore lint/suspicious/noArrayIndexKey: v4 nodes carry no id (D169)
    return <Fragment key={index}>{element}</Fragment>;
  });
}
