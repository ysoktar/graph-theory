import "../layout.js";
import { h, figure, slider, segmented, button, stats, ICONS, whenVisible, debounce } from "../lib/ui.js";
import { NetView } from "../lib/netview.js";
import { Plot, fnSeries } from "../lib/plot.js";
import { RNG } from "../lib/rng.js";
import { Graph, barabasiAlbert, gnm, distanceSample, clusteringSummary } from "../lib/graph.js";
import { ccdf, fitPowerLaw, fmt, histogram, pkLogBinned, logLogFit } from "../lib/stats.js";
import { run } from "../lib/compute.js";

/** Exact BA degree distribution (book Eq. 5.11, Section 5.5; derived in Advanced Topic 5.A): p_k = 2m(m+1) / (k(k+1)(k+2)), k ≥ m. */
const baPk = (k, m) => (2 * m * (m + 1)) / (k * (k + 1) * (k + 2));
const baSf = (k, m) => (m * (m + 1)) / (k * (k + 1)); // P(K ≥ k)

// ------------------------------------------------------------------ 1. watch it grow
fig_grow: {
  if (!document.getElementById("fig-grow")) break fig_grow; // only on the page that shows it
  const m = 2, Nmax = 300;
  let attach = "preferential", g, repeated, rng, timer = null, lastTargets = [];
  const f = figure("#fig-grow", { title: "Growth with preferential attachment", sub: "Each new node brings m = 2 links. It links to an existing node with probability proportional to that node's degree (or uniformly, for comparison).", cols: "split" });
  const pn = f.panel(null), pr = f.panel(null);
  const nv = new NetView(pn, {
    height: 400, charge: -22, linkDistance: 16, gravity: 0.09,
    nodeRadius: (i) => 2 + 1.25 * Math.sqrt(g.degree(i)),
    nodeColor: (i) => (i === g.n - 1 ? "s2" : lastTargets.includes(i) ? "s4" : i < 3 ? "s7" : "s1"),
    edgeColor: (u, v) => ((u === g.n - 1 || v === g.n - 1) ? "s2" : "axis"),
    tooltip: (i) => `node ${i} (arrived at t = ${i}): degree ${g.degree(i)}`,
    legend: [{ label: "newest node", color: "s2" }, { label: "its targets", color: "s4" }, { label: "the first three nodes", color: "s7" }],
  });
  const t = stats(pr, [{ key: "N", label: "nodes" }, { key: "kmax", label: "largest degree" }, { key: "who", label: "the largest hub arrived at" }, { key: "share", label: "links held by the oldest 10%" }]);
  const plot = new Plot(pr, { height: 200, x: { type: "log", label: "k" }, y: { type: "log", label: "P(K ≥ k)" } });
  function reset() {
    rng = new RNG(7);
    g = new Graph(3); repeated = [];
    for (const [u, v] of [[0, 1], [1, 2], [0, 2]]) { g.addEdge(u, v); repeated.push(u, v); }
    lastTargets = [];
    nv.setGraph(g, { keep: false });
    paint();
  }
  function add() {
    if (g.n >= Nmax) { stop(); return; }
    const v = g.addNode(), targets = new Set();
    while (targets.size < m) targets.add(attach === "preferential" ? repeated[rng.int(repeated.length)] : rng.int(v));
    for (const u of targets) { g.addEdge(v, u); repeated.push(v, u); }
    lastTargets = [...targets];
    nv.setGraph(g, { keep: true, alpha: 0.25 });
    paint();
  }
  function paint() {
    const deg = g.degrees();
    let kmax = 0, who = 0, old = 0;
    for (let i = 0; i < g.n; i++) { if (deg[i] > kmax) { kmax = deg[i]; who = i; } if (i < g.n / 10) old += deg[i]; }
    t.set("N", g.n); t.set("kmax", kmax, `√N·m ≈ ${(m * Math.sqrt(g.n)).toFixed(0)}`); t.set("who", `t = ${who}`); t.set("share", fmt.pct(old / (2 * g.m), 0));
    const hist = new Map();
    for (const d of deg) hist.set(d, (hist.get(d) || 0) + 1);
    const ks = [...hist.keys()].sort((a, b) => a - b);
    plot.update({ series: [{ type: "scatter", data: ccdf({ k: ks, count: ks.map((k) => hist.get(k)) }), color: 1, label: "this network", r: 3 }, fnSeries((k) => baSf(k, m), m, Math.max(10, kmax), 30, { log: true, color: "theory", dashed: true, label: "BA theory, γ = 3", tooltip: false })], xName: "k", yFormat: (v) => fmt.sig(v, 3) });
  }
  function stop() { if (timer) { clearInterval(timer); timer = null; playBtn.innerHTML = ICONS.play + " Grow"; } }
  const row = h("div", { class: "btn-row" });
  f.controls.append(row);
  const playBtn = button(row, { label: "Grow", icon: "play", onClick: () => { if (timer) stop(); else { timer = setInterval(add, 90); playBtn.innerHTML = ICONS.pause + " Pause"; } } });
  button(row, { label: "Add one node", icon: "step", onClick: () => { stop(); add(); } });
  button(row, { label: "Restart", icon: "reset", onClick: () => { stop(); reset(); } });
  segmented(f.controls, { label: "Attachment", value: attach, options: [{ value: "preferential", label: "preferential, Π(k) ∝ k" }, { value: "uniform", label: "uniform (no preference)" }], onChange: (v) => { attach = v; stop(); reset(); } });
  reset();
  for (let i = 0; i < 60; i++) add();
  f.setCaption("Preferential attachment is implemented by picking a random end of a random existing link: a node with k links is k times as likely to be picked. Early nodes have had the longest time to collect links, and the rich get richer.");
}

