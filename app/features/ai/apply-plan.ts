/**
 * What "Use this draft" does to a site, and what the review shows (18b4a).
 * Pure: no database. `applyRun` reads the site, calls `planApply`, writes the
 * result; the review calls `planApply` and `reviewSummary` to show it first.
 * `null` in a plan means "leave as is".
 */

import type { Document } from "../blocks/document-nodes.ts";
import { nextFreeSlug, RESERVED_PAGE_SLUGS, slugFromTitle } from "../content/slug.ts";
import { expandProposal } from "./expand-proposal.ts";
import type { Proposal, ProposalSection } from "./proposal.ts";

export type ApplyPlan = {
  pages: {
    key: string;
    title: string;
    slug: string;
    seoTitle: string;
    seoDescription: string;
    document: Document;
  }[];
  navigation: { key: string; label: string }[];
  homeKey: string;
  siteDescription: string | null;
  brandColor: string | null;
};

export type ApplySite = {
  takenPageSlugs: string[];
  hasLogo: boolean;
  brandColor: string;
  siteDescription: string;
};

/** The proposal's instructions make p1 the home page; fall back to the first page if absent. */
export function homePageKey(proposal: Proposal): string {
  return proposal.pages.some((page) => page.key === "p1")
    ? "p1"
    : (proposal.pages[0] as { key: string }).key;
}

/**
 * Unset is the empty string, as `site_settings` stores it (`site_description`
 * and `brand_color` both default to ''). The colour is also left alone with a
 * logo, whose colours the person chose from (D167).
 */
export function planApply(proposal: Proposal, site: ApplySite): ApplyPlan {
  const taken = [...site.takenPageSlugs, ...RESERVED_PAGE_SLUGS];
  const slugs: Record<string, string> = {};
  for (const page of proposal.pages) {
    const slug = nextFreeSlug(slugFromTitle(page.title, "page"), taken);
    slugs[page.key] = slug;
    taken.push(slug);
  }
  const documents = expandProposal(proposal, slugs);
  const titles = new Map(proposal.pages.map((page) => [page.key, page.title]));
  return {
    pages: proposal.pages.map((page) => ({
      key: page.key,
      title: page.title,
      slug: slugs[page.key] as string,
      seoTitle: page.seoTitle,
      seoDescription: page.seoDescription,
      document: documents[page.key] as Document,
    })),
    navigation: proposal.navigation.map((key) => ({ key, label: titles.get(key) as string })),
    homeKey: homePageKey(proposal),
    siteDescription: site.siteDescription === "" ? proposal.siteDescription : null,
    brandColor: site.hasLogo || site.brandColor !== "" ? null : proposal.brandColor,
  };
}

export type ReviewSummary = {
  pages: {
    key: string;
    title: string;
    seoTitle: string;
    seoDescription: string;
    sections: { kindName: string; heading: string }[];
  }[];
  menu: string[];
  homeKey: string;
  emptyPhotoCount: number;
};

const KIND_NAMES: Record<ProposalSection["kind"], string> = {
  hero: "Hero",
  "image-text": "Image and text",
  cta: "Call to action",
  text: "Text",
};

/** What the review lists. Heroes and image-and-text sections each leave a photo place empty. */
export function reviewSummary(proposal: Proposal): ReviewSummary {
  const titles = new Map(proposal.pages.map((page) => [page.key, page.title]));
  const sections = proposal.pages.flatMap((page) => page.sections);
  return {
    pages: proposal.pages.map((page) => ({
      key: page.key,
      title: page.title,
      seoTitle: page.seoTitle,
      seoDescription: page.seoDescription,
      sections: page.sections.map((s) => ({ kindName: KIND_NAMES[s.kind], heading: s.heading })),
    })),
    menu: proposal.navigation.map((key) => titles.get(key) as string),
    homeKey: homePageKey(proposal),
    emptyPhotoCount: sections.filter((s) => s.kind === "hero" || s.kind === "image-text").length,
  };
}
