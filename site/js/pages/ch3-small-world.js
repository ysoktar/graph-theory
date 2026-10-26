import "../layout.js";
import { h, figure, slider, segmented, select, button, stats, dataTable, ICONS } from "../lib/ui.js";
import { NetView, layouts } from "../lib/netview.js";
import { Plot, fnSeries } from "../lib/plot.js";
import { RNG } from "../lib/rng.js";
import { gnp, grid2d, wattsStrogatz, ringLattice, bfs, distanceStats, clusteringSummary, components } from "../lib/graph.js";
import { fmt } from "../lib/stats.js";
import { loadNetworks, NETWORK_ORDER, SHORT } from "../lib/data.js";
import { run } from "../lib/compute.js";

const EULER = 0.5772156649;
/** ⟨d⟩ of a random network: the book's Section 3.8 estimate and its correction (Advanced Topic 3.G, Fronczak et al. 2004). */
const dSimple = (N, k) => Math.log(N) / Math.log(k);
const dCorrected = (N, k) => (Math.log(N) - EULER) / Math.log(k) + 0.5;
const RAMP = ["blue-6", "blue-5", "blue-4", "blue-3", "blue-2", "blue-1"];

// ------------------------------------------------------------------ 1. how many people within d steps
{
  let N = 8e9, k = 1000;
  const f = figure("#fig-ball", { title: "How many people are within d handshakes?", sub: "In a random network each step multiplies the number of people reached by about ⟨k⟩, until everyone is reached." });
  const t = stats(f.body, [
    { key: "d", label: "⟨d⟩ ≈ ln N / ln⟨k⟩" }, { key: "dc", label: "corrected (Advanced Topic 3.G)" },
    { key: "dmax", label: "steps until N(d) ≥ N" }, { key: "one", label: "reached in one step" },
  ]);
  const plot = new Plot(f.body, { height: 280, x: { label: "distance d (handshakes)", integer: true, min: 0 }, y: { type: "log", label: "people within distance d, N(d)" } });
  function draw() {
    const data = [];
    let dmax = 0;
    for (let d = 0; d <= 12; d++) {
      const Nd = (Math.pow(k, d + 1) - 1) / (k - 1);
      data.push([d, Math.min(Nd, 1e30)]);
      if (Nd < N) dmax = d + 1;
    }
    t.set("d", fmt.fix(dSimple(N, k), 2)); t.set("dc", fmt.fix(dCorrected(N, k), 2), "(ln N − 0.577)/ln⟨k⟩ + ½");
    t.set("dmax", dmax, `N(${dmax}) ≥ N`); t.set("one", fmt.int(k), "your acquaintances");
    plot.update({
      series: [{ type: "line", markers: true, data: data.filter((p) => p[1] <= N * 1e3), color: 1, label: "N(d) = 1 + ⟨k⟩ + ⟨k⟩² + … + ⟨k⟩ᵈ" }],
      rules: [{ y: N, label: `everyone: N = ${fmt.exp(N, 1)}`, dashed: true, align: "left" }, { x: dSimple(N, k), label: "ln N / ln⟨k⟩", color: "theory" }],
      xName: "d", yFormat: (v) => fmt.sig(v, 3),
    });
  }
  const sN = slider(f.controls, { label: "population N", min: 1e3, max: 1e10, log: true, step: 1, value: N, format: (v) => fmt.exp(v, 1), onInput: (v) => { N = v; draw(); }, wide: true });
  const sk = slider(f.controls, { label: "acquaintances per person ⟨k⟩", min: 2, max: 3000, log: true, step: 1, value: k, format: fmt.int, onInput: (v) => { k = v; draw(); }, wide: true });
  const row = h("div", { class: "btn-row" });
  f.controls.append(row);
  const preset = (label, n, kk) => button(row, { label, onClick: () => { N = n; k = kk; sN.value = n; sk.value = kk; draw(); } });
  preset("World: 8×10⁹ people, ⟨k⟩ = 1,000", 8e9, 1000);
  preset("Facebook 2011: 7.2×10⁸ users, ⟨k⟩ = 190", 7.21e8, 190);
  preset("Collaboration network", 23133, 8.08);
  draw();
  f.setCaption("The tree estimate N(d) ignores that friends of friends are often already friends, so it overcounts. That is why it gives only a rough $\\langle d\\rangle$. For Facebook in 2011 it predicts 3.9 (corrected: 4.3), while the measured average distance among its 721 million active users was 4.74 (Backstrom et al. 2012).");
}

