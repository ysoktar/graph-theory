// Site chrome shared by every page: header, navigation, pager, footer, theme, callouts, quizzes, maths.
// Each page's module imports this first; the page itself only contains its article.
import { h, $, $$, renderMath, emitThemeChange, CALLOUT_ICONS } from "./lib/ui.js";
import { ERRATA, BOOK as BOOK_ERRATA, SOFTWARE } from "./errata.js";

export const REPO = "https://github.com/ysoktar/graph-theory";
export const NOTEBOOK_URL = "https://colab.research.google.com/github/ysoktar/graph-theory/blob/main/notebook/Ch2_4_Applied_Tutorial.ipynb";
export const BOOK = "https://networksciencebook.com/";

/** The whole site map. `book` = section of Barabási's Network Science, `nb` = section of the class notebook. */
export const NAV = [
  { part: "Start", items: [
    { id: "index", title: "Overview", desc: "The question, the plan and how to use this site." },
    { id: "data", title: "The data: eight real networks", nb: "0", desc: "The book's reference networks, side by side." },
  ] },
  { part: "Part I · Graph theory", short: "Ch 2", items: [
    { id: "ch2-konigsberg", title: "Königsberg & Euler", book: "2.1–2.2", desc: "Where graph theory began: seven bridges and the odd-degree rule." },
    { id: "ch2-degree", title: "Degree & degree distribution", book: "2.3", nb: "I.1, I.4", desc: "Build a network, watch k, ⟨k⟩ = 2L/N and pₖ update." },
    { id: "ch2-adjacency", title: "The adjacency matrix", book: "2.4", nb: "I.2", desc: "A network as a matrix; Aⁿ counts walks, Tr(A³)/6 counts triangles." },
    { id: "ch2-sparsity", title: "Real networks are sparse", book: "2.5", nb: "I.3", desc: "L ≪ L_max: why edge lists beat matrices." },
    { id: "ch2-weighted-bipartite", title: "Weighted & bipartite networks", book: "2.6–2.7", nb: "I.8", desc: "Southern Women: projections create weighted networks." },
    { id: "ch2-paths", title: "Paths & distances", book: "2.8", nb: "I.5", desc: "Step through breadth-first search; diameter and ⟨d⟩." },
    { id: "ch2-connectedness", title: "Connectedness", book: "2.9", nb: "I.6", desc: "Components, bridges and the giant component." },
    { id: "ch2-clustering", title: "Clustering", book: "2.10, 2.A", nb: "I.7", desc: "Triangles around a node; ⟨C⟩ versus the global C_Δ." },
  ] },
  { part: "Part II · Random networks", short: "Ch 3", items: [
    { id: "ch3-model", title: "The random network model", book: "3.2–3.3", nb: "II.1", desc: "G(N, p) step by step; L is a binomial random variable." },
    { id: "ch3-degree", title: "Binomial → Poisson degrees", book: "3.4", nb: "II.2", desc: "pₖ depends only on ⟨k⟩, not on N." },
    { id: "ch3-real-degrees", title: "Real networks are not Poisson", book: "3.5", nb: "II.3", desc: "How many hubs would a random network have? About none." },
    { id: "ch3-evolution", title: "Evolution & the giant component", book: "3.6–3.7, 3.C–3.D", nb: "II.4–II.5", desc: "Add links one by one and watch a phase transition." },
    { id: "ch3-small-world", title: "Small worlds", book: "3.8, 3.G", nb: "II.6", desc: "Six degrees, ⟨d⟩ ≈ ln N / ln⟨k⟩, and the Watts–Strogatz model." },
    { id: "ch3-clustering", title: "Clustering in random networks", book: "3.9", nb: "II.7", desc: "C = ⟨k⟩/N vanishes; real C(k) does not." },
    { id: "ch3-summary", title: "Real networks are not random", book: "3.10", nb: "II.8", desc: "Scorecard: what the null model gets right and wrong." },
  ] },
  { part: "Part III · Scale-free networks", short: "Ch 4", items: [
    { id: "ch4-power-laws", title: "Power laws & hubs", book: "4.1–4.2", nb: "III.2", desc: "pₖ ~ k^−γ against Poisson, on linear and log axes." },
    { id: "ch4-plotting", title: "How (not) to plot pₖ", book: "4.B", nb: "III.1", desc: "Linear bins, log bins and the CCDF on real data." },
    { id: "ch4-fitting", title: "Estimating the exponent", book: "4.C", nb: "III.3", desc: "Least squares vs. maximum likelihood; the k_min scan." },
    { id: "ch4-hubs", title: "The largest hub", book: "4.3", nb: "III.4", desc: "k_max grows like N^{1/(γ−1)}, not like ln N." },
    { id: "ch4-moments", title: "No typical degree", book: "4.4", nb: "III.5", desc: "⟨k²⟩ diverges: what 'scale-free' really means." },
    { id: "ch4-universality", title: "Universality", book: "4.5", nb: "III.6", desc: "Eight networks, one procedure, many tails." },
    { id: "ch4-ultra-small", title: "Ultra-small worlds", book: "4.6", nb: "III.7", desc: "Hubs as shortcuts: ⟨d⟩ ~ ln ln N." },
    { id: "ch4-exponent", title: "The role of γ", book: "4.7", nb: "III.8", desc: "Anomalous, scale-free and random-like regimes." },
    { id: "ch4-generating", title: "Generating networks", book: "4.8", nb: "III.9", desc: "Configuration model and degree-preserving randomization." },
  ] },
  { part: "Part IV · Synthesis & beyond", items: [
    { id: "synthesis", title: "Synthesis & self-test", nb: "IV", desc: "Random vs. scale-free vs. real, key messages and a quiz." },
    { id: "ch5-preview", title: "Why hubs? Preferential attachment", book: "Ch 5", desc: "Growth + preferential attachment gives γ = 3." },
    { id: "correlations", title: "Degree correlations", book: "Ch 7", desc: "Assortativity r and k_nn(k): who links to whom." },
    { id: "robustness", title: "Robustness & attacks", book: "Ch 8", desc: "Random failures vs. targeted attacks on hubs." },
    { id: "epidemics", title: "Spreading & vaccination", book: "Ch 10", desc: "Why ⟨k²⟩ sets the epidemic threshold." },
    { id: "communities", title: "Communities", book: "Ch 9", desc: "The karate club split, modularity and label propagation." },
  ] },
  { part: "Tools", items: [
    { id: "lab", title: "Network lab", desc: "Generate, load or paste a network and measure everything." },
    { id: "formulas", title: "Formula sheet & glossary", desc: "Every definition and result in one place." },
    { id: "notebook-check", title: "Notebook check", desc: "Each claim of the class notebook, re-verified." },
  ] },
];

