// Site chrome shared by every page: header, navigation, pager, footer, theme, callouts, quizzes, maths.
// Each page's module imports this first; the page itself only contains its article.
import { h, $, $$, renderMath, emitThemeChange, CALLOUT_ICONS } from "./lib/ui.js";
import { ERRATA, BOOK as BOOK_ERRATA, SOFTWARE } from "./errata.js";
import { annotateTerms, installTermPopover, GLOSSARY, SYMBOLS } from "./glossary.js";
import { LANG, setLang, loadTurkish, translateLive, t } from "./i18n.js";

export const REPO = "https://github.com/ysoktar/graph-theory";
export const NOTEBOOK_URL = "https://colab.research.google.com/github/ysoktar/graph-theory/blob/main/notebook/Ch2_4_Applied_Tutorial.ipynb";
export const BOOK = "https://networksciencebook.com/";

/**
 * The whole site map. `book` = section of Barabási's Network Science, `nb` = section of the class notebook.
 * `scope` says how a page relates to the BIL489/589 course material (slides = book Ch 1–7, plus the class notebook):
 * "slides" (default for book chapters 1–7), "syllabus" (a syllabus topic with no slides yet), "beyond" (not on the syllabus).
 */
export const NAV = [
  { part: "Start", items: [
    { id: "index", title: "Overview", desc: "The question, the plan and how to use this site.",
      next: "Start with the big question: why study networks at all?" },
    { id: "ch1-intro", title: "Why networks?", book: "Ch 1", desc: "Complex systems as networks, and why the field took off around 2000.",
      next: "Next, meet the eight real networks that every later page measures." },
    { id: "data", title: "The data: eight real networks", nb: "0", desc: "The book's reference networks, side by side.",
      next: "To measure these networks we need a language. Graph theory began with a puzzle about seven bridges." },
  ] },
  { part: "Part I · Graph theory", short: "Ch 2", items: [
    { id: "ch2-konigsberg", title: "Königsberg & Euler", book: "2.1–2.2", desc: "Where graph theory began: seven bridges and the odd-degree rule.",
      next: "Euler's answer used only how many links each node has. That number, the degree, is the first tool for describing any network." },
    { id: "ch2-degree", title: "Degree & degree distribution", book: "2.3", nb: "I.1, I.4", desc: "Build a network, watch k, ⟨k⟩ = 2L/N and pₖ update.", needs: ["ch2-konigsberg"],
      next: "Degrees summarise each node. To compute with the whole wiring, write the network as a matrix." },
    { id: "ch2-adjacency", title: "The adjacency matrix", book: "2.4", nb: "I.2", desc: "A network as a matrix; Aⁿ counts walks, Tr(A³)/6 counts triangles.", needs: ["ch2-degree"],
      next: "Almost every entry of that matrix is zero. Real networks are sparse, and that shapes how we store and model them." },
    { id: "ch2-sparsity", title: "Real networks are sparse", book: "2.5", nb: "I.3", desc: "L ≪ L_max: why edge lists beat matrices.", needs: ["ch2-degree", "ch2-adjacency"],
      next: "So far every link is the same. Links can also carry a strength, or join two kinds of node." },
    { id: "ch2-weighted-bipartite", title: "Weighted & bipartite networks", book: "2.6–2.7", nb: "I.8", desc: "Southern Women: projections create weighted networks.", needs: ["ch2-adjacency"],
      next: "Degrees describe single nodes. Next question: how far apart are two nodes?" },
    { id: "ch2-paths", title: "Paths & distances", book: "2.8", nb: "I.5", desc: "Step through breadth-first search; diameter and ⟨d⟩.", needs: ["ch2-adjacency"],
      next: "Sometimes there is no path at all. Which nodes can reach each other?" },
    { id: "ch2-connectedness", title: "Connectedness", book: "2.9", nb: "I.6", desc: "Components, bridges and the giant component.", needs: ["ch2-paths"],
      next: "One more measurement: do a node's neighbours know each other?" },
    { id: "ch2-clustering", title: "Clustering", book: "2.10, 2.A", nb: "I.7", desc: "Triangles around a node; ⟨C⟩ versus the global C_Δ.", needs: ["ch2-degree", "ch2-adjacency"],
      next: "We can now measure degrees, distances and clustering. Are the values we see surprising? To tell, we need a baseline: a network wired purely at random." },
  ] },
  { part: "Part II · Random networks", short: "Ch 3", items: [
    { id: "ch3-model", title: "The random network model", book: "3.2–3.3", nb: "II.1", desc: "G(N, p) step by step; L is a binomial random variable.", needs: ["ch2-degree", "ch2-sparsity"],
      next: "What degrees does random wiring produce?" },
    { id: "ch3-degree", title: "Binomial → Poisson degrees", book: "3.4", nb: "II.2", desc: "pₖ depends only on ⟨k⟩, not on N.", needs: ["ch3-model", "ch2-degree"],
      next: "Do real networks have Poisson degrees? Test it on the eight networks." },
    { id: "ch3-real-degrees", title: "Real networks are not Poisson", book: "3.5", nb: "II.3", desc: "How many hubs would a random network have? About none.", needs: ["ch3-degree", "data"],
      next: "The degrees fail the test. What about the large-scale shape: when does a random network hold together?" },
    { id: "ch3-evolution", title: "Evolution & the giant component", book: "3.6–3.7, 3.C–3.D", nb: "II.4–II.5", desc: "Add links one by one and watch a phase transition.", needs: ["ch3-model", "ch2-connectedness"],
      next: "Inside the giant component, how far apart are the nodes?" },
    { id: "ch3-small-world", title: "Small worlds", book: "3.8, 3.G", nb: "II.6", desc: "Six degrees, ⟨d⟩ ≈ ln N / ln⟨k⟩, and the Watts–Strogatz model.", needs: ["ch2-paths", "ch3-evolution"],
      next: "Random wiring gets distances right. Does it get clustering right?" },
    { id: "ch3-clustering", title: "Clustering in random networks", book: "3.9", nb: "II.7", desc: "C = ⟨k⟩/N vanishes; real C(k) does not.", needs: ["ch2-clustering", "ch3-model"],
      next: "Time to score the random model against all the data at once." },
    { id: "ch3-summary", title: "Real networks are not random", book: "3.10", nb: "II.8", desc: "Scorecard: what the null model gets right and wrong.", needs: ["ch3-real-degrees", "ch3-small-world", "ch3-clustering"],
      next: "The random model fails worst on hubs. Which distribution describes the degrees we actually see?" },
  ] },
  { part: "Part III · Scale-free networks", short: "Ch 4", items: [
    { id: "ch4-power-laws", title: "Power laws & hubs", book: "4.1–4.2", nb: "III.2", desc: "pₖ ~ k^−γ against Poisson, on linear and log axes.", needs: ["ch3-real-degrees"],
      next: "To test for a power law you first have to plot pₖ properly, and that is easy to get wrong." },
    { id: "ch4-plotting", title: "How (not) to plot pₖ", book: "4.B", nb: "III.1", desc: "Linear bins, log bins and the CCDF on real data.", needs: ["ch4-power-laws"],
      next: "A good plot shows the shape. A number needs a fit: how do you estimate γ reliably?" },
    { id: "ch4-fitting", title: "Estimating the exponent", book: "4.C", nb: "III.3", desc: "Least squares vs. maximum likelihood; the k_min scan.", needs: ["ch4-plotting"],
      next: "With γ in hand: how large can the biggest hub get?" },
    { id: "ch4-hubs", title: "The largest hub", book: "4.3", nb: "III.4", desc: "k_max grows like N^{1/(γ−1)}, not like ln N.", needs: ["ch4-power-laws"],
      next: "Growing hubs make the second moment ⟨k²⟩ blow up, and that is what “scale-free” really means." },
    { id: "ch4-moments", title: "No typical degree", book: "4.4", nb: "III.5", desc: "⟨k²⟩ diverges: what 'scale-free' really means.", needs: ["ch4-hubs", "ch2-degree"],
      next: "Is this one network's quirk, or do all eight networks share it?" },
    { id: "ch4-universality", title: "Universality", book: "4.5", nb: "III.6", desc: "Eight networks, one procedure, many tails.", needs: ["ch4-fitting"],
      next: "What do hubs do to distances?" },
    { id: "ch4-ultra-small", title: "Ultra-small worlds", book: "4.6", nb: "III.7", desc: "Hubs as shortcuts: ⟨d⟩ ~ ln ln N.", needs: ["ch3-small-world", "ch4-hubs"],
      next: "Hubs, moments and distances all depend on γ. The next page puts them side by side." },
    { id: "ch4-exponent", title: "The role of γ", book: "4.7", nb: "III.8", desc: "Anomalous, scale-free and random-like regimes.", needs: ["ch4-moments", "ch4-ultra-small"],
      next: "To test any of these effects we need random networks with a degree sequence of our choosing." },
    { id: "ch4-generating", title: "Generating networks", book: "4.8", nb: "III.9", desc: "Configuration model and degree-preserving randomization.", needs: ["ch2-degree", "ch3-model"],
      next: "The configuration model copies hubs but cannot say where they come from. Which process creates them?" },
  ] },
  { part: "Part IV · Where hubs come from", short: "Ch 5–6", items: [
        { id: "ch5-preview", title: "The Barabási–Albert model", book: "5.1–5.5", desc: "Growth + preferential attachment gives γ = 3.", needs: ["ch4-power-laws", "ch4-hubs"],
      next: "The model has two ingredients. Are both needed, and do real networks really attach preferentially?" },
    { id: "ch5-ingredients", title: "Testing preferential attachment", book: "5.6–5.8", desc: "Models A and B, measuring attachment, nonlinear attachment.", needs: ["ch5-preview"],
      next: "Real networks do attach preferentially. But how can a new node prefer hubs without knowing anyone's degree?" },
    { id: "ch5-origins", title: "Origins and properties of BA networks", book: "5.9–5.10", desc: "Link selection and copying; distances and clustering of BA networks.", needs: ["ch5-ingredients"],
      next: "In the BA model the oldest node always wins and γ is always 3. Real networks disagree: what is missing?" },
    { id: "evolving", title: "Evolving networks: fitness", book: "6.1–6.2", desc: "Latecomers can win: the Bianconi–Barabási model.", needs: ["ch5-preview"],
      next: "Fitness is invisible. Can we measure it from how fast nodes grow?" },
    { id: "evolving-measure", title: "Measuring fitness", book: "6.3", desc: "Fitness from growth rates; the citation model.", needs: ["evolving"],
      next: "Some fitness distributions let one group of nodes grab a finite share of all links. When, and why?" },
    { id: "evolving-bec", title: "Bose–Einstein condensation", book: "6.4", desc: "Fit-get-rich or winner-takes-all, decided by ρ(η).", needs: ["evolving"],
      next: "Fitness is one missing process. Real networks also add internal links, lose nodes, grow denser and age." },
    { id: "evolving-processes", title: "Elementary processes", book: "6.5–6.6", desc: "Attractiveness, internal links, deletion, acceleration, aging: what each does to γ.", needs: ["evolving"],
      next: "We know where hubs come from. Next question: whom do they link to?" },
  ] },
  { part: "Part V · What the wiring does", short: "Ch 7–8", items: [
        { id: "correlations", title: "Degree correlations", book: "7.1–7.2", desc: "Do hubs link to hubs? Three kinds of network and the matrix e_jk.", needs: ["ch4-moments", "ch4-generating"],
      next: "The matrix holds everything but is hard to read. How do we measure correlations with a curve or a single number?" },
    { id: "correlations-measure", title: "Measuring correlations", book: "7.3", desc: "k_nn(k), the exponent μ, the friendship paradox and r.", needs: ["correlations"],
      next: "Some correlations are forced on a network by its hubs. How do we tell them from real ones?" },
    { id: "correlations-cutoffs", title: "Structural cutoffs and real networks", book: "7.4–7.5", desc: "Structural disassortativity, k_s and the book's networks.", needs: ["correlations-measure"],
      next: "Which models produce correlations, and do correlations change how a network behaves?" },
    { id: "correlations-models", title: "Correlated models and their impact", book: "7.6–7.8", desc: "Correlations of every model; the Xalvi-Brunet–Sokolov algorithm; impact.", needs: ["correlations-cutoffs"],
      next: "Hubs and how they connect decide what happens when nodes fail. How much damage can a network take?" },
    { id: "robustness", title: "Robustness and percolation", book: "8.1–8.2", scope: "syllabus", desc: "How many nodes can a network lose? Percolation theory.", needs: ["ch3-evolution", "ch4-moments"],
      next: "Percolation on a lattice has a critical point. Where is the critical point of a network that loses nodes at random?" },
    { id: "robustness-failures", title: "Random failures", book: "8.3", scope: "syllabus", desc: "Molloy–Reed and why scale-free networks survive random failures.", needs: ["robustness"],
      next: "Failures rarely hit hubs. What if someone aims for them?" },
    { id: "robustness-attacks", title: "Attacks", book: "8.4", scope: "syllabus", desc: "Removing hubs first: robust yet fragile.", needs: ["robustness-failures"],
      next: "Removed nodes are only the start: in real systems one failure can trigger the next." },
    { id: "robustness-cascades", title: "Cascades and building robustness", book: "8.5–8.8", scope: "syllabus", desc: "Cascading failures and networks designed to resist failures and attacks.", needs: ["robustness-attacks"],
      next: "So far a network is described by a few numbers. Machine learning needs a description of every single node." },
  ] },
  { part: "Part VI · Learning on networks", short: "Graph ML", items: [
        { id: "graphml", title: "Intro to graph ML", scope: "syllabus", desc: "Tasks and hand-made features: centralities, PageRank, Katz, Weisfeiler–Lehman.", needs: ["ch2-adjacency", "ch2-clustering"],
      next: "Hand-made features must be designed for each task. Can the features be learned instead?" },
    { id: "embeddings", title: "Node embeddings", scope: "syllabus", desc: "Spectral and random-walk embeddings, graph neural networks.", needs: ["graphml"],
      next: "Beyond the course: the spectral split you just saw finds groups. How do you tell a real community from chance?" },
  ] },
  { part: "Beyond the course", short: "Ch 9–10", items: [
    { id: "communities", title: "Communities", book: "Ch 9", scope: "beyond", desc: "The karate club split, modularity and label propagation.", needs: ["ch4-generating", "embeddings"],
      next: "Beyond the course: the κ that keeps a network connected under failures also spreads infections through it." },
    { id: "epidemics", title: "Spreading & vaccination", book: "Ch 10", scope: "beyond", desc: "Why ⟨k²⟩ sets the epidemic threshold.", needs: ["robustness", "correlations"],
      next: "Time to put it all together: the models against the data, and a self-test." },
  ] },
  { part: "Review & exam prep", items: [
    { id: "synthesis", title: "Synthesis & self-test", nb: "IV", desc: "Random vs. scale-free vs. real, key messages and a quiz.", needs: ["ch3-summary", "ch4-exponent"],
      next: "Ready for the exams: worked problems and practice sets, chapter by chapter." },
    { id: "exam-midterm", title: "Midterm study guide", scope: "none", desc: "What to know for Ch 1–5, worked problems and a practice set.",
      next: "The final covers the whole course, weighted to Ch 6–8, graph ML and embeddings." },
    { id: "exam-final", title: "Final study guide", scope: "none", desc: "The whole course, weighted to Ch 6–8, GraphML and embeddings.",
      next: "Try everything on networks of your own." },
  ] },
  { part: "Tools", items: [
    { id: "lab", title: "Network lab", desc: "Generate, load or paste a network and measure everything.",
      next: "Every formula and every term in one place." },
    { id: "formulas", title: "Formula sheet & glossary", desc: "Every definition and result in one place.",
      next: "How each claim of the class notebook held up when re-checked." },
    { id: "notebook-check", title: "Notebook check", desc: "Each claim of the class notebook, re-verified." },
  ] },
];