// ------------------------------------------------------------------ 2. BFS in a random network versus a lattice
{
  const side = 20, N = side * side;
  const rng = new RNG(4);
  const R = gnp(N, 4 / (N - 1), rng);
  const L = grid2d(side, side);
  const gridPos = layouts.grid(N, side, 30);
  let src = { R: components(R).label.indexOf(components(R).giant), L: Math.floor(N / 2) + side / 2 }, dmax = 3;
  const f = figure("#fig-bfs", { title: "Spreading out from one node: random network versus lattice", sub: "Both have N = 400 and ⟨k⟩ ≈ 4. Click a node to start from it.", cols: "cols-2" });
  const views = {};
  const dist = { R: null, L: null };
  const t = stats(f.body, [{ key: "R", label: "random network: share reached within d" }, { key: "L", label: "lattice: share reached within d" }]);
  t.el.style.gridColumn = "1 / -1";
  const make = (key, g, title, positions) => {
    const p = f.panel(title);
    views[key] = new NetView(p, {
      height: 300, toolbar: key === "R", charge: -24, linkDistance: 16, gravity: 0.1,
      nodeRadius: (v) => (v === src[key] ? 6 : 3.4),
      nodeColor: (v) => { const d = dist[key][v]; return v === src[key] ? "s2" : d >= 0 && d <= dmax ? RAMP[Math.min(5, d - 1)] : "surface-3"; },
      edgeColor: (u, v) => (dist[key][u] >= 0 && dist[key][u] <= dmax && dist[key][v] >= 0 && dist[key][v] <= dmax ? "blue-2" : "axis"),
      ringWidth: 0.6,
      tooltip: (v) => `node ${v} · distance ${dist[key][v] < 0 ? "∞ (other component)" : dist[key][v]}`,
      onClick: (v) => { src[key] = v; update(); },
    });
    views[key].setGraph(g, positions ? { positions } : {});
  };
  make("R", R, "Random network G(N, p)");
  make("L", L, "Square lattice (20 × 20)", gridPos);
  const plot = new Plot(f.body, { height: 230, x: { label: "distance d from the source", integer: true, min: 0 }, y: { label: "share of nodes within d", min: 0, max: 1 } });
  plot.root.style.gridColumn = "1 / -1";
  const cum = (d) => { const c = []; let s = 0; const counts = []; for (const x of d) if (x >= 0) counts[x] = (counts[x] || 0) + 1; for (let i = 0; i < counts.length; i++) { s += counts[i] || 0; c.push([i, s / N]); } return c; };
  function update() {
    dist.R = bfs(R, src.R).dist; dist.L = bfs(L, src.L).dist;
    const cR = cum(dist.R), cL = cum(dist.L);
    const at = (c) => (c[Math.min(dmax, c.length - 1)] || [0, 0])[1];
    t.set("R", fmt.pct(at(cR), 0), `farthest node: ${cR.length - 1} steps`); t.set("L", fmt.pct(at(cL), 0), `farthest node: ${cL.length - 1} steps`);
    views.R.redraw(); views.L.redraw();
    plot.update({
      series: [{ type: "line", markers: true, data: cR, color: 1, label: "random network" }, { type: "line", markers: true, data: cL, color: 2, label: "lattice" }],
      rules: [{ x: dmax, label: `d = ${dmax}`, color: "theory" }], xName: "d", yFormat: (v) => fmt.pct(v),
    });
  }
  slider(f.controls, { label: "show nodes within d", min: 0, max: 20, step: 1, value: dmax, onInput: (v) => { dmax = v; update(); }, wide: true });
  update();
  f.setCaption("In the lattice the reached region is a diamond whose area grows like d², so reaching N nodes takes about √N steps. In the random network the number of new nodes is multiplied at every step and the whole network is reached in a handful of steps. Random links are shortcuts.");
}

