import "../layout.js";
import { h, figure, slider, select, button, stats, dataTable } from "../lib/ui.js";
import { NetView } from "../lib/netview.js";
import { Plot } from "../lib/plot.js";
import { RNG } from "../lib/rng.js";
import * as G from "../lib/graph.js";
import { histogram, ccdf, fitPowerLaw, fmt } from "../lib/stats.js";
import { loadClassic, loadNetworks, loadRealGraph, WITH_EDGES } from "../lib/data.js";

const GENERATORS = {
  er: { label: "Random network G(N, p)", params: { N: [500, 10, 20000], k: [4, 0.5, 30, "⟨k⟩"] }, make: (p, r) => G.gnp(p.N, p.k / (p.N - 1), r) },
  ba: { label: "Barabási–Albert", params: { N: [500, 10, 20000], m: [2, 1, 10, "m"] }, make: (p, r) => G.barabasiAlbert(p.N, p.m, r) },
  ws: { label: "Watts–Strogatz", params: { N: [500, 10, 20000], k: [6, 2, 20, "k (even)"], p: [0.05, 0, 1, "rewiring p"] }, make: (p, r) => G.wattsStrogatz(p.N, 2 * Math.round(p.k / 2), p.p, r) },
  cm: { label: "Configuration model, power law", params: { N: [500, 10, 20000], g: [2.5, 2.01, 4, "γ"], kmin: [2, 1, 10, "k_min"] }, make: (p, r) => G.configurationGraph(G.powerlawSequence(p.N, p.g, p.kmin, r), r) },
  hk: { label: "Holme–Kim (BA with triangles)", params: { N: [500, 10, 20000], m: [2, 1, 10, "m"], t: [0.5, 0, 1, "triad probability"] }, make: (p, r) => G.holmeKim(p.N, p.m, p.t, r) },
  geo: { label: "Random geometric", params: { N: [500, 10, 5000], r: [0.08, 0.01, 0.3, "radius"] }, make: (p, r) => G.randomGeometric(p.N, p.r, r).graph },
};

let current = null; // {graph, name}

