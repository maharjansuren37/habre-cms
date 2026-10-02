import { Fragment } from "react";
import content from "./content.module.css";
import {
  type Block,
  type Document,
  findMainHeading,
  type Heading,
  isEmptyBlock,
  isEmptySection,
  type TextNode,
} from "./document-nodes.ts";

/**
 * A v4 document (item 14a1, D169) as the public site shows it: each node its
 * own element, always built as JSX, never `dangerouslySetInnerHTML` (D26,
 * amended by D28) - React escapes every text node on its own, so there is
 * nothing here to sanitize. An empty section, paragraph, heading, list item or
 * block renders nothing, so a screen reader never lands on an empty element
 * (D118's rule, kept).
 *
 * Only the main heading a page chose (`findMainHeading`) is drawn as an `h1`,
 * and the caller then leaves the title out; a post's title is always its `h1`.
 * Any other level-1 heading - a post's, or a page's second, which
 * `parseDocument` refuses but a stored row could still hold - is drawn as an
 * `h2`, so a page never has two `h1`s.
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

function renderDocumentBlock(block: Block, key: string, mainHeading: Heading | undefined) {
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

/** One text node's marks nest as `<a><strong><em>text</em></strong></a>` - only
 *  the marks actually present. */
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
