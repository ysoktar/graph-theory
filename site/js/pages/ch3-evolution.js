import "../layout.js";
import { h, figure, slider, button, stats, dataTable, ICONS } from "../lib/ui.js";
import { NetView } from "../lib/netview.js";
import { Plot, fnSeries } from "../lib/plot.js";
import { RNG } from "../lib/rng.js";
import { Graph, UnionFind, edgeKey, components, gnp } from "../lib/graph.js";
import { giantComponentFraction, fmt } from "../lib/stats.js";
import { loadNetworks, NETWORK_ORDER, SHORT } from "../lib/data.js";
import { run } from "../lib/compute.js";

const regime = (k, N) => (k < 0.995 ? "subcritical" : k <= 1.005 ? "critical" : k < Math.log(N) ? "supercritical" : "connected");

// ------------------------------------------------------------------ 1. watch the giant component form
{
  let N = 500, k = 0, order = [], timer = null, seed = 1;
  const kMax = 8;
  const f = figure("#fig-evolve", { title: "Adding random links one at a time", sub: "Drag ⟨k⟩ or press Play. The largest component is blue; everything else is grey.", cols: "split" });
  const pn = f.panel(null), pr = f.panel(null);
  let giantLabel = -1, comp = null;
  const nv = new NetView(pn, {
    height: 430, charge: -9, linkDistance: 10, gravity: 0.12, toolbar: true,
    nodeRadius: (i) => (comp && comp.label[i] === giantLabel ? 3.6 : 2.8),
    nodeColor: (i) => (comp && comp.label[i] === giantLabel && comp.giantSize > 1 ? "s1" : "random"),
    edgeColor: (u) => (comp && comp.label[u] === giantLabel ? "blue-2" : "axis"), edgeWidth: () => 1,
    ringWidth: 0.8,
  });
  const t = stats(pr, [
    { key: "k", label: "⟨k⟩ = 2L/N" }, { key: "L", label: "links L" }, { key: "S", label: "largest component N_G/N" },
    { key: "S2", label: "second largest" }, { key: "c", label: "components" }, { key: "r", label: "regime" },
  ]);
  t.el.style.gridTemplateColumns = "repeat(auto-fit, minmax(150px, 1fr))"; // no empty tracks, so long labels get room
  const plot = new Plot(pr, { height: 240, x: { label: "average degree ⟨k⟩", min: 0, max: kMax }, y: { label: "N_G / N", min: 0, max: 1 } });
  let traj = [];
  function ensureOrder(L) {
    // a fixed random sequence of distinct pairs: scrubbing ⟨k⟩ back and forth shows the same history
    const rng = ensureOrder.rng;
    const seen = ensureOrder.seen;
    while (order.length < L) {
      const u = rng.int(N), v = rng.int(N);
      if (u === v) continue;
      const key = edgeKey(u, v);
      if (seen.has(key)) continue;
      seen.add(key);
      order.push([u, v]);
    }
  }
  function resetSequence() {
    order = []; ensureOrder.rng = new RNG(seed); ensureOrder.seen = new Set();
    const Lmax = Math.round((kMax * N) / 2);
    ensureOrder(Lmax);
    // trajectory of the largest component along this sequence
    const uf = new UnionFind(N);
    traj = [[0, 1 / N]];
    let e = 0;
    for (let s = 1; s <= 320; s++) {
      const target = Math.round((((kMax * s) / 320) * N) / 2);
      while (e < target) { uf.union(order[e][0], order[e][1]); e++; }
      traj.push([(2 * e) / N, uf.largest / N]);
    }
  }
  function update(relayout = false) {
    const L = Math.round((k * N) / 2);
    const g = Graph.fromEdges(N, order.slice(0, L));
    comp = components(g);
    giantLabel = comp.giant;
    nv.setGraph(g, { keep: !relayout, alpha: relayout ? 1 : 0.18 });
    const S = comp.giantSize / N;
    t.set("k", fmt.fix((2 * L) / N, 2)); t.set("L", fmt.int(L)); t.set("S", fmt.pct(S));
    t.set("S2", comp.second, "nodes"); t.set("c", fmt.int(comp.count)); t.set("r", regime(k, N), `ln N = ${Math.log(N).toFixed(1)}`);
    const lnN = Math.log(N);
    plot.update({
      series: [
        fnSeries(giantComponentFraction, 0, kMax, 300, { color: "theory", dashed: true, label: "theory: S = 1 − exp(−⟨k⟩S)" }),
        { id: "traj", type: "line", data: traj.filter((p) => p[0] <= k + 1e-9), color: 1, label: `this network (N = ${N})` },
      ],
      bands: [{ x0: 0, x1: 1 }, { x0: lnN, x1: kMax, label: "connected", opacity: 0.04 }],
      rules: [{ x: 1, label: "⟨k⟩ = 1" }, { x: lnN, label: "ln N", labelY: 26 }],
      annotations: [{ x: (2 * L) / N, y: Math.max(S, 0.002), text: "", dot: true, color: "s1" }],
      xName: "⟨k⟩", yFormat: (v) => fmt.pct(v),
    });
  }
  function stop() { if (timer) { clearInterval(timer); timer = null; playBtn.innerHTML = ICONS.play + " Play"; } }
  const sk = slider(f.controls, { label: "average degree ⟨k⟩", min: 0, max: kMax, step: 0.02, value: k, format: (v) => v.toFixed(2), onInput: (v) => { stop(); k = v; update(); }, wide: true });
  slider(f.controls, { label: "nodes N", min: 100, max: 1500, step: 50, value: N, onChange: (v) => { stop(); N = v; resetSequence(); update(true); } });
  const row = h("div", { class: "btn-row" });
  f.controls.append(row);
  const playBtn = button(row, {
    label: "Play", icon: "play",
    onClick: () => {
      if (timer) { stop(); return; }
      if (k >= kMax - 0.01) k = 0;
      timer = setInterval(() => { k = Math.min(kMax, k + (k < 1.6 ? 0.02 : 0.05)); sk.value = k; update(); if (k >= kMax) stop(); }, 60);
      playBtn.innerHTML = ICONS.pause + " Pause";
    },
  });
  button(row, { label: "New random sequence", icon: "dice", onClick: () => { stop(); seed++; resetSequence(); update(true); } });
  resetSequence();
  update(true);
}