const ALL = NAV.flatMap((p) => p.items.map((it) => ({ ...it, part: p.part, short: p.short })));
for (const it of ALL) it.scope ??= it.book ? "slides" : "none";
export const SCOPES = {
  slides: { label: "In the slides", tip: "Covered by the course slides (book Ch 1–7) or the class notebook." },
  syllabus: { label: "Syllabus topic · no slides yet", tip: "On the BIL489/589 syllabus, but its slides are not posted yet: this page follows the book." },
  beyond: { label: "Beyond the course", tip: "Not on the BIL489/589 syllabus: extra reading, not exam material." },
};
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
  brand.append(h("span", { class: "brand-title" }, "From Graphs to Hubs"), h("span", { class: "brand-sub" }, "Network science · BIL489/589"));
  const nb = h("a", { class: "icon-btn", href: NOTEBOOK_URL, target: "_blank", rel: "noopener", title: "Open the class notebook in Google Colab" });
  nb.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2.5" y="1.5" width="11" height="13" rx="1.5"/><path d="M5 5h6M5 8h6M5 11h3"/></svg><span class="label">Notebook</span>';
  const gh = h("a", { class: "icon-btn", href: REPO, target: "_blank", rel: "noopener", title: "Source code on GitHub", "aria-label": "Source code on GitHub" });
  gh.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 .2a8 8 0 0 0-2.5 15.6c.4 0 .5-.2.5-.4v-1.5c-2.2.5-2.7-1-2.7-1-.4-.9-.9-1.2-.9-1.2-.7-.5.1-.5.1-.5.8.1 1.2.8 1.2.8.7 1.3 1.9.9 2.4.7 0-.5.3-.9.5-1.1-1.8-.2-3.6-.9-3.6-4 0-.9.3-1.6.8-2.1-.1-.2-.4-1 .1-2.1 0 0 .7-.2 2.2.8a7.5 7.5 0 0 1 4 0c1.5-1 2.2-.8 2.2-.8.4 1.1.2 1.9.1 2.1.5.6.8 1.3.8 2.1 0 3.1-1.9 3.7-3.6 3.9.3.3.5.8.5 1.5v2.2c0 .2.1.5.6.4A8 8 0 0 0 8 .2z"/></svg>';
  const langBtn = h("button", { class: "icon-btn lang-btn", type: "button", lang: LANG === "tr" ? "en" : "tr", title: LANG === "tr" ? "Switch to English" : "Türkçe sürüme geç", "data-no-tr": "" }, LANG === "tr" ? "EN" : "TR");
  langBtn.addEventListener("click", () => setLang(LANG === "tr" ? "en" : "tr"));
  return h("header", { class: "site-header" }, menu, brand, h("div", { class: "header-spacer" }), h("div", { class: "header-actions" }, langBtn, nb, gh, themeBtn));
}