const ALL = NAV.flatMap((p) => p.items.map((it) => ({ ...it, part: p.part, short: p.short })));
export const pageInfo = (id) => ALL.find((p) => p.id === id);
const href = (id) => (id === "index" ? "index.html" : `${id}.html`);

const LOGO = `<svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
  <g stroke="var(--axis)" stroke-width="1.6"><line x1="14" y1="14" x2="5" y2="6"/><line x1="14" y1="14" x2="23" y2="5"/><line x1="14" y1="14" x2="24" y2="19"/><line x1="14" y1="14" x2="6" y2="22"/><line x1="14" y1="14" x2="15" y2="25"/><line x1="5" y1="6" x2="23" y2="5"/></g>
  <circle cx="14" cy="14" r="5.2" fill="var(--s1)"/><circle cx="5" cy="6" r="2.6" fill="var(--s2)"/><circle cx="23" cy="5" r="2.6" fill="var(--s3)"/>
  <circle cx="24" cy="19" r="2.3" fill="var(--s1)"/><circle cx="6" cy="22" r="2.3" fill="var(--s1)"/><circle cx="15" cy="25" r="2" fill="var(--s1)"/></svg>`;

const THEME_ICONS = {
  auto: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6"/><path d="M8 2a6 6 0 0 0 0 12z" fill="currentColor"/></svg>',
  light: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M3 13l1.4-1.4M11.6 4.4L13 3"/></svg>',
  dark: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13.5 9.5A5.5 5.5 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7z"/></svg>',
};

