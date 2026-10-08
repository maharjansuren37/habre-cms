import assert from "node:assert/strict";
import { test } from "node:test";
import { parseDocument } from "../blocks/document.ts";
import { type ApplySite, planApply, reviewSummary } from "./apply-plan.ts";
import { proposalSchema } from "./proposal.ts";
import { type Draft, section, validProposal } from "./test-proposal.ts";

const emptySite: ApplySite = {
  takenPageSlugs: [],
  brandColor: "",
  siteDescription: "",
};

function parsed(input: unknown) {
  const result = proposalSchema.safeParse(input);
  assert.ok(result.success, "the proposal must parse");
  return result.data;
}

function titled(...titles: string[]): Draft {
  const proposal = validProposal() as Draft;
  proposal.pages = titles.map((title, index) => ({
    key: `p${index + 1}`,
    title,
    seoTitle: title,
    seoDescription: `About ${title}.`,
    sections: [section("text")],
  }));
  proposal.navigation = titles.map((_, index) => `p${index + 1}`);
  return proposal;
}

function slugsOf(proposal: unknown, site = emptySite) {
  return planApply(parsed(proposal), site).pages.map((page) => page.slug);
}

function buttonHrefs(node: unknown): string[] {
  if (typeof node !== "object" || node === null) return [];
  const { type, attrs, content } = node as {
    type?: string;
    attrs?: { href?: string };
    content?: unknown[];
  };
  const own = type === "button" && attrs?.href !== undefined ? [attrs.href] : [];
  return [...own, ...(content ?? []).flatMap(buttonHrefs)];
}

test("two pages titled About get about and about-2", () => {
  assert.deepEqual(slugsOf(titled("About", "About")), ["about", "about-2"]);
});

test("a page titled Start gets start-2 because start is reserved", () => {
  assert.deepEqual(slugsOf(titled("Start")), ["start-2"]);
});

test("a page whose address is taken gets the next free one", () => {
  const site = { ...emptySite, takenPageSlugs: ["about", "about-2"] };
  assert.deepEqual(slugsOf(titled("About", "Contact"), site), ["about-3", "contact"]);
});

test("every document parses as a page and every button goes to / or a planned address", () => {
  const plan = planApply(parsed(validProposal()), emptySite);
  const allowed = ["/", ...plan.pages.map((page) => `/${page.slug}`)];
  const hrefs = plan.pages.flatMap((page) => buttonHrefs(page.document));
  assert.ok(hrefs.length >= 2, "the proposal has buttons");
  for (const page of plan.pages) {
    assert.deepEqual(parseDocument(page.document, "page"), { ok: true, document: page.document });
  }
  for (const href of hrefs) assert.ok(allowed.includes(href), `${href} is a planned address`);
});

test("a button points at its target page's planned address, not the proposal's title", () => {
  const site = { ...emptySite, takenPageSlugs: ["about"] };
  const plan = planApply(parsed(validProposal()), site);
  assert.ok(buttonHrefs(plan.pages[0]?.document).includes("/about-2"));
});

test("the menu follows the navigation order with page titles as labels", () => {
  const proposal = validProposal() as Draft;
  proposal.navigation = ["p2", "p1"];
  assert.deepEqual(planApply(parsed(proposal), emptySite).navigation, [
    { key: "p2", label: "About" },
    { key: "p1", label: "Home" },
  ]);
});

test("the home page is p1", () => {
  assert.equal(planApply(parsed(validProposal()), emptySite).homeKey, "p1");
});

test("the review names p1 as the home page even when it is not the first page", () => {
  const proposal = titled("About", "Welcome");
  proposal.pages = [proposal.pages[1], proposal.pages[0]];
  const plan = planApply(parsed(proposal), emptySite);
  assert.equal(reviewSummary(parsed(proposal)).homeKey, "p1");
  assert.equal(reviewSummary(parsed(proposal)).homeKey, plan.homeKey);
});

test("without a p1 page the review and the plan both name the first page as home", () => {
  const proposal = titled("About", "Welcome");
  proposal.pages[0].key = "p2";
  proposal.pages[1].key = "p3";
  proposal.navigation = ["p2", "p3"];
  const plan = planApply(parsed(proposal), emptySite);
  assert.equal(reviewSummary(parsed(proposal)).homeKey, "p2");
  assert.equal(plan.homeKey, "p2");
});

test("the colour is the proposal's when the site has no colour", () => {
  assert.equal(planApply(parsed(validProposal()), emptySite).brandColor, "#aa5500");
});

test("the colour is the proposal's when the site has a logo and no colour", () => {
  // A logo no longer matters: planApply is not given one (a stray field is ignored).
  const site = { ...emptySite, hasLogo: true };
  assert.equal(planApply(parsed(validProposal()), site).brandColor, "#aa5500");
});

test("the colour is left alone when the site already has one", () => {
  const site = { ...emptySite, brandColor: "#112233" };
  assert.equal(planApply(parsed(validProposal()), site).brandColor, null);
});

test("the description is the proposal's when the site has none", () => {
  assert.equal(planApply(parsed(validProposal()), emptySite).siteDescription, "A bakery.");
});

test("the description is left alone when the site already has one", () => {
  const site = { ...emptySite, siteDescription: "Mine." };
  assert.equal(planApply(parsed(validProposal()), site).siteDescription, null);
});

test("the review lists each page's sections with the palette's names and its search text", () => {
  const summary = reviewSummary(parsed(validProposal()));
  assert.deepEqual(summary.pages[0], {
    key: "p1",
    title: "Home",
    seoTitle: "Home - Bakery",
    seoDescription: "Fresh bread.",
    sections: [
      { kindName: "Hero", heading: "Welcome" },
      { kindName: "Image and text", heading: "Our story" },
      { kindName: "Call to action", heading: "Talk to us" },
      { kindName: "Text", heading: "Details" },
    ],
  });
  assert.deepEqual(summary.menu, ["Home", "About"]);
});

test("the photo count counts heroes and image-and-text sections", () => {
  assert.equal(reviewSummary(parsed(validProposal())).emptyPhotoCount, 2);
  const proposal = validProposal() as Draft;
  proposal.pages[1].sections = [section("hero"), section("hero"), section("image-text")];
  assert.equal(reviewSummary(parsed(proposal)).emptyPhotoCount, 5);
});
