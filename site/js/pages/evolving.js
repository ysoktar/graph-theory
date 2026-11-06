import "../layout.js";
import { h, figure, stats, slider, select, button, tex, renderMath, debounce, whenVisible } from "../lib/ui.js";
import { Plot, fnSeries } from "../lib/plot.js";
import { ccdf, fitPowerLaw, histogram, fmt } from "../lib/stats.js";
import { RNG } from "../lib/rng.js";
import { run } from "../lib/compute.js";

const C = 1.255; // Bianconi–Barabási constant for uniform fitness on [0, 1] (book Eq. 6.7, Section 6.2)
const PLANTED = [{ t: 10, eta: 0.3 }, { t: 100, eta: 0.6 }, { t: 1000, eta: 1 }];

(async () => {
  if (!document.getElementById("fig-race")) return; // only on the page that shows it
  const N = 50000, m = 2;
  const f = figure("#fig-race", { title: "Late but fit: the race for links", sub: `N = ${fmt.int(N)}, m = 2, fitness η drawn uniformly from [0, 1]; three nodes have their fitness fixed.`, cols: "cols-2" });
  const pa = f.panel("Degree of three planted nodes"), pb = f.panel("P(K ≥ k): fitness model against BA (equal fitness)");
  const t = stats(f.body, [{ key: "g", label: "fitted γ̂, fitness model" }, { key: "gb", label: "fitted γ̂, equal fitness (BA)" }, { key: "hub", label: "the largest hub" }]);
  t.el.style.gridColumn = "1 / -1";
  f.body.prepend(t.el);
  const status = h("div", { class: "status-line" }, "Building…");
  f.controls.append(status);
  const A = new Plot(pa, { height: 280, x: { type: "log", label: "time t (number of nodes)" }, y: { type: "log", label: "degree kᵢ(t)" } });
  const B = new Plot(pb, { height: 280, x: { type: "log", label: "degree k" }, y: { type: "log", label: "P(K ≥ k)" } });
  const fit = await run("fitnessGrowth", { N, m, fitness: "uniform", planted: PLANTED, seed: 3 }).promise;
  status.textContent = "Building the equal-fitness network…";
  const ba = await run("fitnessGrowth", { N, m, fitness: "equal", seed: 3 }).promise;
  status.textContent = "";
  const g1 = fitPowerLaw(fit.hist, { maxCandidates: 80 }), g2 = fitPowerLaw(ba.hist, { maxCandidates: 80 });
  t.set("g", `${g1.gamma.toFixed(2)} ± ${g1.sigma.toFixed(2)}`, `theory ≈ 1 + C = ${(1 + C).toFixed(2)} (with a log correction)`);
  t.set("gb", `${g2.gamma.toFixed(2)} ± ${g2.sigma.toFixed(2)}`, "theory 3");
  t.set("hub", fmt.int(fit.kmax), `node t = ${fit.who}, fitness η = ${fit.whoEta.toFixed(2)}`);
  A.update({
    series: [
      ...PLANTED.map((p, i) => ({ type: "line", data: fit.traj[i], color: i + 1, label: `arrived at t = ${p.t}, η = ${p.eta}` })),
      ...PLANTED.map((p, i) => fnSeries((tt) => m * Math.pow(tt / p.t, p.eta / C), p.t, N, 20, { log: true, color: "theory", dashed: true, legend: i === 0, label: i === 0 ? "m (t/tᵢ)^{η/C}" : undefined, tooltip: false })),
    ],
    xName: "t", yFormat: fmt.int,
  });
  B.update({
    series: [
      { type: "scatter", data: ccdf(fit.hist), color: 1, label: "fitness model", r: 2.6 },
      { type: "scatter", data: ccdf(ba.hist), color: "random", symbol: "square", label: "equal fitness (BA)", r: 2.6 },
    ],
    y: { min: 1e-5 }, xName: "k", yFormat: (v) => fmt.sig(v, 3),
  });
  f.setCaption("Each node's degree grows as a power of time whose exponent β = η/C is set by its fitness, so the fittest node eventually overtakes nodes that arrived much earlier. Single trajectories are noisy; the dashed lines are the averages predicted by the continuum theory. The spread of growth rates broadens the degree distribution: its tail is heavier than BA's.");
})();