// ------------------------------------------------------------------ 2. large networks (worker)
(async () => {
  if (!document.getElementById("fig-pk")) return; // only on the page that shows it
  let m = 2, job = null;
  const f = figure("#fig-pk", { title: "Degree distribution of a large network", sub: "N = 100,000 nodes.", cols: "cols-2" });
  const pa = f.panel("P(K ≥ k)"), pb = f.panel("Degree of three nodes as the network grows");
  const t = stats(f.body, [{ key: "g", label: "fitted γ̂ (preferential)" }, { key: "kmax", label: "largest degree" }]);
  t.el.style.gridColumn = "1 / -1";
  f.body.prepend(t.el);
  const status = h("div", { class: "status-line" });
  f.controls.append(status);
  const A = new Plot(pa, { height: 260, x: { type: "log", label: "degree k" }, y: { type: "log", label: "P(K ≥ k)" } });
  const B = new Plot(pb, { height: 260, x: { type: "log", label: "time t (number of nodes)" }, y: { type: "log", label: "degree kᵢ(t)" } });
  async function go() {
    if (job) job.cancel();
    status.textContent = "Building…";
    const N = 100000;
    job = run("baDegrees", { N, m, attachment: "preferential", seed: 2 });
    let pref;
    try { pref = await job.promise; } catch { return; }
    job = run("baDegrees", { N, m, attachment: "uniform", seed: 2 });
    let uni;
    try { uni = await job.promise; } catch { return; }
    job = null;
    status.textContent = "";
    const fit = fitPowerLaw(pref.hist, { maxCandidates: 60 });
    t.set("g", `${fit.gamma.toFixed(2)} ± ${fit.sigma.toFixed(2)}`, `k_min = ${fit.kmin}`); t.set("kmax", fmt.int(pref.kmax), `uniform: ${uni.kmax}`);
    A.update({
      series: [
        { type: "scatter", data: ccdf(pref.hist), color: 1, label: "preferential attachment", r: 2.6 },
        { type: "scatter", data: ccdf(uni.hist), color: 2, symbol: "diamond", label: "uniform attachment", r: 2.6 },
        fnSeries((k) => baSf(k, m), m, pref.kmax, 40, { log: true, color: "theory", dashed: true, label: "BA theory m(m+1)/(k(k+1))", tooltip: false }),
        fnSeries((k) => Math.pow(m / (m + 1), k - m), m, 60, 40, { color: "theory", thin: true, label: "uniform theory (m/(m+1))^{k−m}", tooltip: false }),
      ],
      y: { min: 1e-5 }, xName: "k", yFormat: (v) => fmt.sig(v, 3),
    });
    B.update({
      series: [
        ...pref.tracked.map((ti, i) => ({ type: "line", data: pref.traj[i], color: i + 1, label: `node arriving at t = ${ti}` })),
        ...pref.tracked.map((ti, i) => fnSeries((tt) => m * Math.sqrt(tt / ti), ti, N, 20, { log: true, color: "theory", dashed: true, legend: i === 0, label: i === 0 ? "m (t/tᵢ)^{1/2}" : undefined, tooltip: false })),
      ],
      xName: "t", yFormat: (v) => fmt.int(v),
    });
  }
  slider(f.controls, { label: "links per new node m", min: 1, max: 6, step: 1, value: m, onChange: (v) => { m = v; go(); } });
  go();
  f.setCaption("With preferential attachment the CCDF follows the exact result with slope −2, that is γ = 3, independent of m (the fitted γ̂ comes out slightly below 3 at this size because the exact pₖ only approaches k^−3 for large k). Without it the tail is exponential and no hubs form. Every node's degree grows like the square root of time, so the oldest nodes are the largest hubs.");
})();

