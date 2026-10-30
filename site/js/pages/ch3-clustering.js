import "../layout.js";
import { h, figure, slider, select, button, stats, dataTable, nextFrame } from "../lib/ui.js";
import { NetView } from "../lib/netview.js";
import { Plot, fnSeries } from "../lib/plot.js";
import { RNG } from "../lib/rng.js";
import { gnp, gnpCSR, clusteringSummary } from "../lib/graph.js";
import { fmt, logLogFit } from "../lib/stats.js";
import { loadNetworks, NETWORK_ORDER, SHORT } from "../lib/data.js";
import { run } from "../lib/compute.js";

// ------------------------------------------------------------------ 1. why C = p
{
  const N = 50;
  let p = 0.12, seed = 3, g, cs, focus = 0;
  const f = figure("#fig-why", { title: "Two neighbours of a node are linked with probability p", sub: "Click a node: its neighbours are highlighted, and the links among them are drawn in orange.", cols: "split" });
  const pn = f.panel(null), pr = f.panel(null);
  let nb = new Set();
  const nv = new NetView(pn, {
    height: 360, charge: -60, linkDistance: 34,
    nodeRadius: (v) => (v === focus ? 9 : nb.has(v) ? 6.5 : 4.5),
    nodeColor: (v) => (v === focus ? "s2" : nb.has(v) ? "s1" : "random"),
    edgeColor: (u, v) => (nb.has(u) && nb.has(v) ? "s2" : u === focus || v === focus ? "blue-2" : "axis"),
    edgeWidth: (u, v) => (nb.has(u) && nb.has(v) ? 2.6 : u === focus || v === focus ? 1.6 : 1),
    tooltip: (v) => `node ${v} · k = ${g.degree(v)} · C = ${fmt.fix(cs.local[v], 3)}`,
    onClick: (v) => { focus = v; paint(); },
  });
  const t = stats(pr, [
    { key: "k", label: "degree kᵢ" }, { key: "Li", label: "links among the neighbours, Lᵢ" }, { key: "Ci", label: "Cᵢ = 2Lᵢ / kᵢ(kᵢ − 1)" },
    { key: "C", label: "network ⟨C⟩" }, { key: "p", label: "theory: p = ⟨k⟩/(N − 1)" },
  ]);
  t.el.style.gridTemplateColumns = "repeat(auto-fit, minmax(150px, 1fr))"; // no empty tracks, so long labels get room
  function paint() {
    nb = new Set(g.neighbors(focus));
    const k = nb.size;
    const Li = Math.round((cs.local[focus] * k * (k - 1)) / 2);
    t.set("k", k); t.set("Li", `${Li} of ${(k * (k - 1)) / 2}`, `expected p·kᵢ(kᵢ − 1)/2 = ${fmt.fix((p * k * (k - 1)) / 2, 1)}`);
    t.set("Ci", k < 2 ? "–" : fmt.fix(cs.local[focus], 3), k < 2 ? "undefined for k < 2" : "");
    nv.redraw();
  }
  function build(relayout) {
    g = gnp(N, p, new RNG(seed));
    cs = clusteringSummary(g);
    // start from the node with the most neighbours, where Cᵢ is least noisy
    let best = 0;
    for (let v = 0; v < N; v++) if (g.degree(v) > g.degree(best)) best = v;
    if (relayout || g.degree(focus) < 2) focus = best;
    nv.setGraph(g, { keep: !relayout });
    t.set("C", fmt.fix(cs.avg, 3)); t.set("p", fmt.fix(p, 3), `⟨k⟩ = ${fmt.fix((2 * g.m) / N, 2)}`);
    paint();
  }
  slider(f.controls, { label: "link probability p", min: 0.02, max: 0.4, step: 0.01, value: p, format: (v) => v.toFixed(2), onInput: (v) => { p = v; build(false); }, wide: true });
  button(f.controls, { label: "New random network", icon: "dice", onClick: () => { seed++; build(true); } });
  build(true);
  f.setCaption("Each of the kᵢ(kᵢ − 1)/2 pairs of neighbours is linked independently with probability p, whatever the degree of the node. So the expected Cᵢ is p for every node, and ⟨C⟩ = p = ⟨k⟩/(N − 1). The fraction is noisy for any single node but averages out over the network.");
}