// ================================================================== shared: a Fenwick tree for sampling in proportion to weights
class Fenwick {
  constructor(n) { this.n = n; this.t = new Float64Array(n + 1); this.total = 0; this.top = 1 << Math.floor(Math.log2(n)); }
  add(i, d) { this.total += d; for (let x = i + 1; x <= this.n; x += x & -x) this.t[x] += d; }
  /** index i with probability weight_i / total */
  find(r) { let pos = 0; for (let s = this.top; s; s >>= 1) if (pos + s <= this.n && this.t[pos + s] <= r) { pos += s; r -= this.t[pos]; } return Math.min(pos, this.n - 1); }
}

/** Grow a fitness network: N nodes, m links each, Π ∝ η k; returns degrees and fitnesses. */
function growFitness(N, m, sample, rng) {
  const fw = new Fenwick(N), deg = new Int32Array(N), eta = new Float64Array(N);
  const m0 = m + 1;
  for (let i = 0; i < m0; i++) { eta[i] = sample(rng); deg[i] = m; fw.add(i, eta[i] * m); }
  for (let v = m0; v < N; v++) {
    eta[v] = sample(rng);
    for (let j = 0; j < m; j++) { const u = fw.find(rng.random() * fw.total); deg[u]++; fw.add(u, eta[u]); }
    deg[v] = m; fw.add(v, eta[v] * m);
  }
  return { deg, eta };
}

// ================================================================== choose a fitness distribution
const FITNESS = {
  equal: { label: "Equal fitness (the BA model)", tex: "\\rho(\\eta) = \\delta(\\eta - 1)", params: {}, masses: () => [[1, 1]], sample: () => 1 },
  uniform: { label: "Uniform on [0, 1]", tex: "\\rho(\\eta) = 1,\\ 0 \\le \\eta \\le 1", params: {}, dens: () => 1, sample: (r) => r.random() },
  two: { label: "Two classes", tex: "\\rho(\\eta) = (1-q)\\,\\delta(\\eta - a) + q\\,\\delta(\\eta - 1)",
    params: { a: [0.5, 0.05, 0.95, 0.05, "low fitness a"], q: [0.5, 0.05, 0.95, 0.05, "share of fit nodes q"] },
    masses: (p) => [[p.a, 1 - p.q], [1, p.q]], sample: (r, p) => (r.random() < p.q ? 1 : p.a) },
  exponential: { label: "Exponential (as measured on the Web)", tex: "\\rho(\\eta) \\propto e^{-\\lambda \\eta},\\ 0 \\le \\eta \\le 1",
    params: { lambda: [2, 0.5, 20, 0.5, "decay λ"] },
    dens: (e, p) => (p.lambda * Math.exp(-p.lambda * e)) / (1 - Math.exp(-p.lambda)),
    sample: (r, p) => -Math.log(1 - r.random() * (1 - Math.exp(-p.lambda))) / p.lambda },
  zeta: { label: "(1 + ζ)(1 − η)^ζ: very fit nodes are rare", tex: "\\rho(\\eta) = (1+\\zeta)(1-\\eta)^{\\zeta}",
    params: { zeta: [3, 0.1, 10, 0.1, "ζ"] },
    dens: (e, p) => (1 + p.zeta) * Math.pow(1 - e, p.zeta), sample: (r, p) => 1 - Math.pow(r.random(), 1 / (1 + p.zeta)) },
};

/** Φ(C) = ∫ ρ(η) η/(C − η) dη, integrated in s = −ln(1 − η) so that the region near η = 1 is resolved. */
function selfConsistency(d, p, C) {
  let v = 0;
  for (const [e, w] of d.masses ? d.masses(p) : []) v += e >= C ? Infinity : (w * e) / (C - e);
  if (d.dens) {
    const S = 60, n = 6000, hS = S / n;
    let acc = 0;
    for (let i = 0; i <= n; i++) {
      const s = i * hS, u = Math.exp(-s), e = 1 - u; // dη = u ds
      const f = (d.dens(e, p) * e * u) / (C - 1 + u);
      acc += (i === 0 || i === n ? 1 : i % 2 ? 4 : 2) * f;
    }
    v += (acc * hS) / 3;
  }
  return v;
}