// ================================================================== growth engine for the figures below
/** Fenwick tree over node weights, for sampling a node with probability ∝ weight in O(log N). */
class Fenwick {
  constructor(n) { this.n = n; this.t = new Float64Array(n + 1); this.w = new Float64Array(n); this.total = 0; }
  set(i, w) { const d = w - this.w[i]; this.w[i] = w; this.total += d; for (let j = i + 1; j <= this.n; j += j & -j) this.t[j] += d; }
  sample(u) { let x = u * this.total, pos = 0; for (let step = 1 << Math.floor(Math.log2(this.n)); step; step >>= 1) { const nx = pos + step; if (nx <= this.n && this.t[nx] < x) { pos = nx; x -= this.t[nx]; } } return Math.min(pos, this.n - 1); }
}
/**
 * Grow a network to N nodes, m links per new node, attaching with probability ∝ k^alpha (alpha = 0: Model A).
 * Records each node's degree at log-spaced times for `track`, the largest degree over time, and the degrees
 * at time `snap` (for measuring preferential attachment from two snapshots, Section 5.7).
 */
function grow(N, m, alpha, rng, { track = [], snap = 0 } = {}) {
  const deg = new Int32Array(N), fw = new Fenwick(N), traj = track.map(() => []), kmaxT = [];
  const weight = (k) => (alpha === 0 ? 1 : Math.pow(k, alpha));
  const m0 = m + 1;
  for (let u = 0; u < m0; u++) for (let v = u + 1; v < m0; v++) { deg[u]++; deg[v]++; }
  for (let u = 0; u < m0; u++) fw.set(u, weight(deg[u]));
  let kmax = m, snapDeg = null, nextLog = m0;
  for (let t = m0; t < N; t++) {
    const targets = new Set();
        // distinct targets; with strongly superlinear attachment one hub holds almost all the weight, so give up after a few tries
    for (let tries = 0; targets.size < Math.min(m, t) && tries < 60; tries++) targets.add(fw.sample(rng.random()));
    for (const v of targets) { deg[v]++; fw.set(v, weight(deg[v])); if (deg[v] > kmax) kmax = deg[v]; }
    deg[t] = targets.size; fw.set(t, weight(deg[t]));
    if (t + 1 >= nextLog || t === N - 1) { kmaxT.push([t + 1, kmax]); track.forEach((ti, j) => { if (t >= ti) traj[j].push([t + 1, deg[ti]]); }); nextLog = Math.ceil((t + 1) * 1.08); }
    if (snap && t + 1 === snap) snapDeg = deg.slice(0, snap);
  }
  return { deg, traj, kmaxT, snapDeg };
}
/** Model B (Section 5.6): N nodes, no growth; each step a random node links to a node chosen ∝ k (k = 0 counts as 1). */
function modelB(N, steps, rng, snaps, track) {
  const deg = new Int32Array(N), fw = new Fenwick(N), out = {}, traj = track.map(() => []);
  for (let i = 0; i < N; i++) fw.set(i, 1);
  let next = 1;
  for (let s = 1; s <= steps; s++) {
    const a = rng.int(N); let b = fw.sample(rng.random()); if (b === a) b = fw.sample(rng.random());
    deg[a]++; deg[b]++; fw.set(a, Math.max(1, deg[a])); fw.set(b, Math.max(1, deg[b]));
    if (snaps.includes(s)) out[s] = deg.slice();
    if (s >= next) { track.forEach((i, j) => traj[j].push([s, deg[i]])); next = Math.ceil(s * 1.1); }
  }
  return { out, traj };
}
const binnedPk = (deg) => pkLogBinned(histogram(Array.from(deg).filter((k) => k > 0)), 6);

