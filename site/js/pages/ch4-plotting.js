import "../layout.js";
import { h, figure, slider, select, button, stats } from "../lib/ui.js";
import { Plot, fnSeries } from "../lib/plot.js";
import { RNG } from "../lib/rng.js";
import { histogram, histMoments, pkLinear, pkLogBinned, ccdf, logLogFit, samplePowerLaw, hurwitzZeta, fmt } from "../lib/stats.js";
import { loadNetworks, NETWORK_ORDER } from "../lib/data.js";

// ------------------------------------------------------------------ 1. four ways to plot one distribution
(async () => {
  const { networks } = await loadNetworks();
  let name = "internet", bpd = 6, gamma = 2.5, n = 10000, seed = 1, synth = null;
  const f = figure("#fig-four", { title: "Four ways to plot the same degree distribution", sub: "Pick a network, or draw a sample from a power law whose exponent you know.", cols: "cols-2" });
  const pa = f.panel("(a) Linear axes"), pb = f.panel("(b) Log-log axes, linear bins"), pc = f.panel("(c) Log-log axes, logarithmic bins"), pd = f.panel("(d) Complementary cumulative distribution P(K ≥ k)");
  const t = stats(f.body, [{ key: "single", label: "distinct degrees held by exactly one node" }, { key: "tail", label: "nodes with such a degree" }]);
  t.el.style.gridColumn = "1 / -1";
  f.body.prepend(t.el);
  const ax = (label) => ({ type: "log", label });
  const A = new Plot(pa, { height: 230, legend: false, x: { label: "degree k", min: 0 }, y: { label: "pₖ", min: 0 } });
  const B = new Plot(pb, { height: 230, x: ax("degree k"), y: ax("pₖ") });
  const C = new Plot(pc, { height: 230, x: ax("degree k"), y: ax("pₖ") });
  const D = new Plot(pd, { height: 230, x: ax("degree k"), y: ax("P(K ≥ k)") });
  const synthCtl = h("div", { class: "btn-row" });
  function hist() {
    if (name !== "synthetic") return { h: networks[name].degreeHist, label: networks[name].description };
    if (!synth) synth = histogram(samplePowerLaw(n, gamma, 1, new RNG(seed)));
    return { h: synth, label: `power-law sample, γ = ${gamma.toFixed(2)}, n = ${fmt.int(n)}` };
  }
  function draw() {
    const { h: hh, label } = hist();
    const N = histMoments(hh).n;
    const lin = pkLinear(hh).filter((p) => p[0] > 0);
    const lb = pkLogBinned(hh, bpd);
    const cc = ccdf(hh).filter((p) => p[0] > 0);
    let single = 0, singleNodes = 0;
    hh.count.forEach((c) => { if (c === 1) { single++; singleNodes++; } });
    t.set("single", `${fmt.int(single)} of ${fmt.int(hh.k.length)}`, "each is a point at pₖ = 1/N in (b)");
    t.set("tail", fmt.pct(singleNodes / N, 2), "of all nodes");
    const kmaxView = Math.min(60, hh.k[hh.k.length - 1]);
    A.update({ series: [{ type: "scatter", data: lin.filter((p) => p[0] <= kmaxView), color: 1, label, r: 3 }], xName: "k", yFormat: (v) => fmt.sig(v, 3) });
    B.update({
      series: [{ type: "scatter", data: lin, color: 1, label, r: 2.6 }],
      rules: [{ y: 1 / N, label: "pₖ = 1/N: one node", dashed: true, align: "left" }],
      xName: "k", yFormat: (v) => fmt.sig(v, 3),
    });
    const bins = lb.map((p) => p[2]);
    C.update({
      series: [
        { type: "scatter", data: lin, color: "random", label: "linear bins (as in b)", r: 1.8, opacity: 0.45, tooltip: false },
        { type: "scatter", data: lb, color: 1, label: `${bpd} bins per decade`, r: 4.5, tooltip: (p) => [h("div", { class: "tt-title" }, `bin ${p[2].lo}–${p[2].hi}`), h("div", {}, `${fmt.int(p[2].count)} nodes, width ${p[2].hi - p[2].lo + 1}`), h("div", {}, `pₖ = ${fmt.sig(p[1], 3)}`)] },
      ],
      bands: bins.filter((_, i) => i % 2 === 0).map((b) => ({ x0: b.lo, x1: b.hi + 1, opacity: 0.05 })),
      xName: "k", yFormat: (v) => fmt.sig(v, 3),
    });
    const tail = cc.filter((p) => p[0] >= 10);
    const fit = tail.length > 3 ? logLogFit(tail.map((p) => p[0]), tail.map((p) => p[1])) : null;
    D.update({
      series: [
        { type: "scatter", data: cc, color: 1, label, r: 2.6 },
        fit && fnSeries((k) => Math.pow(10, fit.intercept) * Math.pow(k, fit.slope), 10, hh.k[hh.k.length - 1], 20, { log: true, color: "theory", dashed: true, label: `slope for k ≥ 10: ${fit.slope.toFixed(2)}, so γ ≈ ${(1 - fit.slope).toFixed(2)}`, tooltip: false }),
      ],
      xName: "k", yFormat: (v) => fmt.sig(v, 3), forceLegend: true,
    });
  }
  select(f.controls, {
    label: "Data", value: name,
    options: [...NETWORK_ORDER.map((x) => ({ value: x, label: networks[x].description })), { value: "synthetic", label: "Synthetic power law (known γ)" }],
    onChange: (v) => { name = v; synthCtl.style.display = v === "synthetic" ? "" : "none"; draw(); },
  });
  slider(f.controls, { label: "log bins per decade", min: 2, max: 20, step: 1, value: bpd, onInput: (v) => { bpd = v; draw(); } });
  f.controls.append(synthCtl);
  slider(synthCtl, { label: "true γ", min: 2.05, max: 3.5, step: 0.05, value: gamma, format: (v) => v.toFixed(2), onChange: (v) => { gamma = v; synth = null; draw(); } });
  slider(synthCtl, { label: "sample size n", min: 1000, max: 200000, step: 1000, log: true, value: n, format: fmt.int, onChange: (v) => { n = v; synth = null; draw(); } });
  button(synthCtl, { label: "New sample", icon: "dice", onClick: () => { seed++; synth = null; draw(); } });
  synthCtl.style.display = "none";
  draw();
  f.setCaption("The least-squares slope in (d) is only a rough guide: it depends on where the fit starts, and the points of a cumulative distribution are not independent. Use maximum likelihood to estimate γ (<a href=\"ch4-fitting.html\">next page</a>).");
})();

