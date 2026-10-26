import "../layout.js";
import { h, figure, button, select, stats, tooltip, ICONS } from "../lib/ui.js";
import { NetView } from "../lib/netview.js";
import { MatrixView } from "../lib/matrixview.js";
import { Plot } from "../lib/plot.js";
import { karateGraph, loadNetworks, NETWORK_ORDER } from "../lib/data.js";
import { bfs, bfsLayers, allShortestPaths, distanceStats, distanceMatrix } from "../lib/graph.js";
import { fmt } from "../lib/stats.js";

const tip = tooltip();
const RAMP = ["blue-1", "blue-2", "blue-3", "blue-4", "blue-5", "blue-6"];
const distColor = (d) => (d === 0 ? "s2" : RAMP[Math.min(5, d - 1)]);
const ready = karateGraph();

// ------------------------------------------------------------------ 1. BFS step by step
(async () => {
  const { graph: K } = await ready;
  const N = K.n;
  let source = 0, layers = [], shown = 0, timer = null;
  const f = figure("#fig-bfs", { title: "Breadth-first search on the karate club", sub: "Click a member to make it the source, then step through the search.", cols: "split" });
  const pn = f.panel(null), pr = f.panel(null);
  const dist = () => { const d = new Int32Array(N).fill(-1); layers.slice(0, shown).forEach((L, i) => L.forEach((v) => { d[v] = i; })); return d; };
  let D = dist();
  const nv = new NetView(pn, {
    height: 400, charge: -90, linkDistance: 40,
    nodeRadius: (v) => (v === source ? 11 : 8),
    nodeColor: (v) => (D[v] >= 0 ? distColor(D[v]) : "surface-3"),
    nodeRing: (v) => (shown > 0 && shown <= layers.length && layers[shown - 1].includes(v) ? "text" : null),
    edgeColor: (u, v) => (D[u] >= 0 && D[v] >= 0 && Math.abs(D[u] - D[v]) === 1 ? "text-2" : "axis"),
    edgeWidth: (u, v) => (D[u] >= 0 && D[v] >= 0 && Math.abs(D[u] - D[v]) === 1 ? 1.8 : 1),
    label: (v) => (D[v] >= 0 ? String(D[v]) : null), labelInside: () => true,
    labelColor: (v) => (D[v] >= 3 || D[v] === 0 ? "surface" : "text"),
    tooltip: (v) => `member ${v}${D[v] >= 0 ? ` · distance ${D[v]} from ${source}` : " · not reached yet"}`,
    onClick: (v) => { source = v; reset(); },
  });
  nv.setGraph(K);
  const t = stats(pr, [{ key: "layer", label: "current layer d" }, { key: "found", label: "nodes reached" }, { key: "ecc", label: "farthest node" }]);
  const queue = h("div", { class: "small", style: { margin: "10px 0", lineHeight: 1.7 } });
  pr.append(queue);
  const plot = new Plot(pr, { height: 180, legend: false, x: { label: "distance d from the source", integer: true }, y: { label: "nodes" } });
  function render() {
    D = dist();
    nv.redraw();
    const found = layers.slice(0, shown).reduce((s, L) => s + L.length, 0);
    t.set("layer", shown ? shown - 1 : "–");
    t.set("found", `${found} / ${N}`);
    t.set("ecc", shown >= layers.length ? `d = ${layers.length - 1}` : "…", shown >= layers.length ? `eccentricity of ${source}` : "search running");
    queue.replaceChildren(...layers.slice(0, shown).map((L, i) => h("div", {}, h("span", { class: "swatch", style: { background: `var(--${distColor(i)})`, marginRight: "6px" } }), h("strong", {}, `d = ${i}: `), L.join(", "))),
      shown < layers.length ? h("div", { class: "muted" }, `Next: the unlabelled neighbours of the d = ${shown - 1} nodes.`) : h("div", { class: "muted" }, "Done: every node has its distance."));
    plot.update({ series: [{ type: "bar", data: layers.slice(0, shown).map((L, i) => [i, L.length]), color: 1, label: "nodes at distance d" }], xName: "d", x: { min: -0.5, max: Math.max(5, layers.length - 1) + 0.5 } });
  }
  function reset() { stop(); layers = bfsLayers(K, source); shown = 1; render(); }
  function step() { if (shown < layers.length) { shown++; render(); } else stop(); }
  function stop() { if (timer) { clearInterval(timer); timer = null; playBtn.innerHTML = ICONS.play + " Play"; } }
  const row = h("div", { class: "btn-row" });
  f.controls.append(row);
  button(row, { label: "Step", icon: "step", onClick: () => { stop(); step(); } });
  const playBtn = button(row, { label: "Play", icon: "play", onClick: () => { if (timer) stop(); else { if (shown >= layers.length) reset(); timer = setInterval(step, 800); playBtn.innerHTML = ICONS.pause + " Pause"; } } });
  button(row, { label: "Reset", icon: "reset", onClick: reset });
  reset();
  f.setCaption("Colour shows the distance from the source (orange), darker blue being further away. Highlighted links join consecutive layers. Together they form a shortest-path tree.");
})();

