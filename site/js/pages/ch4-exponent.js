import "../layout.js";
import { h, figure, slider, button, stats } from "../lib/ui.js";
import { NetView } from "../lib/netview.js";
import { Plot } from "../lib/plot.js";
import { RNG } from "../lib/rng.js";
import { powerlawSequence, configurationModel, pairsToGraph, giantComponent, degreeStats, distanceStats } from "../lib/graph.js";
import { fmt } from "../lib/stats.js";
import { loadNetworks, NETWORK_ORDER, SHORT } from "../lib/data.js";
import { run } from "../lib/compute.js";

const regime = (g) => (g < 2 ? "anomalous (γ < 2)" : g < 3 ? "scale-free (2 < γ < 3)" : "random-like (γ > 3)");

// ------------------------------------------------------------------ 1. a network for each γ (notebook cell 68)
{
  let gamma = 2.5, seed = 3;
  const N = 300;
  const f = figure("#fig-net", { title: "What γ does to a network", sub: "Configuration model, N = 300, k_min = 2; largest component shown, node area proportional to degree.", cols: "split" });
  const pn = f.panel(null), pr = f.panel(null);
  let g = null;
  const nv = new NetView(pn, { height: 400, toolbar: true, charge: -18, linkDistance: 16, gravity: 0.1, nodeRadius: (i) => 1.8 + 1.2 * Math.sqrt(g.degree(i)), nodeColor: () => "s1", edgeColor: () => "axis", ringWidth: 0.6, tooltip: (i) => `degree ${g.degree(i)}` });
  const t = stats(pr, [{ key: "r", label: "regime" }, { key: "k", label: "⟨k⟩" }, { key: "kmax", label: "k_max" }, { key: "k2", label: "⟨k²⟩/⟨k⟩" }, { key: "d", label: "⟨d⟩ (largest component)" }, { key: "lost", label: "self-loops and multi-links removed" }]);
  function build() {
    const rng = new RNG(seed);
    const seq = powerlawSequence(N, gamma, 2, rng);
    const cm = configurationModel(seq, rng);
    g = giantComponent(pairsToGraph(N, cm.pairs)).graph;
    const s = degreeStats(g), d = distanceStats(g);
    t.set("r", regime(gamma).split(" (")[0], regime(gamma).split(" (")[1].replace(")", "")); t.set("k", fmt.fix(s.avg, 2), `${s.n} nodes in the largest component`); t.set("kmax", fmt.int(s.max), `natural cutoff ${fmt.int(2 * Math.pow(N, 1 / (gamma - 1)))}`);
    t.set("k2", fmt.fix(s.k2 / s.avg, 1)); t.set("d", fmt.fix(d.avg, 2), `diameter ${d.diameter}`);
    t.set("lost", fmt.pct((cm.selfLoops + cm.multiLinks) / (cm.raw.length / 2), 1), "of the stub pairs");
    nv.setGraph(g, { keep: false });
  }
  slider(f.controls, { label: "degree exponent γ", min: 1.8, max: 4, step: 0.1, value: gamma, format: (v) => v.toFixed(1), onChange: (v) => { gamma = v; build(); }, wide: true });
  button(f.controls, { label: "New network", icon: "dice", onClick: () => { seed++; build(); } });
  build();
  f.setCaption("Near γ = 2 a handful of hubs hold everything together and almost every node is one or two steps from a hub. Above γ = 3 the hubs shrink and the network looks increasingly like a random one. Degrees are capped at N − 1; even so, for γ close to 2 a large share of the hubs' stubs cannot be paired without repeated links.");
}

// ------------------------------------------------------------------ 2. multi-links as γ → 2 (worker)
(async () => {
  const f = figure("#fig-multi", { title: "Why γ < 2 is hard to realise in a simple network", sub: "Share of stub pairs (half-links joined at random) that the configuration model turns into self-loops or repeated links, N = 10,000, k_min = 1, degrees uncapped (3 networks per γ)." });
  const status = h("div", { class: "status-line" }, "Simulating…");
  f.controls.append(status);
  const plot = new Plot(f.body, { height: 260, x: { label: "degree exponent γ", min: 1.5, max: 3.5 }, y: { type: "log", label: "share of stub pairs lost" } });
  const gammas = [];
  for (let g = 1.6; g <= 3.4001; g += 0.1) gammas.push(+g.toFixed(1));
  const rows = [];
  await run("multiLinkFraction", { N: 10000, kmin: 1, gammas, reps: 3, seed: 4 }, (r) => {
    rows.push(r);
    status.textContent = `γ = ${r.gamma} done`;
    plot.update({ series: [{ type: "line", markers: true, data: rows.map((x) => [x.gamma, x.fraction, x]), color: 1, label: "self-loops and multi-links", tooltip: (p) => [h("div", { class: "tt-title" }, `γ = ${p[0]}`), h("div", {}, `${fmt.pct(p[1], 2)} of stub pairs lost`), h("div", {}, `largest degree ≈ ${fmt.int(p[2].kmax)}`)] }], bands: [{ x0: 1.5, x1: 2, label: "anomalous" }, { x0: 3, x1: 3.5, label: "random-like", opacity: 0.04 }], xName: "γ", hover: "point" });
  }).promise;
  status.textContent = "Done.";
  f.setCaption("For γ < 2 the largest hub would need more links than there are nodes (k_max ~ N^(1/(γ−1)) > N), so many of its stubs can only be paired with nodes it is already linked to. A large simple network cannot have γ < 2 all the way out to its largest degree.");
})();

// ------------------------------------------------------------------ 3. where the book's networks fall
(async () => {
  const { networks } = await loadNetworks();
  const nets = NETWORK_ORDER.map((n) => networks[n]).sort((a, b) => a.powerlaw.gamma - b.powerlaw.gamma);
  const f = figure("#fig-real", { title: "The book's networks on the γ axis", sub: "Fitted exponent ± 2σ (this site's undirected fits). Shading marks the three regimes." });
  const plot = new Plot(f.body, {
    height: 300, legend: false, x: { label: "fitted degree exponent γ̂", min: 1.5, max: 8.5 },
    y: { min: -0.7, max: nets.length + 0.4, tickValues: nets.map((_, i) => i), format: (v) => SHORT[nets[v]?.name] || "", grid: false }, margin: { top: 16, right: 18, bottom: 42, left: 96 },
  });
  plot.update({
    series: [
      ...nets.map((d, i) => ({ type: "line", data: [[d.powerlaw.gamma - 2 * d.powerlaw.sigma, i], [d.powerlaw.gamma + 2 * d.powerlaw.sigma, i]], color: 1, width: 3, tooltip: false })),
      { type: "scatter", data: nets.map((d, i) => [d.powerlaw.gamma, i, d]), color: 1, r: 5, tooltip: (p) => [h("div", { class: "tt-title" }, p[2].description), h("div", {}, `γ̂ = ${p[2].powerlaw.gamma.toFixed(2)} ± ${p[2].powerlaw.sigma.toFixed(2)}, k_min = ${p[2].powerlaw.kmin}`), h("div", {}, regime(p[2].powerlaw.gamma))] },
    ],
    bands: [{ x0: 1.5, x1: 2, label: "anomalous" }, { x0: 2, x1: 3, label: "scale-free", opacity: 0 }, { x0: 3, x1: 8.5, label: "random-like", opacity: 0.04 }],
    rules: [{ x: 2 }, { x: 3 }], xName: "γ̂", hover: "point",
  });
  f.setCaption("The power grid's interval (7.6 ± 1.8) runs off the chart. Three networks fall inside 2 < γ < 3, four in the random-like regime and one, email, just below 2.");
})();