function getTheme() {
  try { return localStorage.getItem("theme") || "auto"; } catch { return "auto"; }
}
function setTheme(t) {
  try { if (t === "auto") localStorage.removeItem("theme"); else localStorage.setItem("theme", t); } catch { /* storage unavailable */ }
  if (t === "auto") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", t);
  emitThemeChange();
}

function buildHeader(info) {
  const themeBtn = h("button", { class: "icon-btn", type: "button", "aria-label": "Colour theme" });
  const paintTheme = () => {
    const t = getTheme();
    themeBtn.innerHTML = THEME_ICONS[t] + `<span class="label">${t === "auto" ? "Auto" : t === "light" ? "Light" : "Dark"}</span>`;
    themeBtn.title = `Theme: ${t} (click to change)`;
  };
  themeBtn.addEventListener("click", () => {
    const order = ["auto", "light", "dark"];
    setTheme(order[(order.indexOf(getTheme()) + 1) % 3]);
    paintTheme();
  });
  paintTheme();
  const menu = h("button", { class: "icon-btn menu-btn", type: "button", "aria-label": "Open navigation", "aria-expanded": "false" });
  menu.innerHTML = '<svg width="18" height="18" viewBox="0 0 18 18" stroke="currentColor" stroke-width="1.8"><path d="M2 4.5h14M2 9h14M2 13.5h14"/></svg>';
  menu.addEventListener("click", () => {
    const open = document.body.classList.toggle("nav-open");
    menu.setAttribute("aria-expanded", String(open));
  });
  const brand = h("a", { class: "brand", href: "index.html" });
  brand.innerHTML = LOGO;
  brand.append(h("span", { class: "brand-title" }, "From Graphs to Hubs"), h("span", { class: "brand-sub" }, "Network Science, Ch 2–4, interactively"));
  const nb = h("a", { class: "icon-btn", href: NOTEBOOK_URL, target: "_blank", rel: "noopener", title: "Open the class notebook in Google Colab" });
  nb.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2.5" y="1.5" width="11" height="13" rx="1.5"/><path d="M5 5h6M5 8h6M5 11h3"/></svg><span class="label">Notebook</span>';
  const gh = h("a", { class: "icon-btn", href: REPO, target: "_blank", rel: "noopener", title: "Source code on GitHub", "aria-label": "Source code on GitHub" });
  gh.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 .2a8 8 0 0 0-2.5 15.6c.4 0 .5-.2.5-.4v-1.5c-2.2.5-2.7-1-2.7-1-.4-.9-.9-1.2-.9-1.2-.7-.5.1-.5.1-.5.8.1 1.2.8 1.2.8.7 1.3 1.9.9 2.4.7 0-.5.3-.9.5-1.1-1.8-.2-3.6-.9-3.6-4 0-.9.3-1.6.8-2.1-.1-.2-.4-1 .1-2.1 0 0 .7-.2 2.2.8a7.5 7.5 0 0 1 4 0c1.5-1 2.2-.8 2.2-.8.4 1.1.2 1.9.1 2.1.5.6.8 1.3.8 2.1 0 3.1-1.9 3.7-3.6 3.9.3.3.5.8.5 1.5v2.2c0 .2.1.5.6.4A8 8 0 0 0 8 .2z"/></svg>';
  return h("header", { class: "site-header" }, menu, brand, h("div", { class: "header-spacer" }), h("div", { class: "header-actions" }, nb, gh, themeBtn));
}