// ================================================================== Models A and B against BA
fig_models: {
  if (!document.getElementById("fig-models")) break fig_models; // only on the page that shows it
  const f = figure("#fig-models", { title: "Remove one ingredient", sub: "The BA model, Model A (growth, no preferential attachment) and Model B (preferential attachment, no growth).", cols: "cols-2" });
  const left = f.panel("Degree distribution"), right = f.panel("Degree of three nodes over time");
  const pk = new Plot(left, { height: 250, x: { type: "log", label: "degree k" }, y: { type: "log", label: "pₖ" } });
  const tr = new Plot(right, { height: 250, x: { type: "log", label: "time t" }, y: { type: "log", label: "degree kᵢ(t)" } });
  let model = "ba", seed = 1;
  function draw() {
    const rng = new RNG(seed), m = 2;
    if (model === "b") {
      const N = 1000, snaps = [N, 5 * N, 40 * N], track = [0, 1, 2];
      const { out, traj } = modelB(N, 40 * N, rng, snaps, track);
      pk.update({ series: snaps.map((s, i) => ({ type: "line", markers: true, data: binnedPk(out[s]), color: i + 1, label: `t = ${fmt.int(s)} links` })) });
      tr.update({ series: [...traj.map((d, i) => ({ type: "line", data: d, color: i + 1, label: `node ${i}` })), fnSeries((t) => (2 * t) / N, 100, 40 * N, 40, { log: true, color: "theory", dashed: true, label: "2t/N" })] });
      f.setCaption("Without growth the distribution never settles: early on it has a tail, but as links keep arriving every degree approaches 2t/N and pₖ develops a peak that moves right, until the network is complete. There is no stationary state.");
      return;
    }
    const N = 10000, track = [10, 100, 1000];
    const { deg, traj } = grow(N, m, model === "ba" ? 1 : 0, rng, { track });
    const theoryPk = model === "ba" ? fnSeries((k) => baPk(k, m), m, 2000, 60, { log: true, color: "theory", dashed: true, label: "2m(m+1)/(k(k+1)(k+2))" })
      : fnSeries((k) => (Math.E / m) * Math.exp(-k / m), m, 40, 60, { log: true, color: "theory", dashed: true, label: "(e/m) e^(−k/m)" });
    pk.update({ series: [{ type: "scatter", data: binnedPk(deg), color: 1, r: 4.5, label: model === "ba" ? "BA" : "Model A" }, theoryPk] });
    tr.update({ series: [...traj.map((d, i) => ({ type: "line", data: d, color: i + 1, label: `arrived at t = ${track[i]}` })),
      ...track.map((ti, i) => fnSeries((t) => (model === "ba" ? m * Math.sqrt(t / ti) : m * Math.log((Math.E * t) / ti)), ti, N, 40, { log: true, color: "theory", dashed: true, label: i ? null : model === "ba" ? "m (t/tᵢ)^½" : "m ln(e t/tᵢ)" }))] });
    f.setCaption(model === "ba" ? "Both ingredients: a stationary power law with γ = 3, and every node growing as the square root of time, so the oldest stay largest." : "Growth alone: each node's degree grows only logarithmically and pₖ falls exponentially (the dashed line is the continuum result). No hubs form, because nothing makes the rich richer.");
  }
  segmented(f.controls, { label: "Model", value: model, options: [{ value: "ba", label: "BA: growth + preference" }, { value: "a", label: "Model A: growth only" }, { value: "b", label: "Model B: preference only" }], onChange: (v) => { model = v; draw(); } });
  button(f.controls, { label: "Rerun", icon: "dice", onClick: () => { seed++; draw(); } });
  whenVisible(f.el, draw);
}