function buildSidebar(current) {
  const nav = h("nav", { class: "sidebar", "aria-label": "Site" });
  for (const part of NAV) {
    const sec = h("div", { class: "nav-part" }, h("div", { class: "nav-part-title" }, h("span", {}, part.part), part.short ? h("span", {}, part.short) : null));
    const ol = h("ol");
    for (const it of part.items) {
      const sc = ALL.find((x) => x.id === it.id).scope;
      const tag = sc === "beyond" ? h("span", { class: "nav-scope beyond", title: SCOPES.beyond.tip }, "extra")
        : sc === "syllabus" ? h("span", { class: "nav-scope syllabus", title: SCOPES.syllabus.tip }, "no slides") : null;
      const a = h("a", { href: href(it.id) }, h("span", {}, it.title, tag), it.book ? h("span", { class: "nav-book" }, it.book.split(",")[0]) : null);
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

/** "Builds on": the pages a reader should know first, shown under the title. */
function buildPrereqs(info) {
  if (!info || !info.needs || !info.needs.length) return null;
  const p = h("p", { class: "prereq" }, h("span", { class: "prereq-label" }, t("Builds on:")), " ");
  info.needs.forEach((id, i) => { if (i) p.append(" · "); p.append(h("a", { href: href(id) }, pageInfo(id).title)); });
  return p;
}

/** "Up next": the question the next page answers, so the pages read as one argument. */
function buildNextUp(info) {
  const i = ALL.findIndex((p) => p.id === info?.id);
  const next = ALL[i + 1];
  if (i < 0 || !next || !info.next) return null;
  return h("aside", { class: "next-up", "aria-label": t("Up next") },
    h("div", { class: "next-up-label" }, t("Up next")),
    h("p", {}, h("a", { href: href(next.id) }, next.title), ": ", h("span", {}, info.next)));
}

/**
 * "On this page": the page's sections, as a sticky column on the right of wide landscape screens and as a
 * collapsible box under the lead elsewhere (CSS shows one of the two). The section being read is highlighted.
 */
function buildToc(content) {
  const heads = $$(":scope > h2, :scope > h3, :scope > section > h2, :scope > section > h3", content).filter((x) => x.textContent.trim());
  if (heads.length < 3) return null;
  const withH3 = heads.length <= 32; // long guides list only their main sections
  const items = heads.filter((x) => withH3 || x.tagName === "H2");
  items.forEach((x, i) => { if (!x.id) x.id = `sec-${i + 1}`; });
  const firstQuiz = $(":scope > .quiz, :scope > section > .quiz", content);
  if (firstQuiz && !firstQuiz.id) firstQuiz.id = "check";
  const list = () => {
    const ol = h("ol");
    for (const x of items) ol.append(h("li", { class: x.tagName === "H3" ? "toc-sub" : "" }, h("a", { href: `#${x.id}`, "data-target": x.id }, x.textContent)));
    if (firstQuiz) ol.append(h("li", { class: "toc-check" }, h("a", { href: `#${firstQuiz.id}`, "data-target": firstQuiz.id }, t("Check yourself"))));
    return ol;
  };
  const side = h("nav", { class: "toc toc-side", "aria-label": t("On this page") }, h("div", { class: "toc-title" }, t("On this page")), list());
  const inline = h("details", { class: "toc toc-inline" }, h("summary", {}, `${t("On this page")} · ${items.length}`), list());
  inline.addEventListener("click", (e) => { if (e.target.closest("a")) inline.open = false; });
  // highlight the section being read: the last target whose top is above 35% of the viewport height
  const targets = [...items, ...(firstQuiz ? [firstQuiz] : [])];
  let ticking = false;
  const spy = () => {
    ticking = false;
    const line = window.innerHeight * 0.35;
    let cur = null;
    for (const x of targets) if (x.getBoundingClientRect().top <= line) cur = x.id;
    for (const a of $$(".toc a[data-target]")) a.classList.toggle("active", a.dataset.target === cur);
    const act = $(".toc-side a.active");
    if (act && side.scrollHeight > side.clientHeight) {
      const r = act.offsetTop - side.scrollTop;
      if (r < 40 || r > side.clientHeight - 40) side.scrollTop = act.offsetTop - side.clientHeight / 2;
    }
  };
  window.addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(spy); } }, { passive: true });
  requestAnimationFrame(spy);
  return { side, inline };
}

