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
  "Part IV · Synthesis & beyond": "So what? Hubs, robustness, spreading.",
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
