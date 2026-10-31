import "../layout.js";
import { h, figure, slider, segmented, button, stats, ICONS } from "../lib/ui.js";
import { NetView } from "../lib/netview.js";
import { Plot, fnSeries } from "../lib/plot.js";
import { RNG } from "../lib/rng.js";
import { Graph } from "../lib/graph.js";
import { ccdf, fitPowerLaw, fmt } from "../lib/stats.js";
import { run } from "../lib/compute.js";

/** Exact BA degree distribution (book Eq. 5.11, Section 5.5; derived in Advanced Topic 5.A): p_k = 2m(m+1) / (k(k+1)(k+2)), k ≥ m. */
const baPk = (k, m) => (2 * m * (m + 1)) / (k * (k + 1) * (k + 2));
const baSf = (k, m) => (m * (m + 1)) / (k * (k + 1)); // P(K ≥ k)

// ------------------------------------------------------------------ 1. watch it grow
{
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
