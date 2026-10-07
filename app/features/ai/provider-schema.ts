/**
 * The JSON schema sent to the provider (18b1 Step 7): the proposal's shape
 * only. Strict structured output wants every property required and
 * `additionalProperties: false`, so the optional button slots are required and
 * nullable here, and no bound (length, item count) is sent - our own
 * `proposalSchema` enforces those afterwards, because structured output does
 * not guarantee them. A hand-written mirror of `proposalSchema`, kept honest by
 * a test that a valid proposal passes both. The section choice is a plain union
 * so it comes out as `anyOf` (`oneOf` is not supported by strict mode).
 */
import { z } from "zod";

const text = z.string();
const pageKey = z.string();

const sections = z.union([
  z.object({
    kind: z.literal("hero"),
    heading: text,
    body: text,
    buttonLabel: text.nullable(),
    buttonTarget: pageKey.nullable(),
  }),
  z.object({ kind: z.literal("image-text"), heading: text, body: text }),
  z.object({
    kind: z.literal("cta"),
    heading: text,
    body: text,
    buttonLabel: text,
    buttonTarget: pageKey.nullable(),
  }),
  z.object({ kind: z.literal("text"), heading: text, paragraphs: z.array(text) }),
]);

export const providerProposalShape = z.object({
  siteDescription: text,
  brandColor: text.nullable(),
  pages: z.array(
    z.object({
      key: pageKey,
      title: text,
      seoTitle: text,
      seoDescription: text,
      sections: z.array(sections),
    }),
  ),
  navigation: z.array(pageKey),
});

/** The schema for `response_format`, a plain JSON-schema object. */
export function providerJsonSchema(): Record<string, unknown> {
  const { $schema: _ignored, ...schema } = z.toJSONSchema(providerProposalShape);
  return schema;
}
