// "Sketch this graph": small plots drawn straight from the course's equations, for the exam guides. Each
// <div class="sketch" data-sketch="name"></div> becomes the plot SKETCHES[name] describes. They show the shape a
// student should be able to draw by hand: axes, which scale is logarithmic, where the curve bends, what is flat.
import { Plot, fnSeries } from "./plot.js";
import { whenVisible } from "./ui.js";
import { RNG } from "./rng.js";
import { wattsStrogatz, distanceSample, clusteringSummary } from "./graph.js";
import { pmf, giantRandom, giantAttack, fcRandom, fcAttack, moments } from "./degdist.js";

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
  // ---- final exam: Ch 6-8 and graph ML
  fitness: () => ({
    x: { type: "log", label: "time t" }, y: { type: "log", label: "degree kᵢ(t)" },
    series: [[10, 0.3], [100, 0.6], [1000, 1]].map(([ti, eta], i) =>
      fnSeries((t) => 2 * Math.pow(t / ti, eta / 1.255), ti, 1e6, 30, { log: true, color: i + 1, label: `tᵢ = ${ti}, η = ${eta}: slope η/C = ${(eta / 1.255).toFixed(2)}` })),
  }),
  condense: () => {
    const uni = (C) => -1 + C * Math.log(C / (C - 1)), zeta = (C, z) => { let s = 0; const n = 4000; for (let i = 0; i < n; i++) { const e = (i + 0.5) / n; s += ((1 + z) * Math.pow(1 - e, z) * e) / (C - e) / n; } return s; };
    return { x: { label: "C", min: 1, max: 2.2 }, y: { label: "∫ρ(η) η/(C − η) dη", min: 0, max: 3 },
      series: [fnSeries((C) => Math.min(3, uni(C)), 1.001, 2.2, 60, { color: 1, label: "uniform ρ: crosses 1 at C = 1.255" }), fnSeries((C) => Math.min(3, zeta(C, 3)), 1.001, 2.2, 40, { color: 2, label: "ρ = 4(1 − η)³: below 1 everywhere, condenses" })],
      rules: [{ y: 1, label: "= 1", dashed: true }] };
  },
  gammas: () => ({
    x: { label: "parameter value", min: 0, max: 3 }, y: { label: "degree exponent γ", min: 2, max: 8 },
    series: [
      fnSeries((x) => 3 + x, 0, 3, 30, { color: 1, label: "initial attractiveness: 3 + A/m (x = A/m)" }),
      fnSeries((x) => 2 + 1 / (1 + 2 * x), 0, 3, 30, { color: 2, label: "double-preferential internal links: 2 + m/(m + 2n) (x = n/m)" }),
      fnSeries((x) => 3 + (2 * (x / 4)) / (1 - x / 4), 0, 3, 40, { color: 3, label: "deletion: 3 + 2r/(1 − r) (x = 4r)" }),
    ], rules: [{ y: 3, label: "BA", dashed: true }],
  }),
  knn: () => ({
    x: { type: "log", label: "degree k" }, y: { type: "log", label: "k_nn(k)" },
    series: [
      fnSeries((k) => 5 * Math.pow(k, 0.37), 1, 300, 20, { log: true, color: 1, label: "assortative, μ = 0.37 (collaboration)" }),
      fnSeries(() => 12, 1, 300, 2, { log: true, color: "random", label: "neutral: ⟨k²⟩/⟨k⟩" }),
      fnSeries((k) => 60 * Math.pow(k, -0.76), 1, 300, 20, { log: true, color: 2, label: "disassortative, μ = −0.76 (metabolism)" }),
    ],
  }),
  cutoff: () => ({
    x: { type: "log", label: "number of nodes N" }, y: { type: "log", label: "degree" },
    series: [
      fnSeries((N) => Math.sqrt(4 * N), 100, 1e9, 30, { log: true, color: "theory", dashed: true, label: "structural cutoff k_s = (⟨k⟩N)^½" }),
      fnSeries((N) => Math.pow(N, 1 / 1.5), 100, 1e9, 30, { log: true, color: 2, label: "k_max, γ = 2.5: grows faster, conflict" }),
      fnSeries((N) => Math.pow(N, 1 / 2.5), 100, 1e9, 30, { log: true, color: 1, label: "k_max, γ = 3.5: stays below" }),
    ],
  }),
  corrgiant: () => {
    const K = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
    const d = { a: [0.007, 0.029, 0.216, 0.402, 0.567, 0.755, 0.935, 0.979], n: [0.005, 0.009, 0.048, 0.354, 0.59, 0.797, 0.943, 0.981], d: [0.002, 0.003, 0.008, 0.019, 0.505, 0.851, 0.952, 0.982] };
    return { x: { label: "average degree ⟨k⟩", min: 0, max: 4 }, y: { label: "S = N_G / N", min: 0, max: 1 },
      series: [["a", 1, "assortative"], ["n", "random", "neutral"], ["d", 2, "disassortative"]].map(([k, c, label]) => ({ type: "line", markers: true, data: K.map((x, i) => [x, d[k][i]]), color: c, label })) };
  },
  robust: () => {
    const sf = pmf("powerlaw", { gamma: 2.5, kmin: 2, logN: 4 }), er = pmf("poisson", { mean: moments(sf).m1 });
    const f = Array.from({ length: 31 }, (_, i) => i / 30), fa = Array.from({ length: 31 }, (_, i) => (0.3 * i) / 30);
    return { x: { label: "fraction removed f", min: 0, max: 1 }, y: { label: "giant component S", min: 0, max: 1 },
      series: [
        { type: "line", data: f.map((x) => [x, giantRandom(sf, x)]), color: 1, label: "scale-free, random failures" },
        { type: "line", data: fa.map((x) => [x, giantAttack(sf, x)]), color: 1, dashed: true, label: "scale-free, attack" },
        { type: "line", data: f.map((x) => [x, giantRandom(er, x)]), color: "random", label: "random network, failures" },
      ] };
  },
  fcgamma: () => {
    const gs = Array.from({ length: 24 }, (_, i) => 2.1 + 0.1 * i), r = [], a = [];
    for (const g of gs) { const pk = pmf("powerlaw", { gamma: g, kmin: 2, logN: 5 }); r.push([g, fcRandom(moments(pk).kappa)]); a.push([g, fcAttack(pk)]); }
    return { x: { label: "degree exponent γ", min: 2, max: 4.5 }, y: { label: "critical fraction f_c", min: 0, max: 1 },
      series: [{ type: "line", data: r, color: 1, label: "random failures: 1 − 1/(κ − 1)" }, { type: "line", data: a, color: 2, label: "attack (largest degree first)" }],
      bands: [{ x0: 2, x1: 3, label: "2 < γ < 3", opacity: 0.05 }] };
  },
  cascade: () => ({
    x: { type: "log", label: "cascade size s" }, y: { type: "log", label: "p(s)" },
    series: [
      fnSeries((s) => Math.pow(s, -1.5), 1, 1e4, 20, { log: true, color: 1, label: "γ > 3 (or random): α = 3/2" }),
      fnSeries((s) => Math.pow(s, -2.5 / 1.5), 1, 1e4, 20, { log: true, color: 2, label: "γ = 2.5: α = γ/(γ − 1) = 5/3" }),
    ],
  }),
  katz: () => {
    const S = (b, opp) => { const lam = 2; const g = (x) => (opp ? (2 * b * b) / (1 - 4 * b * b) : b / (1 - 4 * b * b)); return g(lam); };
    return { x: { label: "damping β", min: 0, max: 0.5 }, y: { label: "Katz score S_uv", min: 0, max: 3 },
      series: [fnSeries((b) => Math.min(3, S(b, false)), 0, 0.49, 60, { color: 1, label: "adjacent corners of a square" }), fnSeries((b) => Math.min(3, S(b, true)), 0, 0.49, 60, { color: 2, label: "opposite corners" })],
      rules: [{ x: 0.5, label: "β = 1/λ_max", dashed: true }] };
  },
  smooth: () => {
    // a path of 8 nodes, +1 at one end and −1 at the other; each layer averages a node with its neighbours
    const n = 8, L = 30; let x = Array.from({ length: n }, (_, i) => (i === 0 ? 1 : i === n - 1 ? -1 : 0));
    const rows = Array.from({ length: n }, () => []);
    for (let l = 0; l <= L; l++) {
      x.forEach((v, i) => rows[i].push([l, v]));
      x = x.map((v, i) => { const nb = [v]; if (i > 0) nb.push(x[i - 1]); if (i < n - 1) nb.push(x[i + 1]); return nb.reduce((a, b) => a + b, 0) / nb.length; });
    }
    return { x: { label: "number of layers l", min: 0, max: L }, y: { label: "node value h_v", min: -1, max: 1 },
      series: rows.map((d, i) => ({ type: "line", data: d, color: i === 0 ? 1 : i === n - 1 ? 2 : "random", label: i === 0 ? "node with +1" : i === n - 1 ? "node with −1" : i === 1 ? "the six others" : null })) };
  },
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
