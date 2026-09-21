import { Fragment } from "react";
import type { Block } from "./blocks.ts";
import type { Run } from "./inline-runs.ts";

/**
 * Turns stored blocks into real elements for the public site - always JSX,
 * never `dangerouslySetInnerHTML` (D26, amended by D28): React escapes every
 * text node on its own, so there is nothing here to sanitize.
 *
 * Takes a plain `Block[]`, not an `Entry` - entry-type-agnostic on purpose, so
 * item 6 (pages) reuses this rather than a second renderer.
 */
export function renderBlocks(blocks: Block[]) {
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
      default: {
        // Exhaustive: a fourth block type (item 5's image block) fails here
        // at compile time, not silently at render time.
        const exhaustive: never = block;
        throw new Error(`Unknown block type: ${JSON.stringify(exhaustive)}`);
      }
    }
  });
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
