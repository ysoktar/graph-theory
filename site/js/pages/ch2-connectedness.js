import "../layout.js";
import { h, figure, button, select, stats, slider } from "../lib/ui.js";
import { NetView } from "../lib/netview.js";
import { MatrixView } from "../lib/matrixview.js";
import { Plot } from "../lib/plot.js";
import { loadNetworks, loadRealGraph, NETWORK_ORDER, SHORT } from "../lib/data.js";
import { Graph, components, bridgesAndCutNodes, UnionFind } from "../lib/graph.js";
import { RNG } from "../lib/rng.js";
import { fmt } from "../lib/stats.js";

// ------------------------------------------------------------------ 1. cut links
{
  const EDGES = [
    // cluster A
    [0, 1], [0, 2], [1, 2], [1, 3], [2, 3], [3, 4], [2, 4], [0, 5], [5, 1],
    // articulation node 6 joins A and B
    [4, 6], [6, 7],
    // cluster B
    [7, 8], [7, 9], [8, 9], [8, 10], [9, 10], [10, 11], [11, 7],
    // a dangling chain off B
    [11, 12], [12, 13],
    // a separate small component, and an isolated node (17)
    [14, 15], [15, 16], [14, 16],
  ];
  const N = 18;
  let g;
  const PALETTE = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"];
  let nodeColor = new Array(N).fill(null), comp = null, cut = { bridges: [], cutNodes: [] }, order = [];
  const rng = new RNG(5);
  const f = figure("#fig-cut", { title: "Components, bridges and articulation points", sub: "Click a link to cut it.", cols: "split" });
  const pn = f.panel(null), pm = f.panel("Adjacency matrix, nodes ordered by component");
  const key = (u, v) => Math.min(u, v) + "," + Math.max(u, v);
  let bridgeSet = new Set();
  const nv = new NetView(pn, {
    height: 380, charge: -120, linkDistance: 34, gravity: 0.12,
    nodeRadius: () => 9, nodeColor: (i) => nodeColor[i] || "muted",
    nodeRing: (i) => (cut.cutNodes.includes(i) ? "text" : null),
    edgeColor: (u, v) => (bridgeSet.has(key(u, v)) ? "text" : "axis"),
    edgeWidth: (u, v) => (bridgeSet.has(key(u, v)) ? 3.5 : 1.6),
    label: (i) => String(i), labelInside: () => true, labelSize: 9.5,
    onEdgeClick: (e, [u, v]) => { g.removeEdge(u, v); update(); },
    tooltip: (i) => `node ${i} · component of ${comp.sizes[comp.label[i]]} node${comp.sizes[comp.label[i]] > 1 ? "s" : ""}${cut.cutNodes.includes(i) ? " · articulation point" : ""}`,
    legend: [{ label: "ringed: articulation point", color: "text" }],
  });
  const mv = new MatrixView(pm, {
    rows: N, cols: N, maxSize: 300, labels: true, rowLabel: (i) => order[i], colLabel: (j) => order[j],
    cell: (i, j) => (g.hasEdge(order[i], order[j]) ? nodeColor[order[i]] : null),
  });
  const tiles = stats(pm, [{ key: "c", label: "components" }, { key: "sizes", label: "sizes" }, { key: "b", label: "bridges" }, { key: "a", label: "articulation points" }]);
  function recolor() {
    // colours follow the nodes: each component keeps the colour most of its nodes had
    const groups = comp.sizes.map((_, c) => ({ c, nodes: [] }));
    for (let i = 0; i < N; i++) groups[comp.label[i]].nodes.push(i);
    groups.sort((a, b) => b.nodes.length - a.nodes.length);
    const used = new Set(), next = new Array(N);
    for (const gr of groups) {
      if (gr.nodes.length === 1) { next[gr.nodes[0]] = null; continue; }
      const votes = new Map();
      for (const i of gr.nodes) if (nodeColor[i]) votes.set(nodeColor[i], (votes.get(nodeColor[i]) || 0) + 1);
      let col = [...votes.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c).find((c) => !used.has(c));
      if (!col) col = PALETTE.find((c) => !used.has(c)) || "muted";
      used.add(col);
      for (const i of gr.nodes) next[i] = col;
    }
    nodeColor = next;
  }
  function update() {
    comp = components(g);
    recolor();
    cut = bridgesAndCutNodes(g);
    bridgeSet = new Set(cut.bridges.map(([u, v]) => key(u, v)));
    order = [...Array(N).keys()].sort((a, b) => (comp.sizes[comp.label[b]] - comp.sizes[comp.label[a]]) || (comp.label[a] - comp.label[b]) || a - b);
    nv.setGraph(g, { keep: true, alpha: 0.25 });
    mv.redraw();
    tiles.set("c", comp.count);
    tiles.set("sizes", comp.sorted.join(", "));
    tiles.set("b", cut.bridges.length);
    tiles.set("a", cut.cutNodes.length ? cut.cutNodes.sort((a, b) => a - b).join(", ") : "none");
  }
  function reset() { g = Graph.fromEdges(N, EDGES); nodeColor = new Array(N).fill(null); update(); }
  const row = h("div", { class: "btn-row" });
  f.controls.append(row);
  button(row, { label: "Restore all links", icon: "reset", onClick: reset });
  button(row, { label: "Add a random link", icon: "dice", onClick: () => { for (let t = 0; t < 100; t++) { const u = rng.int(N), v = rng.int(N); if (g.addEdge(u, v)) break; } update(); } });
  reset();
  f.setCaption("Thick dark links are bridges; ringed nodes are articulation points; single, unlinked nodes are grey. Colours stay with the nodes when a component splits, so the larger piece keeps its colour.");
}