fig_fitness: {
  if (!document.getElementById("fig-fitness")) break fig_fitness; // only on the page that shows it
  const f = figure("#fig-fitness", { title: "Choose a fitness distribution", sub: "Solve the self-consistency equation for C, read off the growth exponents and the phase, and grow a network with that ρ(η).", cols: "cols-2" });
  const left = f.panel("Fitness distribution ρ(η)"), right = f.panel("Solving for C: where the curve crosses 1");
  const formula = h("div", { class: "small", style: { margin: "0 0 .4rem" } });
  left.append(formula);
  const rhoPlot = new Plot(left, { height: 220, x: { label: "fitness η", min: 0, max: 1 }, y: { label: "ρ(η)", min: 0 }, legend: false });
  const cPlot = new Plot(right, { height: 220, x: { label: "C", min: 1, max: 2.2 }, y: { label: "∫ρ(η) η/(C − η) dη", min: 0, max: 3 } });
  const t = stats(f.body, [{ key: "C", tex: "C", hl: true }, { key: "beta", tex: "\\beta = \\eta/C", label: "range" }, { key: "gamma", tex: "\\gamma \\approx 1 + C" }, { key: "phase", label: "phase", hl: true }, { key: "share", label: "theory: share of new links condensed" }]);
    t.el.style.gridColumn = "1 / -1";
  Object.assign(t.tile("phase").querySelector(".stat-value").style, { whiteSpace: "normal", overflow: "visible", textOverflow: "clip" });
  const sim = f.panel("A grown network (N = 20,000, m = 2) against BA");
  sim.style.gridColumn = "1 / -1";
  const simPlot = new Plot(sim, { height: 250, x: { type: "log", label: "degree k" }, y: { type: "log", label: "P(K ≥ k)" } });
  const ts = stats(sim, [{ key: "hub", label: "largest hub's share of links (simulated)" }, { key: "fit", label: "fitness of the largest hub" }]);
  const paramHost = h("div", { class: "fig-controls", style: { padding: 0 } });
  let type = "uniform", params = {}, seed = 1, simTimer = 0;
  const run = debounce(update, 120);
  function paramControls() {
    paramHost.replaceChildren();
    params = {};
    for (const [key, [val, lo, hi, step, label]] of Object.entries(FITNESS[type].params)) {
      params[key] = val;
      slider(paramHost, { label, min: lo, max: hi, step, value: val, format: (v) => v.toFixed(step < 0.1 ? 2 : 1), onInput: (v) => { params[key] = v; run(); } });
    }
    tex(formula, FITNESS[type].tex);
  }
  function update() {
    const d = FITNESS[type];
    // ρ(η)
    const series = [];
    if (d.dens) { const pts = []; for (let i = 0; i <= 200; i++) { const e = Math.min(i / 200, 0.9999); pts.push([e, d.dens(e, params)]); } series.push({ type: "area", data: pts, color: 1 }); }
    for (const [e, w] of d.masses ? d.masses(params) : []) series.push({ type: "line", markers: true, data: [[e, 0], [e, w]], color: 1 });
    rhoPlot.update({ series, y: { max: d.dens ? undefined : 1 } });
    // Φ(C) and its crossing with 1
        // ρ(1) > 0 (a point mass or a density that does not vanish at η = 1) makes I diverge: never condensed
    const atOne = (d.masses && d.masses(params).some(([e, w]) => e >= 1 && w > 0)) || (d.dens && d.dens(1, params) > 0);
    const I = atOne ? Infinity : selfConsistency(d, params, 1);
    let C = 1, marginal = false;
    if (I > 1) {
      let lo = 1 + 1e-9, hi = 2.5;
      if (selfConsistency(d, params, lo) <= 1) { marginal = true; C = lo; } // the root lies within 10⁻⁹ of 1
      else { for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (selfConsistency(d, params, mid) > 1) lo = mid; else hi = mid; } C = (lo + hi) / 2; }
    }
    const curve = [];
    for (let i = 0; i <= 80; i++) { const c = 1.0005 + (1.2 * i) / 80; curve.push([c, Math.min(3, selfConsistency(d, params, c))]); }
    const condensed = I <= 1;
    cPlot.update({ series: [{ type: "line", data: curve, color: 2, label: "∫ρ(η) η/(C − η) dη" }],
      rules: [{ y: 1, label: "= 1", dashed: true }, condensed ? { x: 1, label: "stuck at C = η_max" } : { x: C, label: `C = ${C.toFixed(3)}` }] });
    let emin = 1; for (const [e] of d.masses ? d.masses(params) : []) emin = Math.min(emin, e); if (d.dens) emin = 0;
    t.set("C", C.toFixed(3), condensed ? "C = η_max: no solution above 1" : marginal ? "C − 1 < 10⁻⁹: on the edge of condensing" : "solution of the equation");
    t.set("beta", `${(emin / C).toFixed(2)} – ${(1 / C).toFixed(2)}`, "BA: 0.50 for every node");
    t.set("gamma", condensed ? "–" : (1 + C).toFixed(2), condensed ? "not scale-free" : type === "uniform" ? "with a 1/ln k correction" : "set by the fittest nodes");
    t.set("phase", condensed ? "condensed" : "fit-get-rich", condensed ? "winner-takes-all" : "scale-free");
    t.set("share", condensed ? fmt.pct(1 - I, 0) : "0%", `I = ∫ηρ/(1 − η) dη = ${Number.isFinite(I) && I < 1e3 ? I.toFixed(2) : "∞"}`);
    renderMath(f.body);
    clearTimeout(simTimer);
    simTimer = setTimeout(simulate, 30);
  }
  function simulate() {
    const N = 20000, m = 2, d = FITNESS[type];
    const rng = new RNG(seed);
    const { deg, eta } = growFitness(N, m, (r) => d.sample(r, params), rng);
    const ba = growFitness(N, m, () => 1, new RNG(seed + 1000));
    const hf = histogram(Array.from(deg)), hb = histogram(Array.from(ba.deg));
    let kmax = 0, who = 0; for (let i = 0; i < N; i++) if (deg[i] > kmax) { kmax = deg[i]; who = i; }
    simPlot.update({ series: [{ type: "scatter", data: ccdf(hf), color: 1, r: 2.6, label: "this ρ(η)" }, { type: "scatter", data: ccdf(hb), color: "random", symbol: "square", r: 2.4, label: "equal fitness (BA)" }], y: { min: 1 / N } });
    ts.set("hub", fmt.pct(kmax / (2 * m * N), 1), `k_max = ${fmt.int(kmax)}, arrived at t = ${fmt.int(who)}`);
    ts.set("fit", eta[who].toFixed(2), `fittest node: η = ${Math.max(...eta).toFixed(2)}`);
  }
  select(f.controls, { label: "Fitness distribution", value: type, options: Object.entries(FITNESS).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => { type = v; paramControls(); update(); } });
  f.controls.append(paramHost);
  button(f.controls, { label: "Rerun", icon: "dice", onClick: () => { seed++; simulate(); } });
  paramControls();
  whenVisible(f.el, update);
  f.setCaption("The curve always falls with C. If it crosses 1 above C = 1, that C sets every growth exponent and the network is fit-get-rich. If it lies below 1 even at C = 1, the equation has no solution: the network condenses, and the shortfall 1 − I is the share of new links that goes to the fittest nodes. Try ζ just below and above 1. In the simulation the largest hub's share stays small in both phases: the condensed share is spread over a succession of very fit latecomers, as later mathematics proved (see below).");
}

