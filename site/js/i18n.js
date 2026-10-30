// Turkish edition. The English pages are the source; for lang=tr:
//  - the article (everything inside .content) is replaced by its translation, i18n/tr/pages/<id>.html;
//  - text the scripts write (figure titles, axis labels, captions, tooltips, chrome) is translated on the fly
//    from i18n/tr/strings/common.json + i18n/tr/strings/<id>.json, keyed by the English text;
//  - errata and glossary entries take their Turkish fields from i18n/tr/errata.json and i18n/tr/glossary.json.
// Numbers inside a string are placeholders: "N = 1,000 done" is looked up as "N = {0} done".

export const LANG = (() => {
  const q = new URLSearchParams(location.search).get("lang");
  if (q === "tr" || q === "en") {
    try { localStorage.setItem("lang", q); } catch { /* storage unavailable */ }
    return q;
  }
  try { return localStorage.getItem("lang") === "tr" ? "tr" : "en"; } catch { return "en"; }
})();

export function setLang(lang) {
  try { localStorage.setItem("lang", lang); } catch { /* storage unavailable */ }
  const u = new URL(location.href);
  u.searchParams.set("lang", lang);
  location.href = u.href;
}

const NUM = /\d+(?:[.,]\d+)*/g;
const norm = (s) => s.replace(/\s+/g, " ").trim();
/** "N = 1,000 done" → ["N = {0} done", ["1,000"]] */
export function keyOf(s) {
  const nums = [];
  const key = norm(s).replace(NUM, (m) => `{${nums.push(m) - 1}}`);
  return [key, nums];
}

const dict = new Map();
async function json(url) {
  try { const r = await fetch(url); return r.ok ? await r.json() : {}; } catch { return {}; }
}

/** Translate one string, or return null when there is no translation. */
export function tr(s) {
  if (LANG !== "tr" || !s || !/[A-Za-z]/.test(s)) return null;
  const [key, nums] = keyOf(s);
  const t = dict.get(key);
  if (t === undefined) return null;
  const lead = s.match(/^\s*/)[0], trail = s.match(/\s*$/)[0];
  return lead + t.replace(/\{(\d+)\}/g, (_, i) => nums[i] ?? "") + trail;
}
/** t("Show a hint") → Turkish when available, else the English. */
export const t = (s) => tr(s) ?? s;

const SKIP = ".katex, script, style, code, pre, [data-no-tr]";
const ATTRS = ["title", "aria-label", "placeholder"];
function translateNode(n) {
  if (n.nodeType === 3) {
    if (n.parentElement && n.parentElement.closest(SKIP)) return;
    const v = tr(n.nodeValue);
    if (v !== null && v !== n.nodeValue) n.nodeValue = v;
  } else if (n.nodeType === 1) {
    if (n.closest(SKIP)) return;
    for (const a of ATTRS) if (n.hasAttribute(a)) { const v = tr(n.getAttribute(a)); if (v !== null) n.setAttribute(a, v); }
    const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    while (w.nextNode()) {
      const c = w.currentNode;
      if (c.nodeType === 1) {
        if (c.matches(SKIP)) continue;
        for (const a of ATTRS) if (c.hasAttribute(a)) { const v = tr(c.getAttribute(a)); if (v !== null) c.setAttribute(a, v); }
      } else translateNode(c);
    }
  }
}

/** Translate everything now and whatever the scripts add later. */
export function translateLive(root = document.body) {
  if (LANG !== "tr") return;
  translateNode(root);
  new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === "characterData") translateNode(m.target);
      else if (m.type === "attributes") translateNode(m.target.nodeType === 1 ? m.target : m.target.parentNode);
      else for (const n of m.addedNodes) translateNode(n);
    }
  }).observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}

/**
 * Load the Turkish edition of page `id`: swap in the translated article, title and description,
 * read the string tables, and patch errata and glossary entries with their Turkish fields.
 */
export async function loadTurkish(id, { errata = [], glossary = [], symbols = [] } = {}) {
  if (LANG !== "tr") return;
  document.documentElement.lang = "tr";
  const base = new URL("../i18n/tr/", import.meta.url);
  const [common, page, err, gloss, frag] = await Promise.all([
    json(new URL("strings/common.json", base)), json(new URL(`strings/${id}.json`, base)),
    json(new URL("errata.json", base)), json(new URL("glossary.json", base)),
    fetch(new URL(`pages/${id}.html`, base)).then((r) => (r.ok ? r.text() : null)).catch(() => null),
  ]);
  for (const table of [common, page]) for (const [k, v] of Object.entries(table)) dict.set(keyOf(k)[0], v);
  for (const list of errata) for (const e of list) if (err[e.id]) Object.assign(e, err[e.id]);
  for (const g of glossary) if (gloss[g.term]) Object.assign(g, { en: g.term }, gloss[g.term]);
  for (const s of symbols) if (gloss["sym:" + s.term]) Object.assign(s, gloss["sym:" + s.term]);
  if (frag) {
    const doc = new DOMParser().parseFromString(frag, "text/html");
    const content = document.querySelector(".content"), src = doc.querySelector(".content");
    if (content && src) content.innerHTML = src.innerHTML;
    if (doc.title) document.title = doc.title;
    const d = doc.querySelector('meta[name="description"]'), m = document.querySelector('meta[name="description"]');
    if (d && m) m.setAttribute("content", d.getAttribute("content"));
  }
}

/** URL of a page's article in the current language (the exam practice set reads quizzes from it). */
export const articleUrl = (id) => (LANG === "tr" ? new URL(`../i18n/tr/pages/${id}.html`, import.meta.url).href : (id === "index" ? "index.html" : `${id}.html`));
