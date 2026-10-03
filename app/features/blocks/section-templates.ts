/**
 * The ready-made section templates (D170): plain v4 JSON with every text empty,
 * shared by the editor's palette (14c1) and the AI's section kinds (18b).
 * Pure - no editor import - so the server can expand a kind the same way.
 */
import type {
  Block,
  Button,
  Column,
  Heading,
  Image,
  Paragraph,
  Section,
} from "./document-nodes.ts";

export const SECTION_TEMPLATES = ["blank", "hero", "image-text", "cta"] as const;
export type SectionTemplate = (typeof SECTION_TEMPLATES)[number];

const emptyParagraph = (): Paragraph => ({ type: "paragraph" });
const emptyHeading = (level: number): Heading => ({ type: "heading", attrs: { level } });
const emptyImage = (): Image => ({ type: "image", attrs: { mediaId: "" } });
const emptyButton = (): Button => ({
  type: "button",
  attrs: { label: "", href: "", style: "filled" },
});
const column = (...content: Block[]): Column => ({ type: "column", content });

/** One template as a section; `mainHeading` makes the hero's heading the page's level 1. */
export function sectionTemplate(kind: SectionTemplate, options: { mainHeading: boolean }): Section {
  switch (kind) {
    case "blank":
      return {
        type: "section",
        attrs: { align: "top", background: "none" },
        content: [column(emptyParagraph())],
      };
    case "hero":
      return {
        type: "section",
        attrs: { align: "middle", background: "none" },
        content: [
          column(
            emptyHeading(options.mainHeading ? 1 : 2),
            emptyParagraph(),
            { type: "space" },
            emptyButton(),
          ),
          column(emptyImage()),
        ],
      };
    case "image-text":
      return {
        type: "section",
        attrs: { align: "top", background: "none" },
        content: [column(emptyImage()), column(emptyHeading(2), emptyParagraph())],
      };
    case "cta":
      return {
        type: "section",
        attrs: { align: "top", background: "band" },
        content: [column(emptyHeading(2), emptyParagraph(), emptyButton())],
      };
  }
}