/** Shrink display equations that are wider than their column (down to 72%), so narrow screens see them whole. */
function fitEquations(root = document) {
  for (const el of $$(".eq", root)) {
    el.style.fontSize = "";
    const sw = el.scrollWidth, cw = el.clientWidth;
    if (cw && sw > cw + 1) el.style.fontSize = `${Math.max(0.72, (cw - 2) / sw) * 100}%`;
  }
}

function buildFooter() {
  const f = h("footer", { class: "site-footer" });
  if (LANG === "tr") {
    f.innerHTML = `<p>Albert-László Barabási'nin <a href="${BOOK}">Network Science</a> kitabına ve BIL489/589 Çizge Kuramı dersinin not defterine etkileşimli bir eşlikçi.
    Ağ verisi: kitabın referans ağları (Tablo 4.1), yönsüz ve basit ağlar olarak ele alındı.</p>
    <p>Bu sitedeki her şey tarayıcınızda çalışır; hiçbir veri bilgisayarınızdan çıkmaz. <a href="${REPO}">GitHub'daki kaynak kod</a>.</p>`;
    return f;
  }
  f.innerHTML = `<p>An interactive companion to <a href="${BOOK}">Network Science</a> by Albert-László Barabási and the BIL489/589 Graph Theory course notebook.
    Network data: the book's reference networks (Table 4.1), treated as undirected and simple.</p>
    <p>Everything on this site runs in your browser. No data leaves your machine. <a href="${REPO}">Source on GitHub</a>.</p>`;
  return f;
}

