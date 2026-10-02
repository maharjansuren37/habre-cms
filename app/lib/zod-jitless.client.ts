import { z } from "zod";

// Zod probes once whether it may compile validators with `new Function`. The
// Content-Security-Policy refuses that, and although Zod catches the refusal
// and validates without compiling, the browser still reports a violation on
// every page that loads Zod. `jitless` skips the probe; validation is the same.
// Browser only (`.client`): the server has no policy and keeps the fast path.
// Imported by every screen whose bundle includes Zod - today only settings; the
// editor's client code keeps Zod out (F-157). The CSP browser test
// (e2e/content-security-policy.spec.ts) fails if a screen loads Zod without it,
// but only for the screens it visits: the post editor, the posts list, media,
// settings (with its logo picker) and the users list. Others are not checked
// (F-102).
z.config({ jitless: true });
