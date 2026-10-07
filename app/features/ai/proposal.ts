/**
 * The AI's proposal for a new site (18b1, D154): the shape 18b3-18b5 read, so
 * the field names are final. It is untrusted input - this schema is the first
 * gate, `parseDocument` on the expanded pages the second. Plain text only: no
 * markup, no links, no control characters; the model never writes a URL.
 *
 * The bounds live here, not in the schema sent to the provider, because
 * structured output does not guarantee every constraint. Provider-facing
 * strict schemas need every property required, so the optional button slots
 * accept `null` as well as absent and are normalised to absent.
 */
import { z } from "zod";

export const MAX_PAGES = 6;
export const MAX_SECTIONS_PER_PAGE = 8;
export const MAX_PARAGRAPHS = 3;

/** Plain text: no C0 or C1 control character (a newline included), no DEL, no lone surrogate. */
// biome-ignore lint/suspicious/noControlCharactersInRegex: matching them is the point
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/;

const plainText = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .refine((text) => text.trim() !== "", "Text cannot be only spaces.")
    .refine(
      (text) => !CONTROL_CHARACTERS.test(text) && text.isWellFormed(),
      "Text cannot hold control characters.",
    );

const heading = plainText(120);
const body = plainText(1200);
const buttonLabel = plainText(40);
const pageKey = z.string().regex(/^p[1-6]$/, 'A page key is "p1" to "p6".');

/** An optional slot: absent or null, and absent either way once parsed. */
function dropNullButtons<T extends { buttonLabel?: string | null; buttonTarget?: string | null }>(
  section: T,
) {
  const { buttonLabel: label, buttonTarget: target, ...rest } = section;
  return {
    ...rest,
    ...(label != null ? { buttonLabel: label } : {}),
    ...(target != null ? { buttonTarget: target } : {}),
  };
}

const heroSection = z
  .object({
    kind: z.literal("hero"),
    heading,
    body,
    buttonLabel: buttonLabel.nullish(),
    buttonTarget: pageKey.nullish(),
  })
  .transform(dropNullButtons);

const imageTextSection = z.object({ kind: z.literal("image-text"), heading, body });

const ctaSection = z
  .object({
    kind: z.literal("cta"),
    heading,
    body,
    buttonLabel,
    buttonTarget: pageKey.nullish(),
  })
  .transform(({ buttonTarget, ...rest }) =>
    buttonTarget != null ? { ...rest, buttonTarget } : rest,
  );

const textSection = z.object({
  kind: z.literal("text"),
  heading,
  paragraphs: z.array(body).min(1).max(MAX_PARAGRAPHS),
});

const sectionSchema = z.discriminatedUnion("kind", [
  heroSection,
  imageTextSection,
  ctaSection,
  textSection,
]);

const pageSchema = z.object({
  key: pageKey,
  title: plainText(80),
  seoTitle: plainText(70),
  seoDescription: plainText(300),
  sections: z.array(sectionSchema).min(1).max(MAX_SECTIONS_PER_PAGE),
});

export const proposalSchema = z
  .object({
    siteDescription: plainText(300),
    brandColor: z
      .string()
      .regex(/^#[0-9a-f]{6}$/, "A colour is lowercase #rrggbb.")
      .nullable(),
    pages: z.array(pageSchema).min(1).max(MAX_PAGES),
    navigation: z.array(pageKey).min(1).max(MAX_PAGES),
  })
  .superRefine((proposal, ctx) => {
    const keys = new Set<string>();
    proposal.pages.forEach((page, index) => {
      if (keys.has(page.key)) {
        ctx.addIssue({
          code: "custom",
          path: ["pages", index, "key"],
          message: "Repeated page key.",
        });
      }
      keys.add(page.key);
    });
    proposal.pages.forEach((page, pageIndex) => {
      page.sections.forEach((section, sectionIndex) => {
        if ("buttonTarget" in section && section.buttonTarget && !keys.has(section.buttonTarget)) {
          ctx.addIssue({
            code: "custom",
            path: ["pages", pageIndex, "sections", sectionIndex, "buttonTarget"],
            message: "A button can only go to a page of this proposal.",
          });
        }
      });
    });
    const seen = new Set<string>();
    proposal.navigation.forEach((key, index) => {
      if (!keys.has(key) || seen.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: ["navigation", index],
          message: "Navigation lists each page of the proposal once.",
        });
      }
      seen.add(key);
    });
  });

export type Proposal = z.infer<typeof proposalSchema>;
export type ProposalPage = Proposal["pages"][number];
export type ProposalSection = ProposalPage["sections"][number];