// ------------------------------------------------------------------ 2. four snapshots (notebook cell 36)
{
  const N = 300;
  const f = figure("#fig-snapshots", { title: "Four snapshots, N = 300", sub: "Largest component in blue (the notebook's figure, regenerated in your browser).", cols: "cols-4" });
  const cases = [[0.5, "subcritical"], [1, "critical"], [2.5, "supercritical"], [Math.log(N), "connected (⟨k⟩ = ln N)"]];
  for (const [k, label] of cases) {
    const panel = f.panel("");
    const g = gnp(N, k / (N - 1), new RNG(7));
    const c = components(g);
    panel.querySelector(".panel-title").textContent = `${label}: ⟨k⟩ = ${k.toFixed(2)}, N_G/N = ${(c.giantSize / N).toFixed(2)}`;
    new NetView(panel, {
      height: 220, toolbar: false, charge: -7, linkDistance: 9, gravity: 0.15,
      nodeRadius: () => 2.6, nodeColor: (i) => (c.label[i] === c.giant ? "s1" : "random"), edgeColor: () => "axis", ringWidth: 0.6,
    }).setGraph(g);
  }
  f.setCaption("At ⟨k⟩ = ln N ≈ 5.7 a random network of 300 nodes is usually connected, but not always: a handful of isolated nodes is common right at the threshold.");
}

