// The languages a site can say its pages are written in (item 17). Left-to-right
// only: a right-to-left language needs `dir="rtl"` and a checked layout, so none
// is offered. The tags are the database's `language` format (`0016_seo.sql`);
// this list is the allowlist the app holds on top of it.
export const DEFAULT_LANGUAGE = "en";

const TAGS = [
  "af",
  "sq",
  "hy",
  "az",
  "eu",
  "be",
  "bn",
  "bs",
  "bg",
  "ca",
  "zh",
  "hr",
  "cs",
  "da",
  "nl",
  "en",
  "et",
  "fil",
  "fi",
  "fr",
  "gl",
  "ka",
  "de",
  "el",
  "gu",
  "hi",
  "hu",
  "is",
  "id",
  "ga",
  "it",
  "ja",
  "kn",
  "kk",
  "km",
  "ko",
  "lo",
  "lv",
  "lt",
  "mk",
  "ms",
  "ml",
  "mt",
  "mr",
  "mn",
  "ne",
  "nb",
  "pl",
  "pt",
  "pa",
  "ro",
  "ru",
  "sr",
  "si",
  "sk",
  "sl",
  "es",
  "sw",
  "sv",
  "ta",
  "te",
  "th",
  "tr",
  "uk",
  "uz",
  "vi",
  "cy",
  "zu",
];

const names = new Intl.DisplayNames(["en"], { type: "language" });

export const LANGUAGES: { tag: string; name: string }[] = TAGS.map((tag) => ({
  tag,
  name: names.of(tag) ?? tag,
})).sort((a, b) => a.name.localeCompare(b.name, "en"));

const KNOWN = new Set(TAGS);

export function isLanguageTag(value: string): boolean {
  return KNOWN.has(value);
}