// ------------------------------------------------------------------ 2. ⟨C⟩ vanishes as N grows
{
  let k = 10, seed = 1;
  const f = figure("#fig-cn", { title: "Clustering of random networks vanishes as they grow", sub: "Simulated G(N, p) with fixed ⟨k⟩ (one network per size, computed in your browser)." });
  const status = h("div", { class: "status-line" });
  const plot = new Plot(f.body, { height: 280, x: { type: "log", label: "number of nodes N" }, y: { type: "log", label: "average clustering ⟨C⟩" } });
  const Ns = [250, 500, 1000, 2000, 4000, 8000, 16000, 32000];
  let token = 0;
  async function simulate() {
    const my = ++token;
    const rows = [];
    for (const N of Ns) {
      status.textContent = `Simulating N = ${fmt.int(N)}…`;
      await nextFrame();
      if (my !== token) return;
      rows.push([N, clusteringSummary(gnpCSR(N, k / (N - 1), new RNG(seed * 100 + N))).avg]);
      plot.update({
        series: [
          fnSeries((N) => k / N, 200, 40000, 20, { log: true, color: "theory", dashed: true, label: "theory ⟨k⟩/N" }),
          { type: "scatter", data: rows.slice(), color: "random", symbol: "square", label: `simulated, ⟨k⟩ = ${k}`, r: 4.5 },
        ],
        xName: "N", yFormat: (v) => fmt.sig(v, 3),
      });
    }
    status.textContent = "";
  }
  slider(f.controls, { label: "average degree ⟨k⟩", min: 2, max: 40, step: 1, value: k, onChange: (v) => { k = v; simulate(); }, wide: true });
  button(f.controls, { label: "Run again", icon: "dice", onClick: () => { seed++; simulate(); } });
  f.controls.append(status);
  simulate();
  f.setCaption("Doubling N halves ⟨C⟩: a slope of −1 on log-log axes. The notebook's table (cell 43) is the same experiment for ⟨k⟩ = 10. In a large random network your friends are practically never friends with each other.");
}