// ================================================================== nonlinear preferential attachment and how to measure it
fig_alpha: {
  if (!document.getElementById("fig-alpha")) break fig_alpha; // only on the page that shows it
  const N = 6000, m = 2, T1 = 4800;
  const f = figure("#fig-alpha", { title: "Nonlinear preferential attachment, Π(k) ∝ k^α", sub: `Networks of ${fmt.int(N)} nodes, m = 2. Right: the attachment measured from two snapshots of the same network (t = ${fmt.int(T1)} and t = ${fmt.int(N)}), as for real data.`, cols: "cols-2" });
  const left = f.panel("Degree distribution and the largest hub"), right = f.panel("Measured cumulative attachment π(k)");
  const pk = new Plot(left, { height: 220, x: { type: "log", label: "degree k" }, y: { type: "log", label: "pₖ" } });
  const km = new Plot(left, { height: 200, x: { type: "log", label: "time t (nodes)" }, y: { type: "log", label: "largest degree k_max" } });
  const pi = new Plot(right, { height: 300, x: { type: "log", label: "degree k at the first snapshot" }, y: { type: "log", label: "π(k)" } });
  const t = stats(right, [{ key: "share", label: "links of the largest hub" }, { key: "regime", label: "regime" }, { key: "fit", tex: "\\hat\\alpha", label: "from the slope of π(k), minus 1", hl: true }]);
  let alpha = 1, seed = 4;
  function draw() {
    const rng = new RNG(seed);
    const { deg, kmaxT, snapDeg } = grow(N, m, alpha, rng, { snap: T1 });
    // Π(k): average new links gained by the nodes that had degree k at the first snapshot; π(k) = cumulative sum
    const gain = new Map();
    for (let i = 0; i < T1; i++) { const k = snapDeg[i], g = gain.get(k) || [0, 0]; g[0] += deg[i] - k; g[1]++; gain.set(k, g); }
    const ks = [...gain.keys()].sort((a, b) => a - b);
    let cum = 0; const piPts = [];
    for (const k of ks) { const [s, n] = gain.get(k); cum += s / n; if (cum > 0) piPts.push([k, cum]); }
    const top = piPts[piPts.length - 1]?.[1] || 1;
    const norm = piPts.map(([k, v]) => [k, v / top]);
    const fitPts = norm.filter((d) => d[0] >= m && d[0] <= 60);
    const fit = fitPts.length > 2 ? logLogFit(fitPts.map((d) => d[0]), fitPts.map((d) => d[1])) : null;
    const k0 = norm[0]?.[0] || m, v0 = norm[0]?.[1] || 1;
    pi.update({ series: [{ type: "scatter", data: norm, color: 1, r: 4, label: "measured" },
      fnSeries((k) => v0 * Math.pow(k / k0, 2), k0, norm[norm.length - 1]?.[0] || 100, 30, { log: true, color: "theory", dashed: true, label: "slope 2: linear attachment" }),
      fnSeries((k) => v0 * Math.pow(k / k0, 1), k0, norm[norm.length - 1]?.[0] || 100, 30, { log: true, color: "random", dashed: true, label: "slope 1: no preference" })] });
    pk.update({ series: [{ type: "scatter", data: binnedPk(deg), color: 2, r: 4, label: `α = ${alpha.toFixed(1)}` }, fnSeries((k) => baPk(k, m), m, 2000, 50, { log: true, color: "theory", dashed: true, label: "BA (α = 1)" })] });
    const kmx = kmaxT[kmaxT.length - 1][1];
    km.update({ series: [{ type: "line", data: kmaxT, color: 2, label: "k_max(t)" }, fnSeries((x) => m * Math.sqrt(x / 3), 3, N, 30, { log: true, color: "theory", dashed: true, label: "∝ t^½ (BA)" }), fnSeries((x) => (m * x) / 3, 3, N, 30, { log: true, color: "random", dashed: true, label: "∝ t" })] });
    t.set("share", fmt.pct(kmx / (2 * m * N), 1), `k_max = ${fmt.int(kmx)}`);
    t.set("regime", alpha === 0 ? "no preference" : alpha < 1 ? "sublinear" : alpha === 1 ? "linear (BA)" : "superlinear", alpha === 0 ? "exponential pₖ" : alpha < 1 ? "stretched exponential, small hubs" : alpha === 1 ? "power law, γ = 3" : "a super-hub takes a finite share");
    t.set("fit", fit ? (fit.slope - 1).toFixed(2) : "–", `true α = ${alpha.toFixed(1)}`);
  }
  const run = debounce(draw, 120);
  slider(f.controls, { label: "attachment exponent α", min: 0, max: 2.5, step: 0.1, value: alpha, format: (v) => v.toFixed(1), onInput: (v) => { alpha = +v.toFixed(1); run(); }, wide: true });
  button(f.controls, { label: "Rerun", icon: "dice", onClick: () => { seed++; draw(); } });
  whenVisible(f.el, draw);
  f.setCaption("Only α = 1 gives a power law. Below it the tail bends down and the largest hub grows slowly; above it one early node grabs a finite share of all links and k_max grows like t. The right panel is how preferential attachment is measured in real networks (Section 5.7): count the new links each node gains between two snapshots, sum them into π(k), and read α from the slope minus one. Measured values: about 1 for the Internet and citations, 0.9 for co-authorship and actors.");
}

