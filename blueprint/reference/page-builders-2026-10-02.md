# Page builders and editors - research (2026-10-02)

Gathered during `prototype` for platform v1, to inform D165 (Mailchimp-style
editing) and the Simple / Pro / Developer levels (owner agreed 2026-10-02, to be
recorded by `ideate --rescope`). Web search, not hands-on testing.

## How products separate beginners from pros

| Product | Split |
|---|---|
| Webflow | Retired its separate Editor on 2026-08-04; one interface with roles: Content Editor (text, images, CMS items), Marketer (also new pages from components), Designer (everything) |
| Wix | Two products: Wix Editor (DIY, desktop layout plus a separately adjusted mobile view) and Wix Studio (agencies: breakpoints, custom CSS) |
| Duda | Agency-set permissions: content editing (edit existing widgets, cannot add or remove), full editing, developer mode (HTML/CSS) |
| WordPress | Developer curation: `levelOptions` limits heading levels per block; `contentOnly` locking edits text inside a locked pattern |
| Elementor V4 | Every element has General, Style and Interactions tabs; every style property can differ per device |
| Shopify | Theme developer defines sections, blocks and their settings; merchant fills in and reorders |

## Rich text

| Product | Headings | Notes |
|---|---|---|
| Webflow | H1-H6 | quotes, lists, images, video, embeds, code, components |
| Framer CMS | yes | headings render with browser defaults unless the designer styles them |
| Squarespace | Heading 1-4, Paragraph 1-3 | styles set site-wide, not per text |
| Ghost | H2-H4, H1 reserved for the post title | `##` shortcut, Ctrl+H; `/` or + opens 30+ cards |
| WordPress | H1-H6 | curatable per block |
| Storyblok | configurable toolbar | its accessibility guide advises limiting heading levels and leaving text colour off |

Pattern: tools for writers and small sites cap at four levels and style text
site-wide; pro tools offer six.

## Lessons for Habre

- Separate desktop and mobile layouts are a beginner trap (Wix Editor,
  Hostinger); Wix Studio moved to breakpoints. D165 stacks automatically.
- Edit on the page: Webflow Edit mode, Framer CMS 2.0 on-page editing.
- Locked templates for non-designers: Shopify presets, Duda content editing,
  WordPress `contentOnly` - ready-made sections as trees of ordinary blocks.
- Styling site-wide at the low end (Squarespace, Shopify theme settings), per
  element per device at the high end (Elementor, Wix Studio).
- Onboarding branding: Squarespace Blueprint AI suggests palettes; Sitejet
  extracts dominant colours from an uploaded logo and builds a scheme.

## Sources

- https://www.skrol.agency/blog/webflow-editor-retired
- https://help.webflow.com/hc/en-us/articles/41015796747667-Site-roles-and-permissions
- https://help.webflow.com/hc/en-us/articles/33961256808467-Rich-text-element-overview
- https://www.startinggatemarketing.com/post/wix-studio-vs-wix-editor-classic-which-one-to-choose
- https://support.squarespace.com/hc/en-us/articles/115012080887-Formatting-text
- https://make.wordpress.org/core/2024/10/20/miscellaneous-block-editor-changes-in-wordpress-6-7/
- https://github.com/WordPress/gutenberg/pull/63535
- https://essential-addons.com/elementor-version-4-the-atomic-editor/
- https://shopify.dev/docs/storefronts/themes/architecture/blocks
- https://ghost.org/help/using-the-editor/
- https://www.framer.com/updates/on-page-editing
- https://www.duda.co/features/client-permissions
- https://www.tooltester.com/en/reviews/hostinger-website-builder-review/
- https://www.storyblok.com/tp/build-accessible-websites-with-storyblok-astro
- https://technologyadvice.com/blog/information-technology/best-ai-website-builders/
