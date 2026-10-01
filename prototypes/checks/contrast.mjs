import { chromium } from "/home/panda/para/01-projects/habre-cms/node_modules/playwright/index.mjs";
const roles = ["bg","surface","surface-sunken","surface-hover","text","text-muted","border","border-strong","primary","primary-hover","on-primary","primary-subtle","danger","danger-subtle","success","success-subtle","warning","warning-subtle","info","info-subtle","focus-ring","selection","on-selection"];
const L = (h) => { const c = [1,3,5].map(i => parseInt(h.slice(i,i+2),16)/255).map(v => v <= 0.03928 ? v/12.92 : ((v+0.055)/1.055)**2.4); return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]; };
const cr = (a,b) => { const [x,y] = [L(a),L(b)].sort((p,q)=>q-p); return ((x+0.05)/(y+0.05)); };
const b = await chromium.launch(); const out = {};
for (const scheme of ["light","dark"]) {
  const p = await b.newPage({ colorScheme: scheme });
  await p.goto("file:///home/panda/para/01-projects/habre-cms/prototypes/components.html");
  for (const scope of ["app","site","brand","site-auto","brand-auto"]) {
    out[`${scope}-${scheme}`] = await p.evaluate(([roles, scope]) => {
      const sel = { site: '[data-surface="site"]:not([data-brand]):not([data-dark])', brand: '[data-brand="example"]:not([data-dark])',
        "site-auto": '[data-surface="site"][data-dark="auto"]:not([data-brand])', "brand-auto": '[data-dark="auto"][data-brand="example"]' }[scope];
      const el = sel ? document.querySelector(sel) : document.body;
      const cs = getComputedStyle(el); const o = {};
      for (const r of roles) o[r] = cs.getPropertyValue("--color-" + r).trim().toLowerCase();
      return o;
    }, [roles, scope]);
  }
}
await b.close();
const pairs = [
  ["text","bg",4.5],["text","surface",4.5],["text-muted","bg",4.5],["text-muted","surface",4.5],["text-muted","surface-sunken",4.5],["text-muted","surface-hover",4.5],
  ["primary","bg",4.5],["primary","surface",4.5],["primary-hover","bg",4.5],["on-primary","primary",4.5],["on-primary","primary-hover",4.5],["primary","primary-subtle",4.5],
  ["border-strong","surface",3],["border-strong","bg",3],["focus-ring","bg",3],["focus-ring","surface",3],
  ["danger","surface",4.5],["danger","bg",4.5],["on-primary","danger",4.5],["danger","danger-subtle",4.5],["text","danger-subtle",4.5],
  ["success","success-subtle",4.5],["warning","warning-subtle",4.5],["info","info-subtle",4.5],["bg","text",4.5],
  ["selection","bg",3],["selection","surface",3],["on-selection","selection",4.5],["bg","text-muted",4.5],
];
const fails = [];
console.log("pair".padEnd(30), Object.keys(out).map(k => k.padEnd(17)).join(""));
for (const [a,c,min] of pairs) {
  const cells = Object.entries(out).map(([k,v]) => { const r = cr(v[a], v[c]); if (r < min) fails.push(`${k} ${a}/${c} ${r.toFixed(2)}<${min}`); return r.toFixed(2).padEnd(17); });
  console.log(`${a} on ${c}`.padEnd(30), cells.join(""));
}
console.log("FAILS:", fails.length ? fails : "none");

