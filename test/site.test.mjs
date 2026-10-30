// Site structure: every page in the navigation exists, loads its module, and every local link resolves.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, normalize } from "node:path";
import { root } from "./helpers.mjs";
import { renderErrata } from "../scripts/errata.mjs";
import { ERRATA, BOOK, SOFTWARE } from "../site/js/errata.js";

const site = join(root, "site");
const navSrc = readFileSync(join(site, "js", "layout.js"), "utf8");
const ids = [...navSrc.matchAll(/\{ id: "([^"]+)"/g)].map((m) => m[1]);
const pageFile = (id) => join(site, id === "index" ? "index.html" : id + ".html");
const vendor = new Set(["vendor/d3.min.js", "vendor/katex/katex.min.js", "vendor/katex/katex.min.css", "vendor/katex/auto-render.min.js"]);

test("every navigation entry has a page with a matching data-page and module", () => {
  assert.ok(ids.length > 30, "navigation parsed");
  for (const id of ids) {
    const f = pageFile(id);
    assert.ok(existsSync(f), `${f} exists`);
    const html = readFileSync(f, "utf8");
    assert.match(html, new RegExp(`data-page="${id}"`), `${id}: data-page`);
    const mod = html.match(/<script type="module" src="([^"]+)"/);
    assert.ok(mod, `${id}: has a module script`);
    assert.ok(existsSync(join(site, mod[1])), `${id}: ${mod[1]} exists`);
  }
});

test("local links and assets in every page resolve", () => {
  for (const f of readdirSync(site).filter((x) => x.endsWith(".html"))) {
    const html = readFileSync(join(site, f), "utf8");
    for (const [, url] of html.matchAll(/(?:href|src)="([^"#?]+)[^"]*"/g)) {
      if (/^(https?:|mailto:|data:)/.test(url) || url === "#") continue;
      if (vendor.has(url)) continue;
      assert.ok(existsSync(join(site, url)), `${f}: ${url}`);
    }
  }
});

test("every static import in the JavaScript resolves", () => {
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : e.name.endsWith(".js") ? [join(d, e.name)] : []));
  for (const f of walk(join(site, "js"))) {
    const src = readFileSync(f, "utf8");
    for (const [, spec] of src.matchAll(/^\s*import\s[^"']*["'](\.[^"']+)["']/gm)) {
      assert.ok(existsSync(normalize(join(dirname(f), spec))), `${f}: ${spec}`);
    }
  }
});

test("notebook/ERRATA.md is up to date with site/js/errata.js (run npm run errata)", () => {
  assert.equal(readFileSync(join(root, "notebook", "ERRATA.md"), "utf8"), renderErrata());
  const ids2 = ERRATA.map((e) => e.id);
  assert.equal(new Set(ids2).size, ids2.length, "unique ids");
  for (const e of ERRATA) if (e.page) assert.ok(ids.includes(e.page.replace(".html", "")), `${e.id}: ${e.page} is a site page`);
});

test("every correction box on a page refers to an existing erratum", () => {
  const known = { errata: ERRATA, book: BOOK, software: SOFTWARE };
  for (const f of readdirSync(site).filter((x) => x.endsWith(".html"))) {
    const html = readFileSync(join(site, f), "utf8");
    for (const [, kind, id] of html.matchAll(/data-(errata|book|software)="([^"]+)"/g)) {
      assert.ok(known[kind].some((e) => e.id === id), `${f}: data-${kind}="${id}"`);
    }
  }
});

test("every erratum is shown on the page it names", () => {
  for (const [kind, list] of [["errata", ERRATA], ["book", BOOK], ["software", SOFTWARE]]) {
    for (const e of list) {
      if (!e.page) continue;
      const html = readFileSync(join(site, e.page), "utf8");
      assert.ok(html.includes(`data-${kind}="${e.id}"`), `${e.id} should have a correction box on ${e.page}`);
    }
  }
});

test("every quiz has options and a data-answer that points to one of them", () => {
  for (const f of readdirSync(site).filter((x) => x.endsWith(".html"))) {
    const html = readFileSync(join(site, f), "utf8");
    for (const [, attrs, body] of html.matchAll(/<div class="quiz"([^>]*)>([\s\S]*?)<\/ol>/g)) {
      const answer = Number((attrs.match(/data-answer="(\d+)"/) || [])[1]);
      const items = [...body.matchAll(/<li(\s[^>]*)?>/g)].map((m) => m[1] || "");
      assert.ok(items.length >= 2, `${f}: quiz has options`);
      assert.ok(answer >= 1 && answer <= items.length, `${f}: data-answer ${answer} within 1..${items.length}`);
    }
  }
});

// Turkish edition: a translated article must keep every hook the page script and the layout rely on.
const trDir = join(site, "i18n", "tr", "pages");
const hooks = (html) => {
  const body = html.slice(html.indexOf('<div class="content">'));
  return {
    ids: [...body.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]),
    answers: [...body.matchAll(/<div class="quiz"[^>]*data-answer="(\d+)"/g)].map((m) => m[1]),
    options: [...body.matchAll(/<div class="quiz"[\s\S]*?<\/ol>/g)].map((m) => (m[0].match(/<li[\s>]/g) || []).length),
    local: (body.match(/<div class="quiz"[^>]*data-local/g) || []).length,
    fixes: [...body.matchAll(/data-(errata|book|software)="([^"]+)"/g)].map((m) => m[1] + ":" + m[2]),
    beyond: (body.match(/data-beyond=/g) || []).length,
    bank: [...body.matchAll(/data-(pages|optional)="([^"]*)"/g)].map((m) => m[1] + "=" + m[2]),
  };
};

test("every Turkish article keeps the English page's ids, quiz answers, correction boxes and markers", () => {
  if (!existsSync(trDir)) return;
  for (const f of readdirSync(trDir).filter((x) => x.endsWith(".html"))) {
    assert.ok(existsSync(join(site, f)), `i18n/tr/pages/${f} has an English page`);
    const en = hooks(readFileSync(join(site, f), "utf8")), trh = hooks(readFileSync(join(trDir, f), "utf8"));
    for (const k of Object.keys(en)) assert.deepEqual(trh[k], en[k], `${f}: ${k}`);
  }
});

test("every Turkish string table is valid JSON with string values", () => {
  const dir = join(site, "i18n", "tr", "strings");
  if (!existsSync(dir)) return;
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    const o = JSON.parse(readFileSync(join(dir, f), "utf8"));
    for (const [k, v] of Object.entries(o)) assert.equal(typeof v, "string", `${f}: ${k}`);
  }
});

test("pages and scripts use no em dashes (house style)", () => {
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === "vendor" ? [] : walk(join(d, e.name))) : /\.(html|js|json)$/.test(e.name) ? [join(d, e.name)] : []));
  for (const f of walk(site)) {
    if (f.endsWith("errata.js")) continue; // quotes the notebook and the book verbatim
    assert.ok(!readFileSync(f, "utf8").includes("—"), `${f} contains an em dash`);
  }
});

test("no TeX command was mangled by an escape sequence (\\r, \\n, \\t, \\f, \\b)", () => {
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === "vendor" ? [] : walk(join(d, e.name))) : /\.(html|json)$/.test(e.name) ? [join(d, e.name)] : []));
  for (const f of walk(site)) {
    const s = readFileSync(f, "utf8");
    assert.ok(!s.includes("\r"), `${f} contains a carriage return (a mangled \\rangle?)`);
    assert.ok(!/\$[^$\n]*\n(?:angle|ight|rac|ext|imes|eta|au|heta|abla)\b/.test(s), `${f}: a TeX command broken across a line`);
  }
});
