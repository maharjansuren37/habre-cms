import { z } from "zod";

export const CONTACT_ANSWERS = ["sent", "invalid", "again", "busy"] as const;
export type ContactAnswer = (typeof CONTACT_ANSWERS)[number];

/** The `?contact=` value as an answer; anything else is ignored (item 19b). */
export function parseContactAnswer(value: string | null): ContactAnswer | undefined {
  return CONTACT_ANSWERS.find((code) => code === value);
}

// Control characters except newline (and the tab, which is whitespace).
// biome-ignore lint/suspicious/noControlCharactersInRegex: stripping them is the point.
const CONTROL = /[\u0000-\u0009\u000B-\u001F\u007F]/g;

const text = (max: number) =>
  z
    .string()
    .transform((value) => value.replace(CONTROL, "").trim())
    .pipe(z.string().min(1).max(max));

export const contactMessageSchema = z.object({
  name: text(100),
  // No `?&%,<>"`: the address is put in a `mailto:` link and a Reply-To header,
  // where those characters add recipients or a body (F-398).
  email: text(254).pipe(z.string().regex(/^[^\s@?&%,<>"]+@[^\s@?&%,<>"]+$/)),
  message: text(5000),
});

export type ContactMessage = z.infer<typeof contactMessageSchema>;
