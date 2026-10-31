import "../layout.js";
import { h, figure, slider, segmented, button, stats } from "../lib/ui.js";
import { NetView } from "../lib/netview.js";
import { Plot } from "../lib/plot.js";
import { RNG } from "../lib/rng.js";
import { gnp, powerlawSequence, configurationGraph, giantComponent, degreeStats } from "../lib/graph.js";
import { hurwitzZeta, poissonPmf, poissonLogPmf, poissonLogSfGe, pkLinear, pkLogBinned, fmt, superscript } from "../lib/stats.js";
import { loadNetworks } from "../lib/data.js";
import { LANG } from "../i18n.js";

const plPmf = (k, g, kmin) => Math.pow(k, -g) / hurwitzZeta(g, kmin);
const plSf = (k, g, kmin) => hurwitzZeta(g, k) / hurwitzZeta(g, kmin);
const plMean = (g, kmin) => hurwitzZeta(g - 1, kmin) / hurwitzZeta(g, kmin);
/** Expected count N·P, readable down to 10⁻³⁰⁰ (log-space for the Poisson tail). */
const expected = (logP, N) => {
  const l10 = (logP + Math.log(N)) / Math.LN10;
  return l10 > -3 ? fmt.sig(Math.pow(10, l10), 3) : `10${superscript(Math.floor(l10))}`;
};

// ------------------------------------------------------------------ 1. power law against Poisson, in theory
{
  let gamma = 2.5, kmin = 2, axes = "log", N = 1e6, x = 100;
  const f = figure("#fig-compare", { title: "A power law against a Poisson distribution with the same average", sub: "Discrete power law pₖ = k^−γ / ζ(γ, k_min) for k ≥ k_min, and Poisson with the same ⟨k⟩." });
  const t = stats(f.body, [
    { key: "k", label: "⟨k⟩ (both)" }, { key: "pl", label: "power law: nodes with k ≥ x" }, { key: "po", label: "Poisson: nodes with k ≥ x" }, { key: "cross", label: "Poisson has more nodes for k =" },
  ]);
  const plot = new Plot(f.body, { height: 320, x: { type: "log", label: "degree k" }, y: { type: "log", label: "pₖ" } });
  function draw() {
    const mk = plMean(gamma, kmin);
    const kmaxShow = axes === "log" ? 1e4 : Math.max(30, Math.ceil(4 * mk));
    const pl = [], po = [];
    for (let k = axes === "log" ? 1 : 0; k <= kmaxShow; k = axes === "log" && k >= 50 ? Math.ceil(k * 1.08) : k + 1) {
      if (k >= kmin) pl.push([k, plPmf(k, gamma, kmin)]);
      const lp = poissonLogPmf(k, mk);
      if (lp > -700) po.push([k, Math.exp(lp)]);
    }
    // where the two curves cross: power law above Poisson at small k and in the tail
    let k1 = null, k2 = null;
    for (let k = kmin; k < 2000; k++) {
      const above = plPmf(k, gamma, kmin) > poissonPmf(k, mk);
      if (!above && k1 === null) k1 = k;
      if (above && k1 !== null && k2 === null) { k2 = k; break; }
    }
    const lpPl = Math.log(plSf(x, gamma, kmin)), lpPo = poissonLogSfGe(x, mk);
    t.set("k", fmt.fix(mk, 2), `ζ(γ − 1, k_min)/ζ(γ, k_min)`);
    t.set("pl", expected(lpPl, N), `x = ${x}, N = ${fmt.exp(N, 0)}`); t.set("po", expected(lpPo, N), `x = ${x}, N = ${fmt.exp(N, 0)}`);
    t.set("cross", k1 && k2 ? `${k1}–${k2 - 1}` : "–", k1 && k2 ? `power law has more below ${k1} and from ${k2} on` : "");
    const lin = axes === "lin";
    plot.update({
      series: [
        { type: lin ? "line" : "scatter", markers: lin, data: po, color: "random", symbol: "square", label: `Poisson, ⟨k⟩ = ${mk.toFixed(2)}`, r: 3 },
        { type: lin ? "line" : "scatter", markers: lin, data: pl, color: 1, label: `power law, γ = ${gamma.toFixed(2)}`, r: 3 },
      ],
      x: lin ? { type: "linear", min: 0, max: kmaxShow, label: "degree k" } : { type: "log", min: 1, max: 1e4, label: "degree k" },
      y: lin ? { type: "linear", min: 0, label: "pₖ" } : { type: "log", min: 1e-14, max: 10, label: "pₖ" },
      bands: k1 && k2 && !lin ? [{ x0: Math.max(1, kmin), x1: k1, label: "more small nodes" }, { x0: k1, x1: k2, label: "fewer near ⟨k⟩", opacity: 0 }, { x0: k2, x1: 1e4, label: "vastly more hubs", opacity: 0.05 }] : [],
      rules: [{ x, label: `x = ${x}`, color: "theory" }],
      xName: "k", yFormat: (v) => fmt.sig(v, 3),
    });
  }
  slider(f.controls, { label: "degree exponent γ", min: 2.05, max: 4, step: 0.01, value: gamma, format: (v) => v.toFixed(2), onInput: (v) => { gamma = v; draw(); }, wide: true });
  slider(f.controls, { label: "smallest degree k_min", min: 1, max: 10, step: 1, value: kmin, onInput: (v) => { kmin = v; draw(); } });
  slider(f.controls, { label: "threshold x", min: 10, max: 1000, step: 1, log: true, value: x, onInput: (v) => { x = Math.round(v); draw(); } });
  slider(f.controls, { label: "network size N", min: 1e3, max: 1e10, step: 1, log: true, value: N, format: (v) => fmt.exp(v, 0), onInput: (v) => { N = v; draw(); } });
  segmented(f.controls, { label: "Axes", value: axes, options: [{ value: "lin", label: "linear" }, { value: "log", label: "log-log" }], onChange: (v) => { axes = v; draw(); } });
  draw();
  f.setCaption("On log-log axes the power law is a straight line of slope −γ, while the Poisson curve bends down and vanishes. On linear axes both look like a bump near small k and the difference is invisible. The stat tiles give the expected number of nodes above the threshold in a network of N nodes.");
}

