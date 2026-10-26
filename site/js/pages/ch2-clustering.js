import "../layout.js";
import { h, figure, slider, segmented, select, stats, tex, button, dataTable } from "../lib/ui.js";
import { NetView } from "../lib/netview.js";
import { Plot, fnSeries } from "../lib/plot.js";
import { karateGraph, loadNetworks, NETWORK_ORDER } from "../lib/data.js";
import { clusteringSummary, windmill } from "../lib/graph.js";
import { fmt } from "../lib/stats.js";

const SVGNS = "http://www.w3.org/2000/svg";
const s = (tag, attrs = {}) => { const el = document.createElementNS(SVGNS, tag); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); return el; };

// ------------------------------------------------------------------ 1. one node, four neighbours
{
  const f = figure("#fig-node", { title: "The local clustering coefficient of one node", sub: "The centre has k = 4 neighbours. Click the dashed lines to add links between neighbours.", cols: "split" });
  const pg = f.panel(null), pr = f.panel(null);
  // neighbours on an arc above the centre: no link between neighbours is collinear with a spoke
  const P = [[200, 282], [52, 135], [140, 38], [260, 38], [348, 135]];
  const pairs = [[1, 2], [2, 3], [3, 4], [4, 1], [1, 3], [2, 4]];
  const on = new Set([0]);
  const svg = s("svg", { viewBox: "0 0 400 310", style: "width:100%;max-width:440px;height:auto;display:block;margin:auto" });
  pg.append(svg);
  for (let j = 1; j <= 4; j++) svg.append(s("line", { x1: P[0][0], y1: P[0][1], x2: P[j][0], y2: P[j][1], stroke: "var(--text-2)", "stroke-width": 2, "pointer-events": "none" }));
  const pairEls = pairs.map(([a, b]) => {
    const vis = s("line", { x1: P[a][0], y1: P[a][1], x2: P[b][0], y2: P[b][1], "stroke-linecap": "round", "pointer-events": "none" });
    svg.append(vis);
    return vis;
  });
  P.forEach(([x, y], j) => { svg.append(s("circle", { cx: x, cy: y, r: j ? 13 : 17, fill: j ? "var(--s1)" : "var(--s2)", stroke: "var(--surface)", "stroke-width": 2, "pointer-events": "none" })); });
  // click targets on top of everything
  pairs.forEach(([a, b], i) => {
    const hit = s("line", { x1: P[a][0], y1: P[a][1], x2: P[b][0], y2: P[b][1], stroke: "transparent", "stroke-width": 18, style: "cursor:pointer" });
    hit.addEventListener("click", () => { on.has(i) ? on.delete(i) : on.add(i); render(); });
    svg.append(hit);
  });
  const eq = h("div", { class: "eq" }), t = stats(null, [{ key: "L", label: "links among neighbours Lᵢ" }, { key: "max", label: "possible kᵢ(kᵢ−1)/2" }, { key: "C", label: "Cᵢ" }]);
  pr.append(eq, t.el);
  const row = h("div", { class: "btn-row", style: { marginTop: "10px" } });
  pr.append(row);
  button(row, { label: "Cᵢ = 1", onClick: () => { pairs.forEach((_, i) => on.add(i)); render(); } });
  button(row, { label: "Cᵢ = ½", onClick: () => { on.clear(); [0, 1, 2].forEach((i) => on.add(i)); render(); } });
  button(row, { label: "Cᵢ = 0", onClick: () => { on.clear(); render(); } });
  function render() {
    pairEls.forEach((el, i) => {
      el.setAttribute("stroke", on.has(i) ? "var(--s3)" : "var(--muted)");
      el.setAttribute("stroke-width", on.has(i) ? 3 : 1.5);
      el.setAttribute("stroke-dasharray", on.has(i) ? "" : "5 5");
    });
    const L = on.size;
    tex(eq, `C_i = \\frac{2L_i}{k_i(k_i-1)} = \\frac{2\\cdot ${L}}{4\\cdot 3} = ${fmt.sig(L / 6, 3)}`, true);
    t.set("L", L); t.set("max", 6); t.set("C", fmt.fix(L / 6, 3));
  }
  render();
}