/** "Look for", "Discuss", … boxes get their label and icon; hints and answers get a reveal button. */
function enhanceCallouts(root) {
  const LABELS = { look: "Look for", discuss: "Discuss", key: "Key idea", gotcha: "Gotcha", try: "Try it", note: "Note", fix: "Correction to the notebook", why: "Why it matters", connect: "How this connects", example: "Worked example" };
  // correction boxes are filled from the errata list, so the site and notebook/ERRATA.md always agree
  for (const c of $$(".callout.fix[data-errata], .callout.fix[data-book], .callout.fix[data-software]", root)) {
    // notebook entries are located by cell; book and software entries by their own location text
    const kind = c.dataset.book ? "book" : c.dataset.software ? "software" : "notebook";
    const list = kind === "book" ? BOOK_ERRATA : kind === "software" ? SOFTWARE : ERRATA;
    const e = list.find((x) => x.id === (c.dataset.book || c.dataset.software || c.dataset.errata));
    if (!e) continue;
    const lab = h("div", { class: "callout-label" });
    lab.innerHTML = CALLOUT_ICONS.fix + `<span>${kind === "book" ? "Correction to the book" : kind === "software" ? "Bug in the powerlaw package" : "Correction to the notebook"}</span>`;
    lab.append(h("span", { class: "fix-loc" }, kind === "notebook" ? `· ${e.id} · ${t("cell")} ${e.cell}${e.run ? `, In [${e.run}]` : ""} · ${e.section}` : `· ${e.id} · ${e.location}`));
    const extra = c.innerHTML.trim();
    c.replaceChildren(lab,
      h("div", { class: "fix-quote" }, "“" + e.quote.replace(/\n/g, " ") + "”"),
      h("p", {}, e.issue),
      h("p", {}, h("strong", {}, t("Corrected:") + " "), e.correction, " ", h("a", { href: `notebook-check.html#${e.id}` }, t("Details"))));
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
 * Content outside the course slides is marked in the page source as data-beyond="reason";
 * it gets a visible badge (on its heading if it is a section, at its start otherwise).
 */
function markBeyond(root) {
  for (const el of $$("[data-beyond]", root)) {
    el.classList.add("is-beyond");
    const reason = el.dataset.beyond;
    const badge = h("span", { class: "beyond-badge", title: t("Not in the course slides (book Ch 1–7) or the class notebook") + (reason ? `: ${reason}` : "") },
      t("Beyond the slides"), reason ? h("span", { class: "why" }, " · " + reason) : null);
    const target = el.matches("section, div:not(.callout), details") ? el.querySelector("h2, h3, h4, summary, .callout-label") : el.matches(".callout") ? el.querySelector(".callout-label") : null;
    if (target) target.append(badge);
    else el.prepend(badge, " ");
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
        const first = !q.dataset.tried;
        q.dataset.tried = "1";
        q.dispatchEvent(new CustomEvent("quizanswer", { bubbles: true, detail: { correct: ok, firstTry: first } }));
        for (const x of $$("button", opts)) x.classList.remove("correct", "wrong");
        b.classList.add(ok ? "correct" : "wrong");
        if (ok) for (const x of $$("button", opts)) x.disabled = true;
        // a wrong option may carry its own explanation (<li data-why="…">) of why it is tempting but wrong
        const why = li.dataset.why;
        fb.innerHTML = ok
          ? `<span class="verdict ok">✓ ${t("Correct.")}</span> ${explain ? explain.innerHTML : ""}`
          : `<span class="verdict no">✗ ${t("Not quite.")}</span> ${why ? why + " " : ""}${t("Try another option.")}`;
        renderMath(fb);
      });
      opts.append(b);
    });
    const label = h("div", { class: "quiz-label" }, "Check yourself");
    q.replaceChildren(label, question ? h("div", { class: "quiz-q", html: question.innerHTML }) : "", opts, fb);
  }
}

