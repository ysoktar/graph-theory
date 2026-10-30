import { NAV, NOTEBOOK_URL } from "../layout.js";
import { h, $, button, checkbox } from "../lib/ui.js";
import { NetView } from "../lib/netview.js";
import { RNG } from "../lib/rng.js";
import * as G from "../lib/graph.js";

$("#nb-link").href = NOTEBOOK_URL;

// ---- part cards
const QUESTIONS = {
  "Start": "What are we looking at?",
  "Part I · Graph theory": "How do we describe a network?",
  "Part II · Random networks": "What would a network look like if it were wired at random?",
  "Part III · Scale-free networks": "What do real networks have that random ones lack?",
  "Part IV · Synthesis": "What did we learn, and can you apply it?",
  "Part V · The rest of the course": "Where do hubs come from, and what do they do?",
  "Tools": "Experiment freely.",
};
const parts = $("#parts");
for (const p of NAV) {
  const first = p.items[0];
  const card = h("div", { class: "card" },
    h("div", { class: "card-kicker" }, p.part + (p.short ? ` · ${p.short}` : "")),
    h("a", { class: "card-title", href: first.id === "index" ? "index.html" : first.id + ".html", style: { color: "var(--text)", textDecoration: "none" } }, QUESTIONS[p.part] || p.part),
    h("ol", {}, p.items.filter((it) => it.id !== "index").map((it) => h("li", {}, h("a", { href: it.id + ".html" }, it.title)))));
  parts.append(card);
}

// ---- hero: a random network and a scale-free network with the same N and ⟨k⟩
const host = $("#hero");
const card = h("div", { class: "fig", style: { margin: 0 } });
const controls = h("div", { class: "fig-controls", style: { paddingTop: 0 } });
const body = h("div", { class: "fig-body cols-2" });
const cap = h("p", { class: "fig-caption" });
card.append(controls, body, cap);
host.append(card);

const N = 160;
let showHubs = true;
const views = [];
const panels = [
  { title: "Random network", color: "random" },
  { title: "Scale-free network", color: "s1" },
];
let graphs = [];
const hubSets = [];

function build(seed) {
  const rng = new RNG(seed);
  const sf = G.giantComponent(G.barabasiAlbert(N, 2, rng)).graph;
  const er = G.giantComponent(G.gnm(N, sf.m, rng)).graph;
  graphs = [er, sf];
  graphs.forEach((g, i) => {
    const d = g.degrees();
    const top = [...d.keys()].sort((a, b) => d[b] - d[a]).slice(0, 5);
    hubSets[i] = new Set(top);
  });
}

panels.forEach((p, i) => {
  const wrap = h("div", { class: "panel" }, h("div", { class: "panel-title" }, p.title));
  body.append(wrap);
  const v = new NetView(wrap, {
    height: (w) => Math.max(240, Math.min(320, w * 0.95)), toolbar: false, charge: -26, linkDistance: 18, gravity: 0.09,
    nodeRadius: (j) => 2.2 + 1.3 * Math.sqrt(graphs[i].degree(j)),
    nodeColor: (j) => (showHubs && hubSets[i].has(j) ? "s2" : p.color),
    edgeColor: () => "axis",
    tooltip: (j) => `node ${j}: degree ${graphs[i].degree(j)}`,
  });
  views.push(v);
});

function stat() {
  const [er, sf] = graphs.map((g) => G.degreeStats(g));
  cap.replaceChildren(
    "Same number of nodes and links: an Erdős–Rényi network (Poisson degrees) and a Barabási–Albert network (power-law degrees). Largest degree: ",
    h("strong", {}, String(er.max)), " in the random network, ",
    h("strong", {}, String(sf.max)), " in the scale-free one. ",
    showHubs ? "The five best-connected nodes are shown in orange." : "Node size grows with degree.");
}

function refresh(seed) {
  build(seed);
  views.forEach((v, i) => v.setGraph(graphs[i], { keep: false }));
  stat();
}
let seed = 7;
checkbox(controls, { label: "Highlight the 5 largest hubs", checked: true, onChange: (v) => { showHubs = v; views.forEach((w) => w.redraw()); stat(); } });
button(controls, { label: "New networks", icon: "dice", onClick: () => refresh(++seed) });
refresh(seed);