// ------------------------------------------------------------------ 2. karate club
(async () => {
  const { graph: K } = await karateGraph();
  const N = K.n;
  const cs = clusteringSummary(K);
  let sel = 0;
  const f = figure("#fig-karate", { title: "Local clustering in the karate club", sub: "Click a member: its neighbours are blue, the links among them aqua.", cols: "split" });
  const pn = f.panel(null), pr = f.panel(null);
  const nb = () => new Set(K.neighbors(sel));
  const nv = new NetView(pn, {
    height: 400, charge: -90, linkDistance: 40,
    nodeRadius: (v) => (v === sel ? 11 : 4 + 1.5 * Math.sqrt(K.degree(v))),
    nodeColor: (v) => (v === sel ? "s2" : nb().has(v) ? "s1" : "surface-3"),
    edgeColor: (u, v) => { const n = nb(); return n.has(u) && n.has(v) ? "s3" : u === sel || v === sel ? "text-2" : "grid"; },
    edgeWidth: (u, v) => { const n = nb(); return n.has(u) && n.has(v) ? 3 : u === sel || v === sel ? 1.6 : 1; },
    label: (v) => (v === sel ? String(v) : null), labelInside: () => true,
    tooltip: (v) => `member ${v}: k = ${K.degree(v)}, C = ${cs.local[v].toFixed(3)}`,
    onClick: (v) => { sel = v; update(); },
  });
  nv.setGraph(K);
  const eq = h("div", { class: "eq", style: { margin: "0 0 6px" } });
  const t = stats(null, [{ key: "Ci", label: "this member's Cᵢ" }, { key: "avg", label: "⟨C⟩ (average)" }, { key: "glob", label: "C_Δ (global)" }]);
  pr.append(eq, t.el);
  t.set("avg", fmt.fix(cs.avg, 3)); t.set("glob", fmt.fix(cs.transitivity, 3), `${cs.triangleCount} triangles`);
  const plot = new Plot(pr, { height: 220, legend: false, x: { label: "degree kᵢ", min: 0 }, y: { label: "Cᵢ", min: 0, max: 1 } });
  function update() {
    const k = K.degree(sel), Li = cs.triangles[sel];
    tex(eq, k < 2 ? `k_{${sel}} = ${k} < 2:\\; C_{${sel}} = 0` : `C_{${sel}} = \\frac{2\\cdot ${Li}}{${k}\\cdot ${k - 1}} = ${cs.local[sel].toFixed(3)}`, true);
    t.set("Ci", fmt.fix(cs.local[sel], 3), `member ${sel}, k = ${k}`);
    nv.redraw();
    plot.update({
      series: [{ type: "scatter", data: [...Array(N).keys()].map((v) => [K.degree(v), cs.local[v], v]), color: 1, label: "members", tooltip: (d) => `member ${d[2]}: k = ${d[0]}, C = ${d[1].toFixed(3)}`, opacity: 0.85 }],
      annotations: [{ x: K.degree(sel), y: Math.max(cs.local[sel], 0.0001), text: `member ${sel}`, dx: 8, dy: -6, dot: true, color: "s2" }],
      xName: "k",
    });
  }
  update();
})();

// ------------------------------------------------------------------ 3. the windmill graph
{
  let T = 4;
  const f = figure("#fig-windmill", { title: "The windmill graph: ⟨C⟩ → 1 while C_Δ → 0", sub: "t triangles share the centre node.", cols: "split" });
  const pn = f.panel(null), pr = f.panel(null);
  const nv = new NetView(pn, { height: 340, toolbar: false, nodeRadius: (i) => (i === 0 ? 11 : 7), nodeColor: (i) => (i === 0 ? "s2" : "s1"), edgeColor: () => "text-2", edgeWidth: () => 1.6 });
  const t = stats(pr, [{ key: "avg", label: "⟨C⟩" }, { key: "glob", label: "C_Δ" }, { key: "c0", label: "C of the centre" }]);
  const plot = new Plot(pr, { height: 230, x: { label: "number of triangles t", min: 1, max: 20 }, y: { label: "clustering", min: 0, max: 1 } });
  const avgTh = (t2) => (2 * t2 + 1 / (2 * t2 - 1)) / (2 * t2 + 1);
  const globTh = (t2) => 3 / (2 * t2 + 1);
  function update() {
    const g = windmill(T);
    const pos = [[0, 0]];
    for (let i = 0; i < T; i++) {
      const a = (2 * Math.PI * i) / T, w = Math.min(0.5, Math.PI / T) * 0.8;
      pos.push([100 * Math.cos(a - w), 100 * Math.sin(a - w)], [100 * Math.cos(a + w), 100 * Math.sin(a + w)]);
    }
    nv.setGraph(g, { positions: pos });
    const c = clusteringSummary(g);
    t.set("avg", fmt.fix(c.avg, 3)); t.set("glob", fmt.fix(c.transitivity, 3)); t.set("c0", fmt.fix(c.local[0], 3), `k = ${2 * T}`);
    plot.update({
      series: [
        fnSeries(avgTh, 1, 20, 120, { color: 1, label: "⟨C⟩ = (2t + 1/(2t−1)) / (2t+1)" }),
        fnSeries(globTh, 1, 20, 120, { color: 2, label: "C_Δ = 3 / (2t+1)" }),
      ],
      annotations: [{ x: T, y: c.avg, text: "", dot: true, color: "s1" }, { x: T, y: c.transitivity, text: "", dot: true, color: "s2" }],
      xName: "t", yFormat: (v) => fmt.fix(v, 3),
    });
  }
  slider(f.controls, { label: "triangles t", min: 1, max: 20, step: 1, value: T, onInput: (v) => { T = v; update(); }, wide: true });
  update();
  f.setCaption("Each of the $2t$ outer nodes has $C_i = 1$; the centre, with $k = 2t$, has $C = 1/(2t-1)$. Of the $t(2t-1) + 2t$ connected triples, only $3t$ lie in triangles, so $C_\\Delta = 3/(2t+1)$.");
}