function buildSidebar(current) {
  const nav = h("nav", { class: "sidebar", "aria-label": "Site" });
  for (const part of NAV) {
    const sec = h("div", { class: "nav-part" }, h("div", { class: "nav-part-title" }, h("span", {}, part.part), part.short ? h("span", {}, part.short) : null));
    const ol = h("ol");
    for (const it of part.items) {
      const a = h("a", { href: href(it.id) }, h("span", {}, it.title), it.book ? h("span", { class: "nav-book" }, it.book.split(",")[0]) : null);
      if (it.id === current) a.setAttribute("aria-current", "page");
      ol.append(h("li", {}, a));
    }
    sec.append(ol);
    nav.append(sec);
  }
  return nav;
}

function buildPager(current) {
  const i = ALL.findIndex((p) => p.id === current);
  if (i < 0) return null;
  const prev = ALL[i - 1], next = ALL[i + 1];
  return h("nav", { class: "pager", "aria-label": "Previous and next page" },
    prev ? h("a", { class: "prev", href: href(prev.id) }, h("span", { class: "dir" }, "← Previous"), h("span", {}, prev.title)) : h("span"),
    next ? h("a", { class: "next", href: href(next.id) }, h("span", { class: "dir" }, "Next →"), h("span", {}, next.title)) : null);
}

function buildFooter() {
  const f = h("footer", { class: "site-footer" });
  f.innerHTML = `<p>An interactive companion to <a href="${BOOK}">Network Science</a> by Albert-László Barabási (Ch 2–4) and its class notebook.
    Network data: the book's reference networks (Table 4.1), treated as undirected and simple.</p>
    <p>Everything on this site runs in your browser. No data leaves your machine. <a href="${REPO}">Source on GitHub</a>.</p>`;
  return f;
}

/** "Look for", "Discuss", … boxes get their label and icon; hints and answers get a reveal button. */
function enhanceCallouts(root) {
  const LABELS = { look: "Look for", discuss: "Discuss", key: "Key idea", gotcha: "Gotcha", try: "Try it", note: "Note", fix: "Correction to the notebook" };
  // correction boxes are filled from the errata list, so the site and notebook/ERRATA.md always agree
  for (const c of $$(".callout.fix[data-errata], .callout.fix[data-book], .callout.fix[data-software]", root)) {
    // notebook entries are located by cell; book and software entries by their own location text
    const kind = c.dataset.book ? "book" : c.dataset.software ? "software" : "notebook";
    const list = kind === "book" ? BOOK_ERRATA : kind === "software" ? SOFTWARE : ERRATA;
    const e = list.find((x) => x.id === (c.dataset.book || c.dataset.software || c.dataset.errata));
    if (!e) continue;
    const lab = h("div", { class: "callout-label" });
    lab.innerHTML = CALLOUT_ICONS.fix + `<span>${kind === "book" ? "Correction to the book" : kind === "software" ? "Bug in the powerlaw package" : "Correction to the notebook"}</span>`;
    lab.append(h("span", { class: "fix-loc" }, kind === "notebook" ? `· ${e.id} · cell ${e.cell}${e.run ? `, In [${e.run}]` : ""} · ${e.section}` : `· ${e.id} · ${e.location}`));
    const extra = c.innerHTML.trim();
    c.replaceChildren(lab,
      h("div", { class: "fix-quote" }, "“" + e.quote.replace(/\n/g, " ") + "”"),
      h("p", {}, e.issue),
      h("p", {}, h("strong", {}, "Corrected: "), e.correction, " ", h("a", { href: `notebook-check.html#${e.id}` }, "Details")));
    if (extra) c.append(h("div", { html: extra }));
  }
  for (const c of $$(".callout", root)) {
    const kind = Object.keys(LABELS).find((k) => c.classList.contains(k)) || "note";
    if (!c.querySelector(".callout-label")) {
      const lab = h("div", { class: "callout-label" });
      lab.innerHTML = (CALLOUT_ICONS[kind] || "") + `<span>${c.dataset.label || LABELS[kind]}</span>`;
      c.prepend(lab);
    }
    for (const hint of $$(".hint", c)) {
      hint.hidden = true;
      const label = hint.dataset.label || "Show a hint";
      const b = h("button", { type: "button", class: "btn small hint-toggle", "aria-expanded": "false" }, label);
      b.addEventListener("click", () => {
        hint.hidden = !hint.hidden;
        b.setAttribute("aria-expanded", String(!hint.hidden));
        b.textContent = hint.hidden ? label : "Hide";
      });
      hint.before(b);
    }
  }
}