// ================================================================== citation histories (Eq. 6.13)
fig_cite: {
  if (!document.getElementById("fig-cite")) break fig_cite; // only on the page that shows it
  const erf = (x) => { const s = Math.sign(x), a = Math.abs(x), t = 1 / (1 + 0.3275911 * a); return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a)); };
  const Phi = (x) => 0.5 * (1 + erf(x / Math.SQRT2));
  const M = 30;
  const cite = (t, eta, mu, sigma) => M * (Math.exp(eta * Phi((Math.log(t) - mu) / sigma)) - 1);
  const f = figure("#fig-cite", { title: "The citation history of a paper", sub: "Equation (6.13) with m = 30. The dashed curve is a reference paper with η′ = 2, μ = 1, σ = 1 (time in years).", cols: "split" });
  const left = f.panel(null), right = f.panel(null);
  const plot = new Plot(left, { height: 260, x: { label: "years after publication", min: 0, max: 30 }, y: { label: "citations so far", min: 0 } });
  const t = stats(right, [{ key: "inf", tex: "c^\\infty = m(e^{\\eta'} - 1)", label: "", hl: true }, { key: "c2", label: "after 2 years" }, { key: "c10", label: "after 10 years" }, { key: "peak", label: "most citations per year in year" }]);
  let eta = 2.5, mu = 1, sigma = 1;
  function draw() {
    const pts = [], ref = [];
    for (let i = 1; i <= 300; i++) { const y = i / 10; pts.push([y, cite(y, eta, mu, sigma)]); ref.push([y, cite(y, 2, 1, 1)]); }
    const inf = M * (Math.exp(eta) - 1);
    plot.update({ series: [{ type: "line", data: pts, color: 1, label: "this paper" }, { type: "line", data: ref, color: "random", dashed: true, label: "reference paper" }], rules: [{ y: inf, label: "c^∞", dashed: true }], y: { max: Math.max(inf, M * (Math.E ** 2 - 1)) * 1.08 } });
    let best = 1, bestRate = -1; for (let y = 1; y <= 30; y++) { const r = cite(y, eta, mu, sigma) - cite(Math.max(y - 1, 1e-6), eta, mu, sigma); if (r > bestRate) { bestRate = r; best = y; } }
    t.set("inf", fmt.int(inf)); t.set("c2", fmt.int(cite(2, eta, mu, sigma))); t.set("c10", fmt.int(cite(10, eta, mu, sigma))); t.set("peak", String(best));
  }
  slider(f.controls, { label: "relative fitness η′", min: 0.5, max: 4, step: 0.1, value: eta, format: (v) => v.toFixed(1), onInput: (v) => { eta = v; draw(); } });
  slider(f.controls, { label: "immediacy μ", min: -1, max: 3, step: 0.1, value: mu, format: (v) => v.toFixed(1), onInput: (v) => { mu = v; draw(); } });
  slider(f.controls, { label: "longevity σ", min: 0.2, max: 2, step: 0.1, value: sigma, format: (v) => v.toFixed(1), onInput: (v) => { sigma = v; draw(); } });
  draw();
  f.setCaption("Fitness alone sets where the curve ends: c^∞ = m(exp(η′) − 1) does not depend on μ or σ. Immediacy and longevity only decide how fast it gets there. That is why the ultimate impact of a paper can be predicted from its early citations once its three parameters are fitted.");
}

