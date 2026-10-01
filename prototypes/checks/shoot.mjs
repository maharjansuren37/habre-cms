import { chromium } from "/home/panda/para/01-projects/habre-cms/node_modules/playwright/index.mjs";
const P = "/home/panda/para/01-projects/habre-cms/prototypes/";
const out = process.argv[2];
const pages = ["components", "signup", "start", "start-brand", "home", "editor", "editor#heading", "site-home"];
const browser = await chromium.launch();
for (const scheme of ["light", "dark"]) {
  for (const [w, h] of [[1280, 860], [390, 844]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const errors = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("requestfailed", (r) => errors.push("failed: " + r.url()));
    for (const name of pages) {
      const [file, hash] = name.split("#"); await page.goto("file://" + P + file + ".html" + (hash ? "#" + hash : "")); if (hash) await page.reload();
      await page.addStyleTag({ content: ".mock-toggle{display:none}" }); await page.evaluate(() => document.fonts.ready);
      const zero = await page.evaluate(() => [...document.querySelectorAll("svg.icon")].filter((s) => { const r = s.getBoundingClientRect(); return s.checkVisibility() && (r.width < 1 || r.height < 1); }).length);
      const font = await page.evaluate(() => document.fonts.check('16px "Inter Variable"'));
      const hscroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      const hgt = await page.evaluate(() => document.documentElement.scrollHeight); if (hgt > 6000) console.log(name, w, "height", hgt);
      for (let i = 0; i < 3; i++) { try { await page.screenshot({ path: `${out}/${name.replace("#", "-")}-${w}-${scheme}.png`, fullPage: file !== "editor" }); break; } catch (e) { if (i === 2) throw e; } }
      if (scheme === "light") console.log(`${name} ${w}: zero-size icons=${zero} inter=${font} hscroll=${hscroll}`);
    }
    if (errors.length) console.log(scheme, w, errors.slice(0, 5));
    await ctx.close();
  }
}
await browser.close();