// ------------------------------------------------------------------ 2. shortest paths between two nodes
(async () => {
  const { graph: K } = await ready;
  const N = K.n;
  let s = 14, t = 16, res = null, edgeSet = new Set(), turn = 0;
  const f = figure("#fig-sp", { title: "Every shortest path between two members", sub: "Pick a source and a target, or click two members in the network.", cols: "split" });
  const pn = f.panel(null), pr = f.panel(null);
  const opts = [...Array(N).keys()].map((v) => ({ value: String(v), label: String(v) }));
  const ss = select(f.controls, { label: "from", value: "14", options: opts, onChange: (v) => { s = +v; update(); } });
  const st = select(f.controls, { label: "to", value: "16", options: opts, onChange: (v) => { t = +v; update(); } });
  button(f.controls, { label: "The two furthest apart (14 → 16)", onClick: () => { s = 14; t = 16; ss.value = "14"; st.value = "16"; update(); } });
  const key = (u, v) => Math.min(u, v) + "," + Math.max(u, v);
  const onPath = new Set();
  const nv = new NetView(pn, {
    height: 400, charge: -90, linkDistance: 40,
    nodeRadius: (v) => (v === s || v === t ? 11 : onPath.has(v) ? 8 : 5.5),
    nodeColor: (v) => (v === s ? "s3" : v === t ? "s2" : onPath.has(v) ? "s1" : "random"),
    edgeColor: (u, v) => (edgeSet.has(key(u, v)) ? "s1" : "axis"),
    edgeWidth: (u, v) => (edgeSet.has(key(u, v)) ? 3 : 1),
    label: (v) => (v === s || v === t || onPath.has(v) ? String(v) : null), labelInside: () => true,
    onClick: (v) => { if (turn === 0) { s = v; ss.value = String(v); } else { t = v; st.value = String(v); } turn = 1 - turn; update(); },
    tooltip: (v) => `member ${v}`,
    legend: [{ label: "source", color: "s3" }, { label: "target", color: "s2" }, { label: "on a shortest path", color: "s1" }],
  });
  nv.setGraph(K);
  const out = h("div");
  pr.append(out);
  function update() {
    res = allShortestPaths(K, s, t, 60);
    edgeSet = new Set(); onPath.clear();
    for (const p of res.paths) { p.forEach((v) => onPath.add(v)); for (let i = 1; i < p.length; i++) edgeSet.add(key(p[i - 1], p[i])); }
    nv.redraw();
    const d = bfs(K, s).dist[t];
    const via = [...onPath].filter((v) => v !== s && v !== t && res.paths.every((p) => p.includes(v)));
    const tiles = stats(null, [{ key: "d", label: "distance" }, { key: "n", label: "shortest paths" }, { key: "via", label: "nodes on every shortest path" }]);
    tiles.set("d", s === t ? "0" : d < 0 ? "∞" : d);
    tiles.set("n", fmt.int(res.count));
    tiles.set("via", via.length ? (via.length === 1 ? `node ${via[0]}` : `nodes ${via.join(", ")}`) : "none");
    const list = h("div", { class: "small", style: { marginTop: "10px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: "2px 16px", fontVariantNumeric: "tabular-nums" } },
      res.paths.slice(0, 20).map((p, i) => h("div", {}, h("span", { class: "muted" }, `${i + 1}. `), p.join(" → "))));
    out.replaceChildren(tiles.el, list, ...(res.count > 20 ? [h("p", { class: "small muted" }, `… and ${res.count - 20} more.`)] : []));
  }
  update();
})();

// ------------------------------------------------------------------ 3. distance matrix + distribution
(async () => {
  const { graph: K } = await ready;
  const N = K.n;
  const Dm = distanceMatrix(K);
  const ds = distanceStats(K);
  const f = figure("#fig-dmatrix", { title: "The karate club's distance matrix", sub: "Entry (i, j) is the distance dᵢⱼ. Hover for values.", cols: "cols-2" });
  const pm = f.panel(null), pd = f.panel(null);
  new MatrixView(pm, {
    rows: N, cols: N, maxSize: 380, gridLines: false,
    cell: (i, j) => (i === j ? null : RAMP[Math.min(5, Dm[i][j] - 1)]),
    onHover: (i, j, ev) => { if (i == null) return tip.hide(); tip.show(ev.clientX, ev.clientY, h("div", {}, h("b", {}, `d = ${Dm[i][j]}`), ` between ${i} and ${j}`)); },
  });
  const t = stats(pd, [{ key: "dmax", label: "diameter d_max" }, { key: "avg", label: "average distance ⟨d⟩" }, { key: "pairs", label: "pairs" }]);
  t.set("dmax", ds.diameter); t.set("avg", fmt.fix(ds.avg, 3)); t.set("pairs", fmt.int(ds.pairs));
  const plot = new Plot(pd, { height: 230, legend: true, x: { label: "distance d", integer: true }, y: { label: "share of pairs p_d" } });
  const tot = ds.counts.reduce((a, b) => a + b, 0);
  plot.update({
    series: [{ type: "bar", data: ds.counts.map((c, d) => [d, c / tot]).filter((x) => x[0] > 0), color: 1, label: "karate club", format: (v) => fmt.pct(v) }],
    rules: [{ x: ds.avg, label: `⟨d⟩ = ${ds.avg.toFixed(2)}`, dashed: true }], xName: "d",
  });
  const RAMP_LEG = h("div", { class: "legend", style: { marginTop: "6px" } }, ...[1, 2, 3, 4, 5].map((d) => h("span", { class: "legend-item" }, h("span", { class: "swatch", style: { background: `var(--${RAMP[d - 1]})` } }), `d = ${d}`)));
  pm.append(RAMP_LEG);
})();

// ------------------------------------------------------------------ 4. real networks
(async () => {
  const { networks } = await loadNetworks();
  let name = "collaboration";
  const f = figure("#fig-real", { title: "Distance distributions of the book's networks", sub: "BFS from 300 random sources in the giant component (as in the notebook)." });
  const t = stats(f.body, [{ key: "avg", label: "average distance ⟨d⟩" }, { key: "six", label: "pairs within 6 steps" }, { key: "max", label: "largest observed" }, { key: "er", label: "random network: ln N / ln ⟨k⟩" }]);
  const plot = new Plot(f.body, { height: 280, legend: true, x: { label: "distance d", integer: true, min: 0 }, y: { label: "share of pairs p_d" } });
  function show() {
    const d = networks[name];
    const c = d.distances.count;
    const tot = c.reduce((a, b) => a + b, 0);
    const within6 = c.slice(0, 7).reduce((a, b) => a + b, 0) / tot;
    const er = Math.log(d.N) / Math.log(d.avgk);
    t.set("avg", fmt.fix(d.distances.avg, 2)); t.set("six", fmt.pct(within6)); t.set("max", d.distances.maxObserved); t.set("er", fmt.fix(er, 2));
    plot.update({
      series: [{ type: "bar", data: c.map((x, k) => [k, x / tot]).filter((p) => p[0] > 0 && p[1] > 0), color: 1, label: d.description, format: (v) => fmt.pct(v, 2), maxWidth: 18 }],
      rules: [{ x: d.distances.avg, label: `⟨d⟩ = ${d.distances.avg.toFixed(2)}`, dashed: true }, { x: er, label: "ln N / ln⟨k⟩", align: "left", labelY: 26, color: "random" }],
      xName: "d", forceLegend: true,
    });
  }
  select(f.controls, { label: "Network", value: name, options: NETWORK_ORDER.map((n) => ({ value: n, label: networks[n].description })), onChange: (v) => { name = v; show(); } });
  show();
})();