/**
 * Quizzes written as
 *   <div class="quiz" data-answer="2"><p>Question</p><ol><li>…</li>…</ol><div class="explain">…</div></div>
 * become clickable multiple-choice questions with instant feedback.
 */
export function enhanceQuizzes(root = document) {
  for (const q of $$(".quiz:not([data-ready])", root)) {
    q.dataset.ready = "1";
    const answer = Number(q.dataset.answer);
    const items = $$("ol > li", q);
    const explain = $(".explain", q);
    const question = q.querySelector("p");
    const opts = h("div", { class: "quiz-options" });
    const fb = h("div", { class: "quiz-feedback", "aria-live": "polite" });
    items.forEach((li, i) => {
      const b = h("button", { type: "button" }, h("span", { class: "opt-letter" }, "ABCDEFG"[i]), h("span", { html: li.innerHTML }));
      b.addEventListener("click", () => {
        const ok = i + 1 === answer;
        for (const x of $$("button", opts)) x.classList.remove("correct", "wrong");
        b.classList.add(ok ? "correct" : "wrong");
        if (ok) for (const x of $$("button", opts)) x.disabled = true;
        fb.innerHTML = ok
          ? `<span class="verdict ok">✓ Correct.</span>${explain ? explain.innerHTML : ""}`
          : `<span class="verdict no">✗ Not quite.</span> Try another option.`;
        renderMath(fb);
      });
      opts.append(b);
    });
    const label = h("div", { class: "quiz-label" }, "Check yourself");
    q.replaceChildren(label, question ? h("div", { class: "quiz-q", html: question.innerHTML }) : "", opts, fb);
  }
}

/** Kicker above the H1: part, book section and notebook section. */
function buildKicker(info) {
  if (!info || info.id === "index") return null;
  const k = h("div", { class: "kicker" }, h("span", {}, info.part));
  if (info.book) k.append(h("a", { class: "chip", href: BOOK, target: "_blank", rel: "noopener", title: "Section of Network Science" }, "Book § " + info.book));
  if (info.nb) k.append(h("a", { class: "chip", href: NOTEBOOK_URL, target: "_blank", rel: "noopener", title: "Section of the class notebook (opens Colab)" }, "Notebook " + info.nb));
  return k;
}

function init() {
  const id = document.body.dataset.page || "index";
  const info = pageInfo(id);
  const main = $("main") || document.body.appendChild(h("main"));
  main.classList.add("main");
  main.id = "content";
  const content = $(".content", main) || (() => { const c = h("div", { class: "content" }); c.append(...main.childNodes); main.append(c); return c; })();
  const h1 = $("h1", content);
  const kicker = buildKicker(info);
  if (h1 && kicker) h1.before(kicker);
  const pager = buildPager(id);
  if (pager) content.append(pager);
  content.append(buildFooter());

  const layout = h("div", { class: "layout" }, buildSidebar(id));
  main.replaceWith(layout);
  layout.append(main);
  const scrim = h("div", { class: "scrim", onclick: () => document.body.classList.remove("nav-open") });
  document.body.prepend(h("a", { class: "skip-link", href: "#content" }, "Skip to content"), buildHeader(info), scrim);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") document.body.classList.remove("nav-open"); });

  enhanceCallouts(content);
  enhanceQuizzes(content);
  renderMath(content);
  const cur = $(".sidebar [aria-current]"), side = $(".sidebar");
  if (cur && side) side.scrollTop = Math.max(0, cur.offsetTop - side.clientHeight / 2);
  if (info) document.title = id === "index" ? "From Graphs to Hubs · Network Science, interactively" : `${info.title} · From Graphs to Hubs`;
}

init();