// ------------------------------------------------------------------ 3. graphical solution of S = 1 − e^{−⟨k⟩S}
{
  let k = 1.8;
  const f = figure("#fig-fixed", { title: "Solving S = 1 − exp(−⟨k⟩S) graphically", sub: "The solution is where the curve crosses the diagonal. The staircase shows the iteration S ← 1 − exp(−⟨k⟩S) starting from S = 1." });
  const t = stats(f.body, [{ key: "S", label: "solution S" }, { key: "slope", label: "slope of the curve at S = 0" }, { key: "steps", label: "iterations to converge" }]);
  t.el.style.gridTemplateColumns = "repeat(auto-fit, minmax(150px, 1fr))";
  const plot = new Plot(f.body, { height: 320, x: { label: "S", min: 0, max: 1 }, y: { label: "1 − exp(−⟨k⟩S)", min: 0, max: 1 } });
  function draw() {
    const S = giantComponentFraction(k);
    const stair = [];
    let x = 1, n = 0;
    stair.push([x, 0]);
    for (; n < 60; n++) {
      const y = 1 - Math.exp(-k * x);
      stair.push([x, y], [y, y]);
      if (Math.abs(y - x) < 1e-4) break;
      x = y;
    }
    t.set("S", fmt.fix(S, 4)); t.set("slope", fmt.fix(k, 2), k > 1 ? "> 1: a giant component exists" : "≤ 1: only S = 0"); t.set("steps", n + 1);
    plot.update({
      series: [
        fnSeries((s) => s, 0, 1, 2, { color: "theory", dashed: true, label: "diagonal y = S", tooltip: false }),
        fnSeries((s) => 1 - Math.exp(-k * s), 0, 1, 200, { color: 1, label: `y = 1 − exp(−${k.toFixed(2)} S)` }),
        { type: "line", data: stair, color: 2, thin: true, label: "iteration from S = 1", tooltip: false },
      ],
      annotations: [{ x: Math.max(S, 0.004), y: Math.max(S, 0.004), text: S > 0 ? `S = ${S.toFixed(3)}` : "only S = 0", dx: 8, dy: 14, dot: true, color: "s1", strong: true }],
      xName: "S", hover: "x",
    });
  }
  slider(f.controls, { label: "average degree ⟨k⟩", min: 0.2, max: 5, step: 0.01, value: k, format: (v) => v.toFixed(2), onInput: (v) => { k = v; draw(); }, wide: true });
  draw();
  f.setCaption("Near ⟨k⟩ = 1 the curve hugs the diagonal and the iteration needs many steps. This critical slowing down is another signature of the phase transition.");
}

// ------------------------------------------------------------------ 4. finite-size effects (worker)
(async () => {
  const f = figure("#fig-finite", { title: "Largest and second-largest component in finite random networks", sub: "Union–find simulation in a background thread, averaged over several networks per size.", cols: "cols-2" });
  const p1 = f.panel("Largest component, N_G / N"), p2 = f.panel("Second-largest component (nodes)");
  const status = h("div", { class: "status-line" }, "Simulating…");
  f.controls.append(status);
  const A = new Plot(p1, { height: 260, x: { label: "⟨k⟩", min: 0, max: 3 }, y: { label: "N_G / N", min: 0, max: 1 } });
  const B = new Plot(p2, { height: 260, x: { label: "⟨k⟩", min: 0, max: 3 }, y: { type: "log", label: "nodes" } });
  const configs = [{ N: 1000, reps: 30 }, { N: 10000, reps: 12 }, { N: 100000, reps: 4 }];
  const res = [];
  for (const [i, c] of configs.entries()) {
    status.textContent = `Simulating N = ${fmt.int(c.N)} (${c.reps} networks)…`;
    const out = await run("giantVsK", { N: c.N, kMax: 3, points: 120, reps: c.reps, seed: 3 + i }).promise;
    res.push({ ...c, rows: out });
    const draw = () => {
      A.update({
        series: [fnSeries(giantComponentFraction, 0, 3, 200, { color: "theory", dashed: true, label: "N → ∞ theory" }),
          ...res.map((r, j) => ({ type: "line", data: r.rows.map((x) => [x.k, x.S1]), color: j + 1, label: `N = ${fmt.int(r.N)}` }))],
        rules: [{ x: 1 }], xName: "⟨k⟩", yFormat: (v) => fmt.pct(v),
      });
      B.update({
        series: res.map((r, j) => ({ type: "line", data: r.rows.filter((x) => x.S2 > 0).map((x) => [x.k, x.S2]), color: j + 1, label: `N = ${fmt.int(r.N)}` })),
        rules: [{ x: 1, label: "⟨k⟩ = 1" }], xName: "⟨k⟩", yFormat: (v) => fmt.sig(v, 3),
      });
    };
    draw();
  }
  const peaks = res.map((r) => { let b = r.rows[0]; for (const x of r.rows) if (x.S2 > b.S2) b = x; return `N = ${fmt.int(r.N)}: peak at ⟨k⟩ ≈ ${b.k.toFixed(2)}`; });
  status.textContent = "Done. " + peaks.join(" · ");
  f.setCaption("The larger the network, the sharper the transition and the closer the peak of the second-largest component moves to ⟨k⟩ = 1. In finite networks the peak sits slightly above 1.");
})();