// ------------------------------------------------------------------ 3. ⟨d⟩ versus N (worker)
(async () => {
  const f = figure("#fig-dn", { title: "Average distance versus network size", sub: "Simulated in a background thread: BFS from 60 random sources in the largest component, 2 networks per point." });
  const status = h("div", { class: "status-line" }, "Simulating…");
  let theory = "corrected", rows = [], yLog = false;
  const plot = new Plot(f.body, { height: 320, x: { type: "log", label: "number of nodes N" }, y: { label: "average distance ⟨d⟩", min: 0 } });
  const ks = [3, 6, 10];
  const Ns = [100, 324, 1024, 3249, 10000, 32400];
  function draw() {
    const fn = theory === "corrected" ? dCorrected : dSimple;
    plot.update({
      series: [
        ...ks.map((k, i) => ({ type: "scatter", data: rows.filter((r) => r.label === `k${k}`).map((r) => [r.N, r.d]), color: i + 1, label: `random network, ⟨k⟩ = ${k}`, symbol: "square", r: 4.5 })),
        { type: "scatter", data: rows.filter((r) => r.label === "grid").map((r) => [r.N, r.d]), color: 4, label: "square lattice, ⟨k⟩ ≈ 4", symbol: "diamond", r: 5 },
        ...ks.map((k, i) => fnSeries((N) => fn(N, k), 100, 32400, 40, { log: true, color: "theory", dashed: true, label: i === 0 ? (theory === "corrected" ? "(ln N − γ_E)/ln⟨k⟩ + ½" : "ln N / ln⟨k⟩") : undefined, legend: i === 0, tooltip: false })),
        fnSeries((N) => (2 / 3) * Math.sqrt(N), 100, 32400, 40, { log: true, color: 4, thin: true, dashed: true, label: "⅔ √N (lattice)", tooltip: false }),
      ],
      y: yLog ? { type: "log", min: 1, max: 200 } : { type: "linear", min: 0, max: 12 }, xName: "N", yFormat: (v) => fmt.fix(v, 2),
    });
  }
  segmented(f.controls, { label: "Theory line", value: theory, options: [{ value: "simple", label: "ln N / ln⟨k⟩ (Section 3.8)" }, { value: "corrected", label: "corrected (3.G)" }], onChange: (v) => { theory = v; draw(); } });
  segmented(f.controls, { label: "Vertical axis", value: "lin", options: [{ value: "lin", label: "linear (random networks)" }, { value: "log", label: "logarithmic (with the lattice)" }], onChange: (v) => { yLog = v === "log"; draw(); } });
  f.controls.append(status);
  draw();
  const models = [...ks.map((k) => ({ kind: "er", avgk: k, label: `k${k}` })), { kind: "grid", label: "grid" }];
  await run("distanceVsN", { models, Ns, reps: 2, sources: 60, seed: 8 }, (row) => { rows.push(row); status.textContent = `N = ${fmt.int(row.N)} done`; draw(); }).promise;
  status.textContent = "Done.";
  f.setCaption("On a logarithmic N axis the random networks fall on straight lines: ⟨d⟩ grows like ln N. The corrected formula is accurate for ⟨k⟩ = 6 and 10. For ⟨k⟩ = 3 both formulas underestimate the distance in small networks, because the giant component is then noticeably smaller than N. Switch to the logarithmic axis to see the lattice, the opposite of a small world: its distances grow like a power of N, here √N, and reach 120 steps at N = 32,400.");
})();

