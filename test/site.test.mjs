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