// ================================================================== add one process to BA
const PROCESSES = {
  attract: { label: "Initial attractiveness, Π ∝ A + k", param: ["A", -1.5, 10, 0.5, 4], gamma: (A, m) => 3 + A / m, tex: "\\gamma = 3 + A/m" },
  double: { label: "Internal links, double preferential", param: ["internal links per step n", 0, 6, 1, 2], gamma: (n, m) => 2 + m / (m + 2 * n), tex: "\\gamma = 2 + \\frac{m}{m + 2n}" },
  random: { label: "Internal links, random", param: ["internal links per step n", 0, 4, 1, 1], gamma: (n, m) => 3 + (2 * n) / m, tex: "\\gamma = 3 + \\frac{2n}{m}" },
  deletion: { label: "Node deletion at rate r", param: ["deletion rate r", 0, 0.8, 0.05, 0.4], gamma: (r) => 3 + (2 * r) / (1 - r), tex: "\\gamma = 3 + \\frac{2r}{1-r}" },
  accel: { label: "Accelerated growth, m(t) = t^θ", param: ["θ", 0, 0.6, 0.05, 0.3], gamma: (th) => 3 + (2 * th) / (1 - th), tex: "\\gamma = 3 + \\frac{2\\theta}{1-\\theta}" },
  aging: { label: "Aging, Π ∝ k (t − tᵢ)^−ν", param: ["aging exponent ν", -2, 1.5, 0.25, 0.5], gamma: null, tex: "\\Pi \\propto k\\,(t - t_i)^{-\\nu}" },
};