// ================================================================== preferential attachment without a rule
fig_origins: {
  if (!document.getElementById("fig-origins")) break fig_origins; // only on the page that shows it
  const N = 20000;
  const f = figure("#fig-origins", { title: "Preferential attachment without a rule", sub: `${fmt.int(N)} nodes. Neither model knows any degree, yet both attach in proportion to degree.` });
  const plot = new Plot(f.body, { height: 280, x: { type: "log", label: "degree k" }, y: { type: "log", label: "P(K ≥ k)" } });
  const t = stats(f.body, [{ key: "pred", tex: "\\gamma", label: "predicted", hl: true }, { key: "kmax", label: "largest degree" }]);
  let model = "link", p = 0.3, seed = 6;
  function draw() {
    const rng = new RNG(seed), deg = new Int32Array(N);
    let gamma, label;
    if (model === "link") {
      // start from one link; each new node picks a random link and attaches to one of its two ends
      const ends = new Int32Array(2 * N); ends[0] = 0; ends[1] = 1; deg[0] = deg[1] = 1; let L = 1;
      for (let v = 2; v < N; v++) { const j = ends[2 * rng.int(L) + rng.int(2)]; deg[j]++; deg[v]++; ends[2 * L] = v; ends[2 * L + 1] = j; L++; }
      gamma = 3; label = "degree";
    } else {
      // directed copying: each node links to one earlier node; with prob p to a random node u, else to u's target
      const target = new Int32Array(N); target[0] = 0;
      for (let v = 1; v < N; v++) { const u = rng.int(v); const j = rng.random() < p || u === 0 ? u : target[u]; target[v] = j; deg[j]++; }
      gamma = (2 - p) / (1 - p); label = "in-degree";
    }
    const h = ccdf(histogram(Array.from(deg).filter((k) => k > 0)));
    const k0 = model === "link" ? 1 : 1;
    plot.update({ series: [{ type: "scatter", data: h, color: 1, r: 3, label: `simulated ${label}` }, fnSeries((k) => Math.pow(k / k0, -(gamma - 1)), 1, h[h.length - 1][0], 30, { log: true, color: "theory", dashed: true, label: `slope −(γ − 1) = −${(gamma - 1).toFixed(2)}` })] });
    t.set("pred", gamma.toFixed(2), model === "link" ? "q_k = k pₖ/⟨k⟩, as in BA" : "(2 − p)/(1 − p)");
    t.set("kmax", fmt.int(Math.max(...deg)));
  }
  const run = debounce(draw, 120);
  segmented(f.controls, { label: "Model", value: model, options: [{ value: "link", label: "link selection" }, { value: "copy", label: "copying" }], onChange: (v) => { model = v; draw(); } });
  slider(f.controls, { label: "copying: random-link probability p", min: 0.1, max: 0.9, step: 0.05, value: p, format: (v) => v.toFixed(2), onInput: (v) => { p = v; if (model === "copy") run(); } });
  whenVisible(f.el, draw);
  f.setCaption("Link selection: the end of a random link is a degree-k node with probability k pₖ/⟨k⟩, so picking a random link is preferential attachment in disguise, and γ = 3 as in the BA model. Copying (as when a new web page copies links from a related page): with probability p link to a random page u, otherwise to a page u links to. Copying reaches a page with probability proportional to its in-degree, so the in-degrees follow a power law, flatter the more the pages copy.");
}