// ------------------------------------------------------------------ 4. real networks
(async () => {
  const { networks } = await loadNetworks();
  let name = "collaboration", conv = "zero";
  const f = figure("#fig-real", { title: "Clustering in the eight networks", sub: "Average ⟨C⟩, global C_Δ, and clustering as a function of degree." });
  const tableHost = h("div");
  f.body.append(tableHost);
  const plot = new Plot(f.body, { height: 280, x: { type: "log", label: "degree k" }, y: { type: "log", label: "C(k): average Cᵢ of nodes with degree k" } });
  function render() {
    const rows = NETWORK_ORDER.map((n) => {
      const d = networks[n];
      let low = 0;
      d.degreeHist.k.forEach((k, i) => { if (k < 2) low += d.degreeHist.count[i]; });
      const excl = (d.clustering.avg * d.N) / (d.N - low);
      return [d.description, conv === "zero" ? d.clustering.avg : excl, d.clustering.transitivity, low / d.N];
    });
    tableHost.replaceChildren(dataTable([
      { label: "Network", align: "left" }, { label: conv === "zero" ? "⟨C⟩ (Cᵢ = 0 for k ≤ 1)" : "⟨C⟩ over nodes with k ≥ 2", format: (v) => fmt.fix(v, 3) },
      { label: "C_Δ", format: (v) => fmt.fix(v, 3) }, { label: "share of nodes with k ≤ 1", format: (v) => fmt.pct(v) },
    ], rows, { highlight: (r) => r[0] === networks[name].description }));
    const d = networks[name];
    const ck = d.clustering.byDegree;
    plot.update({
      series: [{ type: "scatter", data: ck.k.map((k, i) => [k, ck.C[i], ck.n[i]]).filter((p) => p[1] > 0), color: 1, label: d.description, tooltip: (p) => `k = ${p[0]}: C(k) = ${p[1].toFixed(4)} (${p[2]} nodes)` }],
      rules: [{ y: d.avgk / d.N, label: "random network: ⟨k⟩/N", dashed: true, color: "theory" }],
      xName: "k", forceLegend: true,
    });
  }
  segmented(f.controls, {
    label: "Nodes with k ≤ 1", value: "zero", options: [{ value: "zero", label: "count as Cᵢ = 0 (book, NetworkX)" }, { value: "exclude", label: "leave out" }],
    onChange: (v) => { conv = v; render(); },
  });
  select(f.controls, { label: "C(k) for", value: name, options: NETWORK_ORDER.map((n) => ({ value: n, label: networks[n].description })), onChange: (v) => { name = v; render(); } });
  render();
  f.setCaption("The convention matters most where many nodes have a single link: 76% of the email network's nodes, 52% of the protein network's and 50% of the WWW's have k ≤ 1. Leaving them out multiplies ⟨C⟩ by 2 to 4 (email 0.036 → 0.148). Always state the convention. The dashed line in the C(k) plot is the random-network value ⟨k⟩/N, orders of magnitude lower (Chapter 3).");
})();
