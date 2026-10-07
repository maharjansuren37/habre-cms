/**
 * Expands a validated proposal into one v4 document per page (18b1), through
 * the same ready-made templates the editor's palette uses (D170). Pure: no
 * database, no editor. 18b4 gives it the real slugs.
 *
 * Headings: the first hero on each page is that page's level-1 heading; every
 * other heading is level 2. A page with no hero has no level 1, so its title
 * is its main heading (`render.tsx`). Never two, which `parseDocument` refuses.
 */
import type {
  Block,
  Button,
  Column,
  Document,
  Heading,
  Paragraph,
  Section,
} from "../blocks/document-nodes.ts";
import { sectionTemplate } from "../blocks/section-templates.ts";
import type { Proposal, ProposalSection } from "./proposal.ts";

const text = (value: string) => [{ type: "text" as const, text: value }];

function fill<T extends Heading | Paragraph>(block: T, value: string): T {
  return { ...block, content: text(value) };
}

/** Where a button goes: a page of the proposal as `/<slug>`, or the home page. */
function hrefFor(target: string | undefined, slugs: Readonly<Record<string, string>>): string {
  if (target === undefined) return "/";
  const slug = slugs[target];
  if (slug === undefined) throw new Error(`No slug for page ${target}.`);
  return `/${slug}`;
}

function button(
  template: Button,
  label: string,
  target: string | undefined,
  slugs: Readonly<Record<string, string>>,
): Button {
  return { ...template, attrs: { ...template.attrs, label, href: hrefFor(target, slugs) } };
}

function expandSection(
  section: ProposalSection,
  mainHeading: boolean,
  slugs: Readonly<Record<string, string>>,
): Section {
  switch (section.kind) {
    case "hero": {
      const template = sectionTemplate("hero", { mainHeading });
      const [textColumn, imageColumn] = template.content as [Column, Column];
      const [h, p, space, b] = textColumn.content as [Heading, Paragraph, Block, Button];
      return {
        ...template,
        content: [
          {
            ...textColumn,
            content: [
              fill(h, section.heading),
              fill(p, section.body),
              space,
              section.buttonLabel === undefined
                ? b
                : button(b, section.buttonLabel, section.buttonTarget, slugs),
            ],
          },
          imageColumn,
        ],
      };
    }
    case "image-text": {
      const template = sectionTemplate("image-text", { mainHeading: false });
      const [imageColumn, textColumn] = template.content as [Column, Column];
      const [h, p] = textColumn.content as [Heading, Paragraph];
      return {
        ...template,
        content: [
          imageColumn,
          { ...textColumn, content: [fill(h, section.heading), fill(p, section.body)] },
        ],
      };
    }
    case "cta": {
      const template = sectionTemplate("cta", { mainHeading: false });
      const [column] = template.content as [Column];
      const [h, p, b] = column.content as [Heading, Paragraph, Button];
      return {
        ...template,
        content: [
          {
            ...column,
            content: [
              fill(h, section.heading),
              fill(p, section.body),
              button(
                b,
                section.buttonLabel,
                "buttonTarget" in section ? section.buttonTarget : undefined,
                slugs,
              ),
            ],
          },
        ],
      };
    }
    case "text": {
      const template = sectionTemplate("blank", { mainHeading: false });
      const [column] = template.content as [Column];
      const [blank] = column.content as [Paragraph];
      const heading: Heading = {
        type: "heading",
        attrs: { level: 2 },
        content: text(section.heading),
      };
      return {
        ...template,
        content: [
          { ...column, content: [heading, ...section.paragraphs.map((p) => fill(blank, p))] },
        ],
      };
    }
  }
}

/**
 * One document per page, keyed by page key. `slugs` maps every page key to the
 * slug it will have (no leading slash); a missing one throws, naming the key.
 */
export function expandProposal(
  proposal: Proposal,
  slugs: Readonly<Record<string, string>>,
): Record<string, Document> {
  const documents: Record<string, Document> = {};
  for (const page of proposal.pages) {
    const firstHero = page.sections.findIndex((section) => section.kind === "hero");
    documents[page.key] = {
      type: "doc",
      content: page.sections.map((section, index) =>
        expandSection(section, index === firstHero, slugs),
      ),
    };
  }
  return documents;
}