// ------------------------------------------------------------------ 3. real networks: ⟨C⟩/⟨k⟩ vs N (book Fig. 3.13)
(async () => {
  const { networks } = await loadNetworks();
  const nets = NETWORK_ORDER.map((n) => networks[n]);
  const f = figure("#fig-real", { title: "Real networks keep their clustering", sub: "⟨C⟩/⟨k⟩ against N. A random network has ⟨C⟩/⟨k⟩ ≈ 1/N, the dashed line." });
  const plot = new Plot(f.body, { height: 320, x: { type: "log", label: "number of nodes N", min: 500, max: 1e6 }, y: { type: "log", label: "⟨C⟩ / ⟨k⟩" } });
  plot.update({
    series: [
      fnSeries((N) => 1 / N, 500, 1e6, 10, { log: true, color: "theory", dashed: true, label: "random network: 1/N" }),
      { type: "scatter", data: nets.map((d) => [d.N, d.nullModels.er.C / d.avgk, d]), color: "random", symbol: "square", label: "random counterpart G(N, L)", r: 4,
        tooltip: (p) => [h("div", { class: "tt-title" }, `${p[2].description}: random counterpart`), h("div", {}, `⟨C⟩ = ${fmt.sig(p[2].nullModels.er.C, 3)}`)] },
      { type: "scatter", data: nets.map((d) => [d.N, d.clustering.avg / d.avgk, d]), color: 1, label: "real network", r: 5,
        tooltip: (p) => [h("div", { class: "tt-title" }, p[2].description), h("div", {}, `⟨C⟩ = ${fmt.sig(p[2].clustering.avg, 3)}, ⟨k⟩ = ${p[2].avgk.toFixed(2)}`), h("div", {}, `${fmt.sig(p[2].clustering.avg / p[2].nullModels.er.C, 3)}× the random value`)] },
    ],
    annotations: nets.map((d) => ({ x: d.N, y: d.clustering.avg / d.avgk, text: SHORT[d.name], dx: d.name === "collaboration" ? -8 : 8, anchor: d.name === "collaboration" ? "end" : "start", dy: d.name === "powergrid" ? 12 : d.name === "phonecalls" ? -4 : 4 })),
    xName: "N",
  });
  f.body.append(dataTable([
    { label: "Network", align: "left" }, { label: "N", format: fmt.int }, { label: "⟨k⟩", format: (v) => v.toFixed(2) },
    { label: "real ⟨C⟩", format: (v) => fmt.sig(v, 3) }, { label: "theory ⟨k⟩/N", format: (v) => fmt.sig(v, 3) },
    { label: "G(N, L) simulated", format: (v) => fmt.sig(v, 3) }, { label: "real / random", format: (v) => fmt.int(v) + "×" },
    { label: "real C_Δ (global)", format: (v) => fmt.sig(v, 3) },
  ], nets.map((d) => [d.description, d.N, d.avgk, d.clustering.avg, d.avgk / d.N, d.nullModels.er.C, d.clustering.avg / d.nullModels.er.C, d.clustering.transitivity])));
  f.setCaption("Real ⟨C⟩/⟨k⟩ hardly depends on N and lies between about 40 times (metabolism) and 10,000 times (WWW) above the random value. The random counterparts sit on the 1/N line, as they should.");

  // C(k)
  let name = "collaboration", token = 0;
  const g = figure("#fig-ck", { title: "Clustering as a function of degree, C(k)", sub: "Average Cᵢ of the nodes with degree k, against two random counterparts computed in a background thread." });
  const status = h("div", { class: "status-line" });
  const t = stats(g.body, [{ key: "slope", label: "slope of real C(k), log-log" }, { key: "er", label: "G(N, L), this draw: ⟨C⟩" }, { key: "cfg", label: "same degrees, random wiring: ⟨C⟩" }]);
  t.el.style.gridTemplateColumns = "repeat(auto-fit, minmax(150px, 1fr))";
  const p2 = new Plot(g.body, { height: 340, x: { type: "log", label: "degree k" }, y: { type: "log", label: "C(k)" } });
  let nulls = null;
  function draw() {
    const d = networks[name];
    const bd = d.clustering.byDegree;
    const real = bd.k.map((k, i) => [k, bd.C[i]]).filter((x) => x[1] > 0);
    const fit = logLogFit(real.map((x) => x[0]), real.map((x) => x[1]));
    t.set("slope", fmt.fix(fit.slope, 2), "hierarchical networks: −1");
    t.set("er", nulls ? fmt.sig(nulls.er.C, 3) : "…", `real ⟨C⟩ = ${fmt.sig(d.clustering.avg, 3)}`);
    t.set("cfg", nulls ? fmt.sig(nulls.configuration.C, 3) : "…", nulls ? `${fmt.pct(nulls.configuration.C / d.clustering.avg, 1)} of the real value` : "");
    const k0 = real.length ? real[0][0] : 2, k1 = d.kmax;
    const c0 = real.length ? real[0][1] : 0.5;
    p2.update({
      series: [
        { type: "scatter", data: real, color: 1, label: `${d.description}`, r: 3.5 },
        nulls && { type: "scatter", data: nulls.configuration.Ck.filter((x) => x[1] > 0).map(([k, C]) => [k, C]), color: 2, symbol: "triangle", label: "random wiring, same degrees (configuration model)", r: 3.5 },
        nulls && { type: "scatter", data: nulls.er.Ck.filter((x) => x[1] > 0).map(([k, C]) => [k, C]), color: "random", symbol: "square", label: "G(N, L)", r: 3.5 },
        fnSeries((k) => d.avgk / d.N, 1, k1, 2, { log: true, color: "theory", dashed: true, label: "random theory ⟨k⟩/N", tooltip: false }),
        fnSeries((k) => c0 * (k0 / k), k0, k1, 10, { log: true, color: "theory", thin: true, label: "∝ 1/k (guide)", tooltip: false }),
      ],
      xName: "k", yFormat: (v) => fmt.sig(v, 3),
    });
  }
  async function compute() {
    const my = ++token;
    nulls = null;
    draw();
    const d = networks[name];
    status.textContent = `Building the random counterparts of ${d.description} (N = ${fmt.int(d.N)})…`;
    const res = await run("nullClustering", { N: d.N, L: d.L, hist: d.degreeHist, seed: 5 }).promise;
    if (my !== token) return;
    nulls = res;
    status.textContent = "";
    draw();
  }
  select(g.controls, { label: "Network", value: name, options: NETWORK_ORDER.map((n) => ({ value: n, label: networks[n].description })), onChange: (v) => { name = v; compute(); } });
  g.controls.append(status);
  compute();
  g.setCaption("A random network's C(k) is flat and tiny. Real C(k) is orders of magnitude higher and falls with k. Degree classes in which no node has a triangle (C(k) = 0) cannot be drawn on log axes and are left out, as in the notebook.");
})();