// ================================================================== distances and clustering against N
fig_dc: {
  if (!document.getElementById("fig-dc")) break fig_dc; // only on the page that shows it
  const f = figure("#fig-dc", { title: "Distances and clustering of BA networks", sub: "BA networks (m = 2) against random networks with the same N and L. Distances from 40 random start nodes.", cols: "cols-2" });
  const left = f.panel("Average distance ⟨d⟩"), right = f.panel("Average clustering ⟨C⟩");
  const dp = new Plot(left, { height: 250, x: { type: "log", label: "number of nodes N" }, y: { label: "⟨d⟩", min: 0 } });
  const cp = new Plot(right, { height: 250, x: { type: "log", label: "number of nodes N" }, y: { type: "log", label: "⟨C⟩" } });
  whenVisible(f.el, () => setTimeout(() => {
    const sizes = [100, 300, 1000, 3000, 10000, 30000], ba = [], er = [], baC = [], erC = [];
    for (const N of sizes) {
      const rng = new RNG(N);
      const g = barabasiAlbert(N, 2, rng), r = gnm(N, g.m, rng);
      ba.push([N, distanceSample(g, 40, rng).mean]); er.push([N, distanceSample(r, 40, rng).mean]);
      baC.push([N, clusteringSummary(g).avg]); erC.push([N, clusteringSummary(r).avg]);
    }
    const k = 4, c0 = baC[2][1] / (Math.log(1000) ** 2 / 1000);
    dp.update({ series: [{ type: "line", markers: true, data: ba, color: 2, label: "BA" }, { type: "line", markers: true, data: er, color: "random", label: "random" },
      fnSeries((N) => Math.log(N) / Math.log(k), 100, 30000, 30, { log: true, color: "theory", dashed: true, label: "ln N / ln⟨k⟩" }),
      fnSeries((N) => Math.log(N) / Math.log(Math.log(N)), 100, 30000, 30, { log: true, color: 2, dashed: true, thin: true, label: "ln N / ln ln N" })] });
    cp.update({ series: [{ type: "line", markers: true, data: baC, color: 2, label: "BA" }, { type: "line", markers: true, data: erC, color: "random", label: "random" },
      fnSeries((N) => c0 * Math.log(N) ** 2 / N, 100, 30000, 30, { log: true, color: 2, dashed: true, thin: true, label: "∝ (ln N)²/N" }),
      fnSeries((N) => k / N, 100, 30000, 30, { log: true, color: "theory", dashed: true, label: "⟨k⟩/N" })] });
    f.setCaption("BA networks are smaller than random ones and the gap widens with N, following ln N/ln ln N (Section 5.10). Their clustering is higher than random, (ln N)²/N against 1/N, but it still vanishes for large N: real networks keep ⟨C⟩ around 0.1 to 0.6, so the BA model does not explain clustering. Dashed lines show trends, not fits.");
  }, 30));
}