// ---- concept map: how the topics depend on each other (one narrow layout, readable on phones)
{
  const W = 400, BW = 180, BH = 44, A = 10, B = 210;
  const PART = { I: "s1", II: "random", III: "s2", V: "s3", null: "theory" };
  const box = (id, x, y, part, href, title, sub) => ({ id, x, y, part, href, title, sub });
  const nodes = [
    box("deg", A, 40, "I", "ch2-degree", "Degree kᵢ", "Part I"),
    box("pk", A, 110, "I", "ch2-degree", "Degree distribution pₖ", "Part I"),
    box("poi", A, 180, "II", "ch3-degree", "Poisson pₖ", "Part II · random model"),
    box("tail", A, 250, "II", "ch3-real-degrees", "Heavy tails", "Part II · real data"),
    box("pl", A, 320, "III", "ch4-power-laws", "Power laws", "Part III"),
    box("hub", A, 390, "III", "ch4-hubs", "Hubs", "Part III"),
    box("rob", A, 460, "V", "robustness", "Robustness", "Part V"),
    box("epi", A, 530, "V", "epidemics", "Epidemics", "Part V"),
    box("path", B, 40, "I", "ch2-paths", "Paths & distances", "Part I"),
    box("sw", B, 110, "II", "ch3-small-world", "Small worlds", "Part II · ⟨d⟩ ~ ln N"),
    box("usw", B, 180, "III", "ch4-ultra-small", "Ultra-small worlds", "Part III · via hubs"),
    box("clu", B, 250, "I", "ch2-clustering", "Clustering", "Part I"),
    box("ws", B, 320, "II", "ch3-small-world", "Watts–Strogatz", "Part II · adds clustering"),
    box("gnl", B, 422, "null", "ch3-model", "Random G(N, L)", "keeps N and L"),
    box("cm", B, 484, "null", "ch4-generating", "Configuration model", "keeps the degrees"),
    box("dpr", B, 546, "null", "ch4-generating", "Degree-preserving", "randomization of real links"),
  ];
  const at = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const down = (a, b) => { const p = at[a], q = at[b]; return `M${p.x + BW / 2},${p.y + BH} V${q.y - 2}`; };
  const edges = [
    { d: down("deg", "pk") }, { d: down("pk", "poi") }, { d: down("poi", "tail"), label: "real data deviate" },
    { d: down("tail", "pl") }, { d: down("pl", "hub") }, { d: down("hub", "rob") },
    { d: `M${A},${412} H4 V${552} H${A - 2}` },                        // hubs → epidemics, along the left edge
    { d: down("path", "sw") }, { d: down("sw", "usw") }, { d: down("clu", "ws") },
    { d: `M${B + BW},${132} H396 V${342} H${B + BW + 2}` },              // small worlds → Watts–Strogatz, right edge
    { d: `M${A + BW},${412} H196 V${214} H${B - 2}` }, // hubs → ultra-small
    { d: `M${B},${444} H204 V${192} H${A + BW + 2}`, dashed: true },     // G(N, L) predicts Poisson
    { d: down("gnl", "cm"), dashed: true }, { d: down("cm", "dpr"), dashed: true },
  ];
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const svg = [
    `<svg class="cmap" viewBox="0 0 ${W} 600" role="img" aria-labelledby="cmap-t"><title id="cmap-t">Concept map: degree leads to the degree distribution, Poisson, heavy tails, power laws, hubs, robustness and epidemics; paths lead to small and ultra-small worlds; clustering leads to the Watts–Strogatz model; null models are compared with all of them.</title>`,
    `<style>.cmap{display:block;width:100%;max-width:520px;margin:0 auto 0.6rem;font-family:inherit}.cmap a rect{fill:var(--surface);stroke-width:1.6}.cmap a:hover rect,.cmap a:focus rect{fill:var(--surface-2)}.cmap .t{font-size:13.5px;font-weight:600;fill:var(--text)}.cmap .s{font-size:11.5px;fill:var(--muted)}.cmap .e{fill:none;stroke:var(--muted);stroke-width:1.4}.cmap .e.dash{stroke-dasharray:5 4}.cmap .el{font-size:11px;fill:var(--text-2)}.cmap .grp{fill:none;stroke:var(--theory);stroke-dasharray:3 3;stroke-width:1}</style>`,
    `<defs><marker id="cmap-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--muted)"/></marker></defs>`,
    `<text class="s" x="${A}" y="26">Degrees</text><text class="s" x="${B}" y="26">Distances and clustering</text>`,
    `<rect class="grp" x="${B - 4}" y="392" width="${BW + 8}" height="${600 - 392 - 4}" rx="10"/><text class="s" x="${B + 4}" y="410">Null models (random baselines)</text>`,
    ...edges.map((e) => `<path class="e${e.dashed ? " dash" : ""}" d="${e.d}" marker-end="url(#cmap-arrow)"/>` +
      (e.label ? `<text class="el" x="${A + BW / 2 + 8}" y="241">${esc(e.label)}</text>` : "")),
    ...nodes.map((n) => `<a href="${n.href}.html"><rect x="${n.x}" y="${n.y}" width="${BW}" height="${BH}" rx="8" style="stroke:var(--${PART[n.part]})"/>` +
      `<text class="t" x="${n.x + 10}" y="${n.y + 19}">${esc(n.title)}</text><text class="s" x="${n.x + 10}" y="${n.y + 35}">${esc(n.sub)}</text></a>`),
    `</svg>`,
  ].join("");
  $("#concept-map").innerHTML = svg;
}