// ------------------------------------------------------------------ 2. the Internet against Poisson (notebook III.2)
(async () => {
  const { networks } = await loadNetworks();
  const d = networks.internet, hh = d.degreeHist;
  const f = figure("#fig-internet", { title: "The Internet against a Poisson distribution with the same ⟨k⟩", sub: `Router-level Internet: N = ${fmt.int(d.N)}, ⟨k⟩ = ${d.avgk.toFixed(2)}, k_max = ${fmt.int(d.kmax)}.`, cols: "cols-2" });
  const pa = f.panel("Linear axes"), pb = f.panel("Log-log axes (data log-binned)");
  const A = new Plot(pa, { height: 260, x: { label: "degree k", min: 0, max: 30 }, y: { label: "pₖ", min: 0 } });
  const B = new Plot(pb, { height: 260, x: { type: "log", label: "degree k" }, y: { type: "log", label: "pₖ", min: 1e-9, max: 1 } });
  const pois = [];
  for (let k = 0; k <= 60; k++) pois.push([k, poissonPmf(k, d.avgk)]);
  A.update({
    series: [{ type: "line", markers: true, data: pkLinear(hh).filter((p) => p[0] <= 30), color: 1, label: "Internet", r: 3 }, { type: "line", markers: true, data: pois, color: "random", label: "Poisson", r: 3 }],
    xName: "k", yFormat: (v) => fmt.sig(v, 3),
  });
  B.update({
    series: [{ type: "line", markers: true, data: pkLogBinned(hh), color: 1, label: "Internet (log-binned)", r: 3.5 }, { type: "line", markers: true, data: pois.filter((p) => p[0] > 0 && p[1] > 1e-9), color: "random", label: "Poisson", r: 3 }],
    xName: "k", yFormat: (v) => fmt.sig(v, 3),
  });
  const share = (pred) => { let s = 0; hh.k.forEach((k, i) => { if (pred(k)) s += hh.count[i]; }); return s / d.N; };
  const lo = Math.floor(d.avgk - Math.sqrt(d.avgk)), hi = Math.ceil(d.avgk + Math.sqrt(d.avgk));
  let poMid = 0;
  for (let k = lo; k <= hi; k++) poMid += poissonPmf(k, d.avgk);
  f.setCaption((LANG === "tr" ? `${lo} ≤ k ≤ ${hi} olan düğümler (⟨k⟩ civarı): veride ${fmt.pct(share((k) => k >= lo && k <= hi))}, Poisson'da ${fmt.pct(poMid)}. k ≤ 2 olan düğümler: veride ${fmt.pct(share((k) => k <= 2))}, Poisson'da ${fmt.pct(poissonPmf(0, d.avgk) + poissonPmf(1, d.avgk) + poissonPmf(2, d.avgk))}. k ≥ 50 olan düğümler: veride ${fmt.int(share((k) => k >= 50) * d.N)}, Poisson'da beklenen ${expected(poissonLogSfGe(50, d.avgk), d.N)}.` : `Nodes with ${lo} ≤ k ≤ ${hi} (around ⟨k⟩): ${fmt.pct(share((k) => k >= lo && k <= hi))} in the data, against ${fmt.pct(poMid)} for Poisson. Nodes with k ≤ 2: ${fmt.pct(share((k) => k <= 2))} against ${fmt.pct(poissonPmf(0, d.avgk) + poissonPmf(1, d.avgk) + poissonPmf(2, d.avgk))}. Nodes with k ≥ 50: ${fmt.int(share((k) => k >= 50) * d.N)} against an expected ${expected(poissonLogSfGe(50, d.avgk), d.N)}.`));
})();