// ------------------------------------------------------------------ 5. scaling of N_G with N (worker)
(async () => {
  const f = figure("#fig-scaling", { title: "How the largest component grows with N (Advanced Topic 3.D)", sub: "Average of 3 networks per point, N = 10³ … 10⁶." });
  const status = h("div", { class: "status-line" }, "Simulating…");
  f.controls.append(status);
  const plot = new Plot(f.body, { height: 300, x: { type: "log", label: "network size N" }, y: { type: "log", label: "largest component N_G" } });
  const Ns = [1000, 3000, 10000, 30000, 100000, 300000, 1000000];
  const ks = [0.5, 1, 2];
  const rows = [];
  await run("giantScaling", { Ns, ks, reps: 3, seed: 11 }, (row) => {
    rows.push(row);
    status.textContent = `⟨k⟩ = ${row.k}, N = ${fmt.int(row.N)} done`;
    plot.update({
      series: [
        ...ks.map((k, i) => ({ type: "line", markers: true, data: rows.filter((r) => r.k === k).map((r) => [r.N, r.NG]), color: i + 1, label: `⟨k⟩ = ${k}` })),
        fnSeries((N) => 0.9 * Math.pow(N, 2 / 3), 1000, 1e6, 20, { log: true, color: "theory", dashed: true, label: "theory: 0.9·N^(2/3) at ⟨k⟩ = 1, S(2)·N at ⟨k⟩ = 2", tooltip: false }),
        fnSeries((N) => giantComponentFraction(2) * N, 1000, 1e6, 20, { log: true, color: "theory", dashed: true, legend: false, tooltip: false }),
      ],
      xName: "N", yFormat: (v) => fmt.int(v),
    });
  }).promise;
  status.textContent = "Done.";
})();

// ------------------------------------------------------------------ 6. real networks on the phase diagram
(async () => {
  const { networks } = await loadNetworks();
  const nets = NETWORK_ORDER.map((n) => networks[n]);
  const f = figure("#fig-real", { title: "The book's networks on the random-network phase diagram", sub: "Horizontal: average degree. Vertical: ln N. Left of the dashed curve ⟨k⟩ = ln N a random network would not be connected." });
  const plot = new Plot(f.body, { height: 320, x: { type: "log", label: "average degree ⟨k⟩", min: 0.5, max: 20 }, y: { label: "ln N", min: 5, max: 14 } });
  plot.update({
    series: [
      fnSeries((k) => Math.log(Math.exp(k)), 0.5, 20, 100, { log: true, color: "theory", dashed: true, label: "⟨k⟩ = ln N (connected to its right)", tooltip: false }),
      { type: "scatter", data: nets.map((d) => [d.avgk, Math.log(d.N), d]), color: 1, label: "real networks", r: 5,
        tooltip: (p) => [h("div", { class: "tt-title" }, p[2].description), h("div", {}, `⟨k⟩ = ${p[2].avgk.toFixed(2)}, ln N = ${Math.log(p[2].N).toFixed(2)}`), h("div", {}, `observed N_G/N = ${fmt.pct(p[2].components.giantFraction)}`)] },
    ],
    bands: [{ x0: 0.5, x1: 1, label: "subcritical" }],
    rules: [{ x: 1, label: "⟨k⟩ = 1" }],
    annotations: nets.map((d) => ({ x: d.avgk, y: Math.log(d.N), text: SHORT[d.name], dx: 8, dy: d.name === "powergrid" ? 14 : d.name === "phonecalls" ? 16 : d.name === "email" ? -6 : 4 })),
    xName: "⟨k⟩",
  });
  const rows = nets.map((d) => {
    const S = giantComponentFraction(d.avgk);
    return [d.description, d.avgk, Math.log(d.N), d.avgk > Math.log(d.N) ? "connected" : d.avgk > 1 ? "supercritical" : "subcritical", S, d.N * Math.exp(-d.avgk), d.components.giantFraction];
  });
  f.body.append(dataTable([
    { label: "Network", align: "left" }, { label: "⟨k⟩", format: (v) => v.toFixed(2) }, { label: "ln N", format: (v) => v.toFixed(2) },
    { label: "random-network regime", align: "left" }, { label: "random network: S(⟨k⟩)", format: (v) => fmt.pct(v, 2) },
    { label: "expected isolated, N·e^−⟨k⟩", format: (v) => fmt.sig(v, 3) }, { label: "observed N_G/N", format: (v) => fmt.pct(v, 1) },
  ], rows));
})();