/** Simulate BA (m = 2) with one extra process; returns the degrees of the surviving nodes. */
function simulateProcess(kind, x, rng) {
  const m = 2;
  if (kind === "aging") {
    const N = 3000, deg = new Float64Array(N), w = new Float64Array(N);
    deg[0] = deg[1] = deg[2] = 2;
    for (let v = 3; v < N; v++) {
      let tot = 0;
      for (let i = 0; i < v; i++) { w[i] = deg[i] * Math.pow(v - i, -x); tot += w[i]; }
      for (let j = 0; j < m; j++) {
        let r = rng.random() * tot, i = 0;
        while (i < v - 1 && r >= w[i]) { r -= w[i]; i++; }
        deg[i]++;
      }
      deg[v] = m;
    }
    return { deg: Array.from(deg), N };
  }
  const T = kind === "accel" ? 5000 : 20000;
  const fw = new Fenwick(T + 3), deg = new Int32Array(T + 3), alive = new Uint8Array(T + 3);
  const A = kind === "attract" ? x : 0;
  const adj = kind === "deletion" ? Array.from({ length: T + 3 }, () => []) : null;
  const live = [], where = new Int32Array(T + 3);
  const join = (a, b) => { deg[a]++; deg[b]++; fw.add(a, 1); fw.add(b, 1); if (adj) { adj[a].push(b); adj[b].push(a); } };
  for (let i = 0; i < 3; i++) { alive[i] = 1; where[i] = live.length; live.push(i); fw.add(i, A); }
  join(0, 1); join(1, 2); join(0, 2);
  for (let v = 3; v < T + 3; v++) {
    const mm = kind === "accel" ? (() => { const y = Math.pow(v, x); return Math.floor(y) + (rng.random() < y - Math.floor(y) ? 1 : 0); })() : m;
    const targets = [];
    for (let j = 0; j < mm; j++) { const u = fw.find(rng.random() * fw.total); if (alive[u]) targets.push(u); }
    alive[v] = 1; where[v] = live.length; live.push(v); fw.add(v, A);
    for (const u of targets) join(v, u);
    if (kind === "double" || kind === "random") {
      for (let j = 0; j < x; j++) {
        let a, b, tries = 0;
        do { a = kind === "double" ? fw.find(rng.random() * fw.total) : rng.int(v + 1); b = kind === "double" ? fw.find(rng.random() * fw.total) : rng.int(v + 1); } while (a === b && ++tries < 20);
        if (a !== b) join(a, b);
      }
    }
    if (kind === "deletion" && rng.random() < x && live.length > 3) {
      const j = rng.int(live.length), z = live[j];
      for (const y of adj[z]) if (alive[y]) { deg[y]--; fw.add(y, -1); }
      fw.add(z, -deg[z]); deg[z] = 0; alive[z] = 0; adj[z] = [];
      const last = live.pop(); if (last !== z) { live[j] = last; where[last] = j; }
    }
  }
  return { deg: live.map((i) => deg[i]), N: live.length };
}