// ------------------------------------------------------------------ 3. what the networks look like
{
  const N = 400;
  let seed = 2;
  const f = figure("#fig-look", { title: "A random network and a scale-free network of the same size", sub: "Largest components; node area proportional to degree. Both have N = 400 nodes before the largest component is taken.", cols: "cols-2" });
  const pa = f.panel(""), pb = f.panel("");
  const mk = (p) => {
    let g = null;
    const v = new NetView(p, {
      height: 340, toolbar: false, charge: -16, linkDistance: 14, gravity: 0.1,
      nodeRadius: (i) => 1.6 + 1.1 * Math.sqrt(g.degree(i)), nodeColor: () => (p === pa ? "random" : "s1"), edgeColor: () => "axis", ringWidth: 0.6,
      tooltip: (i) => `degree ${g.degree(i)}`,
    });
    return { set: (gr) => { g = gr; v.setGraph(gr, { keep: false }); } };
  };
  const va = mk(pa), vb = mk(pb);
  function build() {
    const rng = new RNG(seed);
    const seq = powerlawSequence(N, 2.2, 1, rng);
    const sf = giantComponent(configurationGraph(seq, rng)).graph;
    const avg = (2 * sf.m) / sf.n;
    const er = giantComponent(gnp(N, Math.max(1.6, avg) / (N - 1), rng)).graph;
    const sa = degreeStats(er), sb = degreeStats(sf);
    pa.querySelector(".panel-title").textContent = `Random network: ${sa.n} nodes, ⟨k⟩ = ${sa.avg.toFixed(2)}, k_max = ${sa.max}`;
    pb.querySelector(".panel-title").textContent = `Scale-free, γ = 2.2: ${sb.n} nodes, ⟨k⟩ = ${sb.avg.toFixed(2)}, k_max = ${sb.max}`;
    va.set(er); vb.set(sf);
  }
  button(f.controls, { label: "New pair", icon: "dice", onClick: () => { seed++; build(); } });
  build();
  f.setCaption("The random network looks like a road map: every node has a few links, and none has many. The scale-free network looks like an airline map: most nodes have one or two links, and a few hubs hold the network together. The scale-free network is a configuration model with degrees drawn from a power law (see Generating networks).");
}