// ------------------------------------------------------------------ 2. component sizes in real networks
(async () => {
  const { networks } = await loadNetworks();
  let name = "collaboration";
  const f = figure("#fig-sizes", { title: "Component sizes", sub: "How many components of each size? Logarithmic axes." });
  const tiles = stats(f.body, [{ key: "n", label: "components" }, { key: "g", label: "giant component" }, { key: "s", label: "second largest" }, { key: "o", label: "nodes outside the giant" }]);
  const plot = new Plot(f.body, { height: 280, x: { type: "log", label: "component size s (nodes)" }, y: { type: "log", label: "number of components" } });
  function show() {
    const d = networks[name], c = d.components;
    const sizes = c.sizes, counts = c.sizeCount;
    const second = sizes.length > 1 ? (counts[counts.length - 1] > 1 ? sizes[sizes.length - 1] : sizes[sizes.length - 2]) : 0;
    tiles.set("n", fmt.int(c.count)); tiles.set("g", fmt.int(c.giant), fmt.pct(c.giantFraction)); tiles.set("s", fmt.int(second)); tiles.set("o", fmt.int(d.N - c.giant));
    plot.update({
      series: [{ type: "scatter", data: sizes.map((s, i) => [s, counts[i]]), color: 1, label: d.description, r: 5, format: (v) => `${fmt.int(v)} component${v > 1 ? "s" : ""}` }],
      xName: "size", forceLegend: false,
    });
  }
  select(f.controls, { label: "Network", value: name, options: NETWORK_ORDER.map((n) => ({ value: n, label: networks[n].description })), onChange: (v) => { name = v; show(); } });
  show();
})();

// ------------------------------------------------------------------ 3. random link removal on real networks
(async () => {
  const { networks } = await loadNetworks();
  const NAMES = ["collaboration", "email", "protein", "powergrid"];
  const f = figure("#fig-percolation", { title: "Largest component as links are removed at random", sub: "Each curve: the book's network, links kept in random order (computed in your browser)." });
  const tiles = stats(f.body, NAMES.map((n) => ({ key: n, label: networks[n].description })));
  const plot = new Plot(f.body, { height: 300, x: { label: "fraction of links kept", min: 0, max: 1 }, y: { label: "largest component / N", min: 0, max: 1 } });
  const curves = {};
  let q = 0.2;
  const pcs = Object.fromEntries(NAMES.map((n) => [n, networks[n].avgk / (networks[n].k2 - networks[n].avgk)]));
  for (const [i, name] of NAMES.entries()) {
    const g = await loadRealGraph(name);
    const edges = g.edges();
    new RNG(11 + i).shuffle(edges);
    const uf = new UnionFind(g.n);
    const pts = [[0, 1 / g.n]];
    const steps = 200;
    let e = 0;
    for (let s = 1; s <= steps; s++) {
      const target = Math.round((edges.length * s) / steps);
      while (e < target) { uf.union(edges[e][0], edges[e][1]); e++; }
      pts.push([s / steps, uf.largest / g.n]);
    }
    curves[name] = pts;
  }
  function draw() {
    for (const n of NAMES) {
      const pt = curves[n].reduce((best, p) => (Math.abs(p[0] - q) < Math.abs(best[0] - q) ? p : best));
      tiles.set(n, fmt.pct(pt[1]), `p_c = ${+pcs[n].toPrecision(2)}`);
    }
    plot.update({
      series: NAMES.map((n, i) => ({ id: n, type: "line", data: curves[n], color: i + 1, label: SHORT[n] })),
      rules: [{ x: q, label: `${Math.round(q * 100)}% kept` }, ...NAMES.map((n, i) => ({ x: pcs[n], dashed: true, color: i + 1, excludeFromDomain: true }))],
      xName: "fraction kept", yFormat: (v) => fmt.pct(v),
    });
  }
  slider(f.controls, { label: "fraction of links kept", min: 0.02, max: 1, step: 0.01, value: q, format: (v) => fmt.pct(v, 0), onInput: (v) => { q = v; draw(); }, wide: true });
  draw();
  f.setCaption("Dashed lines: the Molloy–Reed threshold $p_c = \\langle k\\rangle/(\\langle k^2\\rangle - \\langle k\\rangle)$ for each network's degrees. It is exact for a random network with the same degree sequence (configuration model). Real networks deviate from it: clustering wastes links on redundant triangles, while geography and degree correlations shape the paths.");
})();