fig_process: {
  if (!document.getElementById("fig-process")) break fig_process; // only on the page that shows it
  const f = figure("#fig-process", { title: "Add one process to the BA model", sub: "Each run grows a network with m = 2 and one extra process, and compares it with plain BA grown the same way.", cols: "split" });
  const left = f.panel(null), right = f.panel(null);
  const plot = new Plot(left, { height: 290, x: { type: "log", label: "degree k" }, y: { type: "log", label: "P(K ≥ k)" } });
  const formula = h("div", { class: "small", style: { margin: "0 0 .5rem" } });
  right.append(formula);
  const t = stats(right, [{ key: "pred", tex: "\\gamma", label: "predicted (large N)", hl: true }, { key: "fit", tex: "\\hat\\gamma", label: "fitted to this network" }, { key: "n", label: "nodes" }, { key: "k", tex: "\\langle k\\rangle" }]);
  const status = h("div", { class: "status-line" });
  let kind = "attract", x = PROCESSES.attract.param[4], seed = 3, ctl = null, timer = 0;
  const host = h("div", { class: "fig-controls", style: { padding: 0 } });
  let baCache = null;
  function controls() {
    host.replaceChildren();
    const [label, lo, hi, step, val] = PROCESSES[kind].param;
    x = val;
    ctl = slider(host, { label, min: lo, max: hi, step, value: val, format: (v) => (step >= 1 ? String(v) : v.toFixed(2)), onInput: (v) => { x = v; schedule(); } });
    tex(formula, PROCESSES[kind].tex);
  }
  function schedule() { status.textContent = "Growing…"; clearTimeout(timer); timer = setTimeout(draw, 150); }
  function draw() {
    const p = PROCESSES[kind];
    const res = simulateProcess(kind, x, new RNG(seed));
    if (!baCache) baCache = simulateProcess("attract", 0, new RNG(seed + 99));
    const deg = res.deg.filter((k) => k > 0), h1 = histogram(deg), c1 = ccdf(h1);
    const fit = fitPowerLaw(h1, { maxCandidates: 60 });
    const series = [{ type: "scatter", data: c1, color: 1, r: 2.6, label: "with the process" }, { type: "scatter", data: ccdf(histogram(baCache.deg)), color: "random", symbol: "square", r: 2.2, label: "plain BA" }];
    const g = p.gamma ? p.gamma(x, 2) : null;
    if (g) {
      const k0 = Math.max(fit.kmin, 4), y0 = c1.find((d) => d[0] >= k0)?.[1];
      if (y0) series.push(fnSeries((k) => y0 * Math.pow(k / k0, -(g - 1)), k0, c1[c1.length - 1][0], 30, { log: true, color: "theory", dashed: true, label: `slope −(γ − 1), γ = ${g.toFixed(2)}` }));
    }
    plot.update({ series, y: { min: 1 / deg.length } });
    t.set("pred", g ? g.toFixed(2) : "no formula", g ? "" : x < 0 ? "below 3 (old nodes favoured)" : x < 1 ? "above 3, diverging as ν → 1" : "no power law");
    t.set("fit", `${fit.gamma.toFixed(2)} ± ${fit.sigma.toFixed(2)}`, `k ≥ ${fit.kmin}`);
    t.set("n", fmt.int(deg.length));
    t.set("k", fmt.fix(deg.reduce((a, b) => a + b, 0) / deg.length, 2));
    status.textContent = "";
    renderMath(right);
  }
  select(f.controls, { label: "Process", value: kind, options: Object.entries(PROCESSES).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => { kind = v; controls(); schedule(); } });
  f.controls.append(host);
  button(f.controls, { label: "Rerun", icon: "dice", onClick: () => { seed++; baCache = null; schedule(); } });
  f.controls.append(status);
  controls();
  whenVisible(f.el, draw);
  f.setCaption("Processes that give the large an extra advantage (double preferential internal links, negative ν) flatten the tail; random ingredients (A, random internal links, deletion, faster growth, positive ν) steepen it. The predicted γ is the large-N limit: fits to 20,000 nodes come out lower for steep tails, because pₖ approaches its asymptotic slope slowly (for deletion with r = 0.5 the exact solution's local slope is about 4 at k = 30 and reaches 5 only near k = 1,000). Aging runs on 3,000 nodes, accelerated growth on 5,000.");
}