// ------------------------------------------------------------------ source selection
(async () => {
  const [classic, { networks }] = await Promise.all([loadClassic(), loadNetworks()]);
  const f = figure("#fig-source", { title: "1. Choose a network", sub: "Generate one, load one of the book's or the classic networks, or paste your own edge list." });
  let kind = "generate", gen = "ba", seed = 1;
  const params = {};
  const genCtl = h("div", { class: "btn-row" }), loadCtl = h("div", { class: "btn-row" }), pasteCtl = h("div", { style: { width: "100%" } });
  const status = h("div", { class: "status-line" });
  select(f.controls, { label: "Source", value: kind, options: [{ value: "generate", label: "Generate a model network" }, { value: "load", label: "Load a real network" }, { value: "paste", label: "Paste an edge list" }], onChange: (v) => { kind = v; show(); } });
  f.controls.append(genCtl, loadCtl, pasteCtl, status);
  function show() { genCtl.style.display = kind === "generate" ? "" : "none"; loadCtl.style.display = kind === "load" ? "" : "none"; pasteCtl.style.display = kind === "paste" ? "" : "none"; }
  function genControls() {
    genCtl.replaceChildren();
    select(genCtl, { label: "Model", value: gen, options: Object.entries(GENERATORS).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => { gen = v; genControls(); } });
    for (const [key, [val, lo, hi, label]] of Object.entries(GENERATORS[gen].params)) {
      params[key] = params[key] ?? val;
      if (params[key] < lo || params[key] > hi) params[key] = val;
      slider(genCtl, { label: label || "N", min: lo, max: hi, step: Number.isInteger(val) && hi > 50 ? 1 : (hi - lo) / 200, log: key === "N", value: params[key], format: (v) => (Number.isInteger(val) ? fmt.int(v) : v.toFixed(2)), onInput: (v) => { params[key] = Number.isInteger(val) ? Math.round(v) : v; } });
    }
    button(genCtl, { label: "Generate", icon: "dice", kind: "primary", onClick: () => { const r = new RNG(seed++); const p = {}; for (const k of Object.keys(GENERATORS[gen].params)) p[k] = params[k]; setGraph(GENERATORS[gen].make(p, r), `${GENERATORS[gen].label} (${Object.entries(p).map(([k, v]) => `${k} = ${+(+v).toFixed(3)}`).join(", ")})`); } });
  }
  genControls();
  const opts = [
    { value: "c:karate", label: "Zachary's karate club (34 nodes)" }, { value: "c:florentine", label: "Florentine families (15)" }, { value: "c:lesmis", label: "Les Misérables (77)" },
    ...WITH_EDGES.map((n) => ({ value: "r:" + n, label: `${networks[n].description} (${fmt.int(networks[n].N)})` })),
  ];
  let pick = "c:karate";
  select(loadCtl, { label: "Network", value: pick, options: opts, onChange: (v) => { pick = v; } });
  button(loadCtl, { label: "Load", kind: "primary", onClick: async () => {
    const [t, name] = pick.split(":");
    status.textContent = "Loading…";
    if (t === "c") { const c = classic[name]; setGraph(G.Graph.fromEdges((c.nodes || c.names).length, c.edges.map((e) => [e[0], e[1]])), c.description, c.names); }
    else setGraph(await loadRealGraph(name), networks[name].description);
  } });
  const ta = h("textarea", { rows: 5, style: { width: "100%", fontFamily: "var(--mono)", fontSize: "0.85rem" }, placeholder: "One link per line: two node names separated by a space, comma or tab.\nA B\nB C\nC A\nC D" });
  pasteCtl.append(ta);
  button(pasteCtl, { label: "Use this edge list", kind: "primary", onClick: () => {
    const ids = new Map(), edges = [];
    for (const line of ta.value.split(/\r?\n/)) {
      const parts = line.trim().split(/[\s,;]+/).filter(Boolean);
      if (parts.length < 2 || line.trim().startsWith("#")) continue;
      for (const p of parts.slice(0, 2)) if (!ids.has(p)) ids.set(p, ids.size);
      edges.push([ids.get(parts[0]), ids.get(parts[1])]);
    }
    if (!edges.length) { status.textContent = "No links found."; return; }
    setGraph(G.Graph.fromEdges(ids.size, edges), `your network (${edges.length} lines)`, [...ids.keys()]);
  } });
  show();
  function setGraph(g, name, names = null) { current = { graph: g, name, names }; status.textContent = `Loaded: ${name}.`; analyse(); }
  setGraph(GENERATORS.ba.make({ N: 500, m: 2 }, new RNG(0)), "Barabási–Albert (N = 500, m = 2)");
})();

// ------------------------------------------------------------------ analysis
const out = figure("#fig-analysis", { title: "2. Measure it", sub: "Everything is computed in your browser. Distances use 200 BFS sources for networks with more than 2,000 nodes." });
const tiles = stats(out.body, [
  { key: "N", label: "nodes N" }, { key: "L", label: "links L" }, { key: "k", label: "⟨k⟩" }, { key: "k2", label: "⟨k²⟩" }, { key: "kmax", label: "k_max" },
  { key: "giant", label: "largest component" }, { key: "d", label: "⟨d⟩" }, { key: "diam", label: "diameter" }, { key: "C", label: "⟨C⟩" }, { key: "Ct", label: "C_Δ (global)" },
  { key: "r", label: "assortativity r" }, { key: "pl", label: "power-law fit (CSN)" },
]);
const viewHost = h("div");
out.body.append(viewHost);
const plots = h("div", { class: "fig-body cols-3" });
out.body.append(plots);
const mkPlot = (title, xl, yl) => { const p = h("div", { class: "panel" }, h("div", { class: "panel-title" }, title)); plots.append(p); return new Plot(p, { height: 220, legend: false, x: { type: "log", label: xl }, y: { type: "log", label: yl } }); };
const P1 = mkPlot("Degree distribution P(K ≥ k)", "k", "P(K ≥ k)"), P2 = mkPlot("Clustering C(k)", "k", "C(k)"), P3 = mkPlot("Neighbour degree k_nn(k)", "k", "k_nn(k)");
const rankHost = h("div");
out.body.append(rankHost);
let view = null;