// ------------------------------------------------------------------ 4. the book's networks against their random counterparts
(async () => {
  const { networks } = await loadNetworks();
  const nets = NETWORK_ORDER.map((n) => networks[n]);
  const f = figure("#fig-real", { title: "Is each real network as small as a random network?", sub: "Observed ⟨d⟩ against a simulated G(N, L) with the same N and L (both: 300 BFS sources in the largest component)." });
  const plot = new Plot(f.body, { height: 340, x: { label: "⟨d⟩ of the random counterpart G(N, L)", min: 0, max: 20 }, y: { label: "observed ⟨d⟩", min: 0, max: 20 } });
  plot.update({
    series: [
      fnSeries((x) => x, 0, 20, 2, { color: "theory", dashed: true, label: "as small as random", tooltip: false }),
      { type: "scatter", data: nets.map((d) => [d.nullModels.er.avgd, d.distances.avg, d]), color: 1, label: "real networks", r: 5,
        tooltip: (p) => [h("div", { class: "tt-title" }, p[2].description), h("div", {}, `observed ⟨d⟩ = ${p[2].distances.avg.toFixed(2)}`), h("div", {}, `random G(N, L): ${p[2].nullModels.er.avgd.toFixed(2)}`)] },
    ],
    annotations: nets.map((d) => ({ x: d.nullModels.er.avgd, y: d.distances.avg, text: SHORT[d.name], dx: d.name === "internet" ? -8 : 8, anchor: d.name === "internet" ? "end" : "start", dy: d.name === "internet" ? -4 : d.name === "www" ? 12 : 4 })),
    xName: "random ⟨d⟩",
  });
  const verdict = (obs, rnd) => {
    const r = obs / rnd;
    return r > 1.5 ? h("span", { class: "verdict no" }, `${r.toFixed(1)}× larger`) : r < 0.8 ? h("span", { class: "verdict ok" }, `${r.toFixed(2)}×: smaller`) : h("span", { class: "verdict meh" }, `${r.toFixed(2)}×: similar`);
  };
  f.body.append(dataTable([
    { label: "Network", align: "left" }, { label: "N", format: fmt.int }, { label: "⟨k⟩", format: (v) => v.toFixed(2) },
    { label: "observed ⟨d⟩", format: (v) => v.toFixed(2) }, { label: "G(N, L) simulated", format: (v) => v.toFixed(2) },
    { label: "ln N / ln⟨k⟩", format: (v) => v.toFixed(2) }, { label: "corrected (3.G)", format: (v) => v.toFixed(2) }, { label: "observed / random", align: "left" },
  ], nets.map((d) => [d.description, d.N, d.avgk, d.distances.avg, d.nullModels.er.avgd, dSimple(d.N, d.avgk), dCorrected(d.N, d.avgk), verdict(d.distances.avg, d.nullModels.er.avgd)])));
  f.setCaption("Most networks sit on or below the diagonal: they are small worlds, and the ones with big hubs (email, metabolism, protein) are even smaller than random. The power grid is the exception. Its links are short power lines between neighbouring stations, so it behaves more like a lattice than like a random network.");

  // distance distribution of one network
  let name = "powergrid";
  const g = figure("#fig-dist", { title: "Distance distribution", sub: "Share of node pairs (source, target) at each distance, from 300 BFS sources." });
  const p2 = new Plot(g.body, { height: 260, x: { label: "distance d", integer: true, min: 0 }, y: { label: "share of pairs" } });
  function draw() {
    const d = networks[name];
    const c = d.distances.count, tot = c.reduce((a, b) => a + b, 0);
    p2.update({
      series: [{ type: "bar", data: c.map((x, i) => [i, x / tot]).filter((p) => p[0] > 0), color: 1, label: d.description }],
      rules: [{ x: d.distances.avg, label: `observed ⟨d⟩ = ${d.distances.avg.toFixed(2)}` }, { x: d.nullModels.er.avgd, label: `random ⟨d⟩ = ${d.nullModels.er.avgd.toFixed(2)}`, dashed: true, color: "random", labelY: 26 }],
      xName: "d", yFormat: (v) => fmt.pct(v),
    });
  }
  select(g.controls, { label: "Network", value: name, options: NETWORK_ORDER.map((n) => ({ value: n, label: networks[n].description })), onChange: (v) => { name = v; draw(); } });
  draw();
  g.setCaption("The distribution is narrow and peaked: most pairs are at distances close to ⟨d⟩, so the average is a meaningful summary. The longest distances (the diameter) are rare.");
})();

