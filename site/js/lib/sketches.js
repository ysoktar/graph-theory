// "Sketch this graph": small plots drawn straight from the course's equations, for the exam guides. Each
// <div class="sketch" data-sketch="name"></div> becomes the plot SKETCHES[name] describes. They show the shape a
// student should be able to draw by hand: axes, which scale is logarithmic, where the curve bends, what is flat.
import { Plot, fnSeries } from "./plot.js";
import { whenVisible } from "./ui.js";
import { RNG } from "./rng.js";
import { wattsStrogatz, distanceSample, clusteringSummary } from "./graph.js";

const lgamma = (x) => { let s = 0; for (let i = 2; i < x; i++) s += Math.log(i); return s; }; // ln((x-1)!) for integer x
const poisson = (k, m) => Math.exp(-m + k * Math.log(m) - lgamma(k + 1));
const giant = (k) => { let S = 1; for (let i = 0; i < 500; i++) S = 1 - Math.exp(-k * S); return k <= 1 ? 0 : S; };
const pts = (f, a, b, n = 60) => Array.from({ length: n + 1 }, (_, i) => { const x = a + ((b - a) * i) / n; return [x, f(x)]; });
const ln = Math.log;

export const SKETCHES = {
  poisson: () => ({
    x: { label: "degree k", min: 0, max: 30 }, y: { label: "pₖ", min: 0 },
    series: [3, 10].map((m, i) => ({ type: "line", markers: true, data: Array.from({ length: 31 }, (_, k) => [k, poisson(k, m)]), color: i + 1, label: `⟨k⟩ = ${m}` })),
  }),
  giant: () => ({
    x: { label: "average degree ⟨k⟩", min: 0, max: 8 }, y: { label: "S = N_G / N", min: 0, max: 1 },
    series: [{ type: "line", data: pts(giant, 0, 8, 160), color: 1, label: "S = 1 − e^(−⟨k⟩S)" }],
    rules: [{ x: 1, label: "critical ⟨k⟩ = 1", dashed: true }, { x: ln(1000), label: "connected: ⟨k⟩ = ln N (N = 1,000)", dashed: true }],
  }),
  distance: () => ({
    x: { type: "log", label: "number of nodes N" }, y: { type: "log", label: "average distance ⟨d⟩" },
    series: [
      fnSeries((N) => ln(N) / ln(3), 10, 1e9, 40, { log: true, color: 1, label: "random, ⟨k⟩ = 3: ln N / ln⟨k⟩" }),
      fnSeries((N) => ln(N) / ln(10), 10, 1e9, 40, { log: true, color: 2, label: "random, ⟨k⟩ = 10" }),
      fnSeries((N) => Math.sqrt(N) / 2, 10, 1e9, 40, { log: true, color: "random", dashed: true, label: "2D lattice: ∝ N^½" }),
    ],
  }),
  clustering: () => ({
    x: { type: "log", label: "number of nodes N" }, y: { type: "log", label: "clustering C" },
    series: [
      fnSeries((N) => 10 / N, 100, 1e8, 30, { log: true, color: 1, label: "random: C = ⟨k⟩/N (⟨k⟩ = 10)" }),
      fnSeries(() => 0.3, 100, 1e8, 2, { log: true, color: 2, label: "real networks: roughly constant" }),
    ],
  }),
  ws: () => {
    const N = 400, k = 10, rng = new RNG(5), ps = [], C = [], D = [];
    const g0 = wattsStrogatz(N, k, 0, rng), c0 = clusteringSummary(g0).avg, d0 = distanceSample(g0, 30, rng).mean;
    for (let e = -4; e <= 0.001; e += 0.4) {
      const p = Math.pow(10, e), g = wattsStrogatz(N, k, p, rng);
      ps.push(p); C.push([p, clusteringSummary(g).avg / c0]); D.push([p, distanceSample(g, 30, rng).mean / d0]);
    }
    return { x: { type: "log", label: "rewiring probability p" }, y: { label: "relative to p = 0", min: 0, max: 1.05 },
      series: [{ type: "line", markers: true, data: C, color: 1, label: "C(p)/C(0)" }, { type: "line", markers: true, data: D, color: 2, label: "⟨d⟩(p)/⟨d⟩(0)" }],
      bands: [{ x0: 0.003, x1: 0.1, label: "small world", opacity: 0.06 }] };
  },
  powerlaw: () => ({
    x: { type: "log", label: "degree k", min: 1, max: 1000 }, y: { type: "log", label: "pₖ", min: 1e-9 },
    series: [
      { type: "line", markers: true, data: Array.from({ length: 30 }, (_, i) => [i + 1, poisson(i + 1, 10)]).filter((d) => d[1] > 1e-9), color: "random", label: "Poisson, ⟨k⟩ = 10" },
      fnSeries((k) => 0.6 * Math.pow(k, -2.5), 1, 1000, 30, { log: true, color: 1, label: "power law, γ = 2.5: slope −γ" }),
    ],
  }),
  ccdf: () => ({
    x: { type: "log", label: "degree k" }, y: { type: "log", label: "probability" },
    series: [
      fnSeries((k) => Math.pow(k, -2.5), 1, 1000, 30, { log: true, color: 1, label: "pₖ: slope −γ" }),
      fnSeries((k) => Math.pow(k, -1.5), 1, 1000, 30, { log: true, color: 2, label: "P(K ≥ k): slope −(γ − 1)" }),
    ],
  }),
  kmax: () => ({
    x: { type: "log", label: "number of nodes N" }, y: { type: "log", label: "largest degree k_max" },
    series: [
      fnSeries((N) => Math.pow(N, 1 / 1.5), 10, 1e9, 30, { log: true, color: 1, label: "power law γ = 2.5: k_min N^(1/(γ−1))" }),
      fnSeries((N) => Math.pow(N, 1 / 2), 10, 1e9, 30, { log: true, color: 2, label: "power law γ = 3: ∝ N^½" }),
      fnSeries((N) => 1 + 2 * ln(N), 10, 1e9, 30, { log: true, color: "random", label: "exponential: k_min + ln N / λ" }),
    ],
  }),
  regimes: () => ({
    x: { type: "log", label: "number of nodes N" }, y: { label: "average distance ⟨d⟩ (shape only)", min: 0 },
    series: [
      fnSeries((N) => ln(ln(N)), 100, 1e9, 30, { log: true, color: 1, label: "2 < γ < 3: ln ln N (ultra small)" }),
      fnSeries((N) => ln(N) / ln(ln(N)), 100, 1e9, 30, { log: true, color: 2, label: "γ = 3: ln N / ln ln N" }),
      fnSeries((N) => ln(N) / 2, 100, 1e9, 30, { log: true, color: "random", label: "γ > 3 or random: ln N" }),
    ],
  }),
  growth: () => ({
    x: { type: "log", label: "time t (number of nodes)" }, y: { type: "log", label: "degree kᵢ(t)" },
    series: [
      ...[1, 10, 100].map((ti, i) => fnSeries((t) => 2 * Math.sqrt(t / ti), ti, 1e4, 20, { log: true, color: i + 1, label: `BA, arrived at tᵢ = ${ti}: m(t/tᵢ)^½` })),
      fnSeries((t) => 2 * (1 + ln(t / 10)), 10, 1e4, 20, { log: true, color: "random", dashed: true, label: "no preference (Model A), tᵢ = 10: logarithmic" }),
    ],
  }),
  bapk: () => ({
    x: { type: "log", label: "degree k" }, y: { type: "log", label: "pₖ" },
    series: [1, 3, 5].map((m, i) => fnSeries((k) => (2 * m * (m + 1)) / (k * (k + 1) * (k + 2)), m, 1e3, 30, { log: true, color: i + 1, label: `m = ${m}` })),
  }),
  pa: () => ({
    x: { label: "degree k", min: 0, max: 50 }, y: { label: "attachment rate Π(k) (scaled)", min: 0 },
    series: [[0.5, "α = 0.5: sublinear"], [1, "α = 1: linear (BA)"], [1.5, "α = 1.5: superlinear"]].map(([a, label], i) =>
      fnSeries((k) => Math.pow(k, a) / Math.pow(50, a), 0, 50, 50, { color: i + 1, label })),
  }),
  baclust: () => ({
    x: { type: "log", label: "number of nodes N" }, y: { type: "log", label: "clustering C" },
    series: [
      fnSeries((N) => (ln(N) ** 2) / N, 100, 1e8, 30, { log: true, color: 1, label: "BA: ∝ (ln N)²/N" }),
      fnSeries((N) => 4 / N, 100, 1e8, 30, { log: true, color: "random", label: "random: ⟨k⟩/N" }),
      fnSeries(() => 0.3, 100, 1e8, 2, { log: true, color: 2, label: "real networks" }),
    ],
  }),
};

/** Render every sketch inside root when it scrolls into view. */
export function renderSketches(root = document) {
  for (const el of root.querySelectorAll(".sketch[data-sketch]")) {
    const make = SKETCHES[el.dataset.sketch];
    if (!make) continue;
    whenVisible(el, () => {
      const spec = make();
      const plot = new Plot(el, { height: 200, x: spec.x, y: spec.y, table: false });
      plot.update({ series: spec.series, rules: spec.rules, bands: spec.bands });
    });
  }
}