function analyse() {
  const { graph: g, names } = current;
  const n = g.n, s = G.degreeStats(g), comp = G.components(g), cs = G.clusteringSummary(g);
  const rng = new RNG(1);
  const dist = n <= 2000 ? G.distanceStats(G.giantComponent(g).graph) : null;
  const dsamp = dist ? null : G.distanceSample(g, 200, rng);
  const hist = histogram(Array.from(s.degrees).filter((k) => k > 0));
  const fit = hist.k.length > 3 ? fitPowerLaw(hist, { maxCandidates: 150 }) : null;
  tiles.set("N", fmt.int(n)); tiles.set("L", fmt.int(s.m)); tiles.set("k", fmt.fix(s.avg, 2)); tiles.set("k2", fmt.sig(s.k2, 4)); tiles.set("kmax", fmt.int(s.max));
  tiles.set("giant", fmt.pct(comp.giantSize / n, 1), `${fmt.int(comp.count)} component${comp.count === 1 ? "" : "s"}`);
  tiles.set("d", fmt.fix(dist ? dist.avg : dsamp.mean, 2), dist ? "exact, largest component" : "200 sources"); tiles.set("diam", dist ? dist.diameter : `≥ ${dsamp.max}`);
  tiles.set("C", fmt.sig(cs.avg, 3), `random: ${fmt.sig(s.avg / n, 2)}`); tiles.set("Ct", fmt.sig(cs.transitivity, 3)); tiles.set("r", fmt.fix(G.assortativity(g), 3));
  tiles.set("pl", fit ? `γ̂ = ${fit.gamma.toFixed(2)}` : "–", fit ? `k_min = ${fit.kmin}, ${fmt.pct(fit.tailShare, 0)} of nodes` : "");
  P1.update({ series: [{ type: "scatter", data: ccdf(hist), color: 1, label: "data", r: 2.8 }], xName: "k", yFormat: (v) => fmt.sig(v, 3) });
  P2.update({ series: [{ type: "scatter", data: G.clusteringByDegree(g, cs.local).filter((p) => p[1] > 0), color: 1, label: "C(k)", r: 2.8 }], xName: "k", yFormat: (v) => fmt.sig(v, 3) });
  P3.update({ series: [{ type: "scatter", data: G.neighborDegree(g).byDegree, color: 1, label: "k_nn", r: 2.8 }], xName: "k", yFormat: (v) => fmt.sig(v, 3) });
  // drawing and centralities only for networks small enough to read
  viewHost.replaceChildren(); rankHost.replaceChildren();
  if (n <= 2000) {
    const bc = G.betweenness(g), pr = G.pagerank(g), core = G.coreNumbers(g);
    const top = new Set([...Array(n).keys()].sort((a, b) => bc[b] - bc[a]).slice(0, Math.min(5, n)));
    view = new NetView(viewHost, { height: 380, charge: n > 500 ? -14 : -60, linkDistance: n > 500 ? 12 : 30, nodeRadius: (v) => 2 + 1.2 * Math.sqrt(g.degree(v)), nodeColor: (v) => (comp.label[v] === comp.giant ? "s1" : "random"), nodeRing: (v) => (top.has(v) ? "s2" : null), tooltip: (v) => `${names ? names[v] : "node " + v}: k = ${g.degree(v)}, betweenness ${bc[v].toFixed(3)}, core ${core[v]}`, legend: [{ label: "largest component", color: "s1" }, { label: "other components", color: "random" }] });
    view.setGraph(g, { keep: false });
    const cl = G.closeness(g), ev = G.eigenvector(g);
    const rows = [...Array(n).keys()].sort((a, b) => g.degree(b) - g.degree(a)).slice(0, 10).map((v) => [names ? names[v] : v, g.degree(v), bc[v], cl[v], ev[v], pr[v], core[v]]);
    rankHost.append(h("h4", {}, "Ten nodes with the most links"), dataTable([{ label: "node", align: "left" }, { label: "degree" }, { label: "betweenness", format: (v) => v.toFixed(3) }, { label: "closeness", format: (v) => v.toFixed(3) }, { label: "eigenvector", format: (v) => v.toFixed(3) }, { label: "PageRank", format: (v) => v.toFixed(4) }, { label: "k-core" }], rows));
  } else viewHost.append(h("p", { class: "small muted" }, "The drawing and the centrality table are shown for networks of up to 2,000 nodes."));
  const dl = h("a", { class: "btn", download: "network.edgelist.txt", href: URL.createObjectURL(new Blob([g.edges().map(([u, v]) => (names ? `${names[u]} ${names[v]}` : `${u} ${v}`)).join("\n")], { type: "text/plain" })) }, "Download the edge list");
  rankHost.append(h("p", {}, dl));
}