/** Glossary underlines: each quiz on its own (quizzes also appear alone in the exam practice sets), then the page. */
export function annotateGlossary(root, page, { quizzesOnly = false } = {}) {
  for (const q of $$(".quiz", root)) annotateTerms(q, page);
  if (!quizzesOnly) annotateTerms(root, page, new Set(), ".quiz");
}

/** Kicker above the H1: part, book section and notebook section. */
function buildKicker(info) {
  if (!info || info.id === "index") return null;
  const k = h("div", { class: "kicker" }, h("span", {}, info.part));
  if (info.book) k.append(h("a", { class: "chip", href: BOOK, target: "_blank", rel: "noopener", title: t("Section of Network Science") }, t("Book §") + " " + info.book));
  if (info.nb) k.append(h("a", { class: "chip", href: NOTEBOOK_URL, target: "_blank", rel: "noopener", title: t("Section of the class notebook (opens Colab)") }, t("Notebook") + " " + info.nb));
  const sc = SCOPES[info.scope];
  if (sc) k.append(h("span", { class: `chip scope ${info.scope}`, title: sc.tip }, h("span", { class: "dot" }), sc.label));
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
  const prereq = buildPrereqs(info);
  if (h1 && prereq) h1.after(prereq);
  const nextUp = buildNextUp(info);
  if (nextUp) content.append(nextUp);
  const pager = buildPager(id);
  if (pager) content.append(pager);
  content.append(buildFooter());

  const layout = h("div", { class: "layout" }, buildSidebar(id));
  main.replaceWith(layout);
  layout.append(main);
  const toc = buildToc(content);
  if (toc) {
    layout.classList.add("has-toc");
    layout.append(toc.side);
    const lead = $(":scope > .lead", content);
    (lead || prereq || h1)?.after(toc.inline);
  }
  const scrim = h("div", { class: "scrim", onclick: () => document.body.classList.remove("nav-open") });
  document.body.prepend(h("a", { class: "skip-link", href: "#content" }, "Skip to content"), buildHeader(info), scrim);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") document.body.classList.remove("nav-open"); });

  enhanceCallouts(content);
  markBeyond(content);
  enhanceQuizzes(content);
  renderMath(content);
  fitEquations(content);
  // widths change once the KaTeX fonts arrive, so measure again then
  document.fonts?.ready.then(() => fitEquations(content));
  window.addEventListener("load", () => fitEquations(content));
  let fitTimer = 0;
  window.addEventListener("resize", () => { clearTimeout(fitTimer); fitTimer = setTimeout(() => fitEquations(content), 150); });
  annotateGlossary(content, id);
  installTermPopover();
  const cur = $(".sidebar [aria-current]"), side = $(".sidebar");
  if (cur && side) side.scrollTop = Math.max(0, cur.offsetTop - side.clientHeight / 2);
  if (info && LANG !== "tr") document.title = id === "index" ? "From Graphs to Hubs · Network Science, interactively" : `${info.title} · From Graphs to Hubs`;
  translateLive(document.body);
}

// the Turkish article and string tables load before the page's own script runs (it imports this module)
await loadTurkish(document.body.dataset.page || "index", { errata: [ERRATA, BOOK_ERRATA, SOFTWARE], glossary: GLOSSARY, symbols: SYMBOLS });
init();