// ------------------------------------------------------------------ 5. Watts–Strogatz
{
  const N = 60, K = 4;
  let p = 0.05, seed = 1, g, rewired = new Set();
  const f = figure("#fig-ws", { title: "The Watts–Strogatz model", sub: "Start from a ring where each node links to its 4 nearest neighbours, then rewire each link with probability p.", cols: "split" });
  const pn = f.panel(null), pr = f.panel(null);
  const pos = layouts.circle(N, 200);
  const key = (u, v) => (u < v ? u * N + v : v * N + u);
  const nv = new NetView(pn, {
    height: 380, toolbar: false, drag: false,
    nodeRadius: () => 4.5, nodeColor: () => "s1",
    edgeColor: (u, v) => (rewired.has(key(u, v)) ? "s2" : "axis"), edgeWidth: (u, v) => (rewired.has(key(u, v)) ? 1.8 : 1.1),
  });
  const t = stats(pr, [{ key: "r", label: "rewired links" }, { key: "C", label: "⟨C⟩" }, { key: "d", label: "⟨d⟩" }, { key: "Cr", label: "C(p)/C(0)" }, { key: "dr", label: "⟨d⟩(p)/⟨d⟩(0)" }]);
  const base = ringLattice(N, K), C0 = clusteringSummary(base).avg, d0 = distanceStats(base).avg;
  const ringKeys = new Set(base.edges().map(([u, v]) => key(u, v)));
  function update() {
    g = wattsStrogatz(N, K, p, new RNG(seed));
    rewired = new Set(g.edges().map(([u, v]) => key(u, v)).filter((x) => !ringKeys.has(x)));
    nv.setGraph(g, { positions: pos });
    const C = clusteringSummary(g).avg, d = distanceStats(g);
    t.set("r", `${rewired.size} of ${g.m}`); t.set("C", fmt.fix(C, 3)); t.set("d", fmt.fix(d.avg, 2), `diameter ${d.diameter}`);
    t.set("Cr", fmt.fix(C / C0, 2)); t.set("dr", fmt.fix(d.avg / d0, 2));
  }
  slider(f.controls, { label: "rewiring probability p", min: 0.001, max: 1, log: true, step: 0.001, value: p, format: (v) => v.toFixed(3), onInput: (v) => { p = v; update(); }, wide: true });
  button(f.controls, { label: "New random draw", icon: "dice", onClick: () => { seed++; update(); } });
  update();
  f.setCaption("A few rewired links (orange) already cut across the ring and shorten many paths, while most triangles of the ring survive. With p = 1 the result is essentially a random network.");
}

(async () => {
  const f = figure("#fig-ws-sweep", { title: "Small world with high clustering", sub: "N = 1,000, each node linked to its 10 nearest neighbours, 3 networks per p (background thread)." });
  const status = h("div", { class: "status-line" }, "Simulating…");
  f.controls.append(status);
  const plot = new Plot(f.body, { height: 300, x: { type: "log", label: "rewiring probability p" }, y: { label: "relative to the ring (p = 0)", min: 0, max: 1.05 } });
  const ps = [];
  for (let e = -4; e <= 0.001; e += 0.25) ps.push(Math.pow(10, e));
  const rows = [];
  await run("wattsStrogatzSweep", { N: 1000, k: 10, ps, reps: 3, sources: 80, seed: 12 }, (row) => {
    rows.push(row);
    status.textContent = `p = ${row.p.toPrecision(2)} done`;
    plot.update({
      series: [
        { type: "line", markers: true, data: rows.map((r) => [r.p, r.C]), color: 1, label: "clustering ⟨C⟩(p) / ⟨C⟩(0)" },
        { type: "line", markers: true, data: rows.map((r) => [r.p, r.d]), color: 2, label: "distance ⟨d⟩(p) / ⟨d⟩(0)" },
      ],
      bands: [{ x0: 0.003, x1: 0.1, label: "small world, high clustering" }],
      xName: "p", yFormat: (v) => fmt.fix(v, 3),
    });
  }).promise;
  const d0 = rows[0]?.d0, C0 = rows[0]?.C0;
  status.textContent = `Done. Ring: ⟨C⟩ = ${C0?.toFixed(3)}, ⟨d⟩ = ${d0?.toFixed(1)}.`;
  f.setCaption("Distances collapse long before clustering does. Around p ≈ 0.01, ⟨d⟩ has already fallen to a fraction of its ring value while ⟨C⟩ is still close to that of the ring. Real networks combine both features, which neither the ring nor the random network does.");
})();
