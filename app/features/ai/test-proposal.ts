export const section = (kind: string) => {
  switch (kind) {
    case "hero":
      return {
        kind,
        heading: "Welcome",
        body: "We make bread.",
        buttonLabel: "Visit",
        buttonTarget: "p2",
      };
    case "image-text":
      return { kind, heading: "Our story", body: "Since 1999." };
    case "cta":
      return { kind, heading: "Talk to us", body: "We reply fast.", buttonLabel: "Contact" };
    default:
      return { kind: "text", heading: "Details", paragraphs: ["One.", "Two."] };
  }
};

export function validProposal(): Record<string, unknown> {
  return {
    siteDescription: "A bakery.",
    brandColor: "#aa5500",
    pages: [
      {
        key: "p1",
        title: "Home",
        seoTitle: "Home - Bakery",
        seoDescription: "Fresh bread.",
        sections: ["hero", "image-text", "cta", "text"].map(section),
      },
      {
        key: "p2",
        title: "About",
        seoTitle: "About",
        seoDescription: "About us.",
        sections: [section("text")],
      },
    ],
    navigation: ["p1", "p2"],
  };
}

// biome-ignore lint/suspicious/noExplicitAny: tests edit a proposal into invalid shapes
export type Draft = any;