// ------------------------------------------------------------------ 2. why the plateau appears
{
  let gamma = 2.5, n = 10000, seed = 3;
  const f = figure("#fig-plateau", { title: "Where the plateau comes from", sub: "Expected number of nodes Nₖ = n·pₖ with each degree, against what one sample actually contains." });
  const t = stats(f.body, [{ key: "k1", label: "degree where n·pₖ = 1" }, { key: "beyond", label: "nodes beyond it (expected)" }, { key: "dist", label: "distinct degrees in the sample beyond it" }]);
  const plot = new Plot(f.body, { height: 280, x: { type: "log", label: "degree k" }, y: { type: "log", label: "number of nodes Nₖ", min: 0.3 } });
  function draw() {
    const sample = histogram(samplePowerLaw(n, gamma, 1, new RNG(seed)));
    const z = hurwitzZeta(gamma, 1);
    const k1 = Math.pow(n / z, 1 / gamma);
    const beyond = (n * hurwitzZeta(gamma, Math.ceil(k1))) / z;
    let distinct = 0;
    sample.k.forEach((k) => { if (k >= k1) distinct++; });
    t.set("k1", fmt.fix(k1, 1), "(n / ζ(γ))^(1/γ)"); t.set("beyond", fmt.int(beyond), "spread over a huge range of k"); t.set("dist", fmt.int(distinct), "most held by a single node");
    plot.update({
      series: [
        { type: "scatter", data: sample.k.map((k, i) => [k, sample.count[i]]), color: 1, label: "one sample: Nₖ", r: 3 },
        fnSeries((k) => (n * Math.pow(k, -gamma)) / z, 1, sample.k[sample.k.length - 1], 80, { log: true, color: "theory", dashed: true, label: "expected n·pₖ" }),
      ],
      rules: [{ y: 1, label: "Nₖ = 1", dashed: true, align: "left" }, { x: k1, label: "n·pₖ = 1", color: "theory" }],
      xName: "k", yFormat: (v) => fmt.sig(v, 3),
    });
  }
  slider(f.controls, { label: "γ", min: 2.05, max: 3.5, step: 0.05, value: gamma, format: (v) => v.toFixed(2), onInput: (v) => { gamma = v; draw(); } });
  slider(f.controls, { label: "sample size n", min: 1000, max: 1000000, step: 1000, log: true, value: n, format: fmt.int, onChange: (v) => { n = v; draw(); } });
  button(f.controls, { label: "New sample", icon: "dice", onClick: () => { seed++; draw(); } });
  draw();
  f.setCaption("Beyond the point where the expected count drops below one node, a degree is either absent (not plotted at all on log axes) or present once. The plotted points pile up on the line Nₖ = 1. A straight-line fit through them is fitting the noise.");
}
