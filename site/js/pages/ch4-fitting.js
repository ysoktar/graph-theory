import "../layout.js";
import { h, figure, slider, select, segmented, button, stats, dataTable, ICONS } from "../lib/ui.js";
import { Plot, fnSeries } from "../lib/plot.js";
import { RNG } from "../lib/rng.js";
import { samplePowerLaw, histTail, powerLawLogLik, powerLawMLE, fitPowerLaw, hurwitzZeta, quantile, mean, std, fmt } from "../lib/stats.js";
import { estimators } from "../lib/tasks.js";
import { loadNetworks, loadJSON, NETWORK_ORDER, SHORT } from "../lib/data.js";
import { run } from "../lib/compute.js";
import { t as tl } from "../i18n.js";

const NAMES = {
  lsLinear: "(1) least squares, linear bins", lsLog: "(2) least squares, log bins", lsCcdf: "(3) least squares, cumulative",
  closedForm: "(4) closed-form MLE, tail k ≥ 6", mle: "(5) exact discrete MLE, k_min = 1",
};
const ORDER = Object.keys(NAMES);

// ------------------------------------------------------------------ 1. the controlled experiment (notebook cell 53)
{
  let gamma = 2.5, n = 10000, seed = 2026;
  const f = figure("#fig-experiment", { title: "Five estimators on a sample with a known exponent", sub: "n degrees drawn exactly from pₖ ∝ k^−γ, k ≥ 1.", cols: "cols-3" });
  const panels = ["(1) linear bins", "(2) log bins", "(3) cumulative"].map((t) => f.panel(t));
  const plots = panels.map((p) => new Plot(p, { height: 220, legend: false, x: { type: "log", label: "k" }, y: { type: "log", label: "" } }));
  const tbl = h("div");
  tbl.style.gridColumn = "1 / -1";
  f.body.append(tbl);
  function draw() {
    const e = estimators(samplePowerLaw(n, gamma, 1, new RNG(seed)));
    const line = (fit, xs) => fnSeries((k) => Math.pow(10, fit.intercept) * Math.pow(k, fit.slope), xs[0], xs[xs.length - 1], 10, { log: true, color: "theory", dashed: true, tooltip: false });
    const sets = [[e.lin, e.fits.f1, "pₖ"], [e.lb, e.fits.f2, "pₖ"], [e.cc, e.fits.f3, "P(K ≥ k)"]];
    sets.forEach(([data, fit, yl], i) => {
      plots[i].axes({ y: { label: yl } });
      plots[i].update({ series: [{ type: "scatter", data: data.map((p) => [p[0], p[1]]), color: 1, label: "sample", r: 2.6 }, line(fit, data.map((p) => p[0]))], xName: "k", yFormat: (v) => fmt.sig(v, 3) });
    });
    panels.forEach((p, i) => { p.querySelector(".panel-title").textContent = `${["(1) linear bins", "(2) log bins", "(3) cumulative"][i]}: γ̂ = ${[e.lsLinear, e.lsLog, e.lsCcdf][i].toFixed(2)}`; });
    tbl.replaceChildren(dataTable([{ label: "Estimator", align: "left" }, { label: "γ̂" }, { label: "error γ̂ − γ" }],
      ORDER.map((k) => [NAMES[k], e[k], e[k] - gamma]).map((r) => [r[0], r[1].toFixed(3), (r[2] >= 0 ? "+" : "") + r[2].toFixed(3)]),
      { highlight: (r) => Math.abs(+r[2]) > 0.15 }));
  }
  slider(f.controls, { label: "true γ", min: 2.05, max: 3.5, step: 0.05, value: gamma, format: (v) => v.toFixed(2), onInput: (v) => { gamma = v; draw(); } });
  slider(f.controls, { label: "sample size n", min: 500, max: 100000, step: 100, log: true, value: n, format: fmt.int, onChange: (v) => { n = v; draw(); } });
  button(f.controls, { label: "New sample", icon: "dice", onClick: () => { seed++; draw(); } });
  draw();
  f.setCaption("Highlighted rows miss the true value by more than 0.15. Draw a few new samples: the least-squares estimates depend on the binning and on the noisy tail, and the linear-bin fit is badly biased every time. The notebook draws its sample with powerlaw's generator; at k_min = 1 that generator happens to be exact (see the bugs below), so the experiment is valid.");
}

// ------------------------------------------------------------------ 2. bias and spread over many samples (worker)
{
  let gamma = 2.5, n = 10000, job = null;
  const f = figure("#fig-trials", { title: "Bias and spread over 200 samples", sub: "Each dot is one sample's estimate; the bar spans the middle 90%. Runs in a background thread." });
  const status = h("div", { class: "status-line" });
  const plot = new Plot(f.body, {
    height: 320, legend: false,
    x: { label: "", min: 0.4, max: 5.6, tickValues: [1, 2, 3, 4, 5], format: (v) => ["", "(1) linear bins", "(2) log bins", "(3) cumulative", "(4) closed form", "(5) exact MLE"][v] || "" },
    y: { label: "estimated γ̂" },
  });
  const tbl = h("div");
  f.body.append(tbl);
  async function go() {
    if (job) job.cancel();
    status.textContent = "Running 200 samples…";
    job = run("estimatorTrials", { gamma, n, trials: 200, seed: 9 }, (p) => { status.textContent = `${p.done} of ${p.trials} samples`; });
    let out;
    try { out = await job.promise; } catch { return; }
    job = null;
    status.textContent = "";
    const rng = new RNG(1);
    plot.update({
      series: [
        ...ORDER.map((k, i) => ({ type: "scatter", data: out[k].map((v) => [i + 1 + (rng.random() - 0.5) * 0.5, v]), color: i < 3 ? "random" : 1, r: 2, opacity: 0.45, tooltip: false, label: NAMES[k] })),
        ...ORDER.map((k, i) => ({ type: "line", data: [[i + 1, quantile(out[k], 0.05)], [i + 1, quantile(out[k], 0.95)]], color: "text", width: 3, tooltip: false })),
        { type: "scatter", data: ORDER.map((k, i) => [i + 1, mean(out[k]), k]), color: "text", r: 4.5, symbol: "diamond", label: "mean", tooltip: (p) => [h("div", { class: "tt-title" }, NAMES[p[2]]), h("div", {}, `mean γ̂ = ${p[1].toFixed(3)}, sd ${std(out[p[2]]).toFixed(3)}`)] },
      ],
      rules: [{ y: gamma, label: `true γ = ${gamma}`, dashed: true, color: "theory" }],
      xName: "estimator", yFormat: (v) => fmt.fix(v, 3), hover: "point",
    });
    tbl.replaceChildren(dataTable([{ label: "Estimator", align: "left" }, { label: "mean γ̂" }, { label: "bias" }, { label: "standard deviation" }, { label: "middle 90%" }],
      ORDER.map((k) => [NAMES[k], mean(out[k]).toFixed(3), (mean(out[k]) - gamma >= 0 ? "+" : "") + (mean(out[k]) - gamma).toFixed(3), std(out[k]).toFixed(3), `${quantile(out[k], 0.05).toFixed(2)} – ${quantile(out[k], 0.95).toFixed(2)}`])));
  }
  slider(f.controls, { label: "true γ", min: 2.05, max: 3.5, step: 0.05, value: gamma, format: (v) => v.toFixed(2), onChange: (v) => { gamma = v; go(); } });
  slider(f.controls, { label: "sample size n", min: 500, max: 50000, step: 100, log: true, value: n, format: fmt.int, onChange: (v) => { n = v; go(); } });
  f.controls.append(status);
  go();
  f.setCaption("Only the exact MLE is centred on the true value with a small spread; its standard deviation matches the theoretical (γ − 1)/√n. The closed-form estimator uses only the tail k ≥ 6, about 4% of the sample for γ = 2.5, so it is nearly unbiased but noisier.");
}

// ------------------------------------------------------------------ 3. the likelihood
{
  let gamma = 2.5, n = 2000, seed = 4, tryG = 2.2, zoom = "wide";
  const f = figure("#fig-lik", { title: "Maximum likelihood: the exponent that makes the data most probable", sub: "Log-likelihood ln L(γ) = −n ln ζ(γ, k_min) − γ Σ ln kᵢ of one sample (k_min = 1)." });
  const t = stats(f.body, [{ key: "mle", label: "γ̂ (maximum)" }, { key: "sig", label: "standard error (γ̂ − 1)/√n" }, { key: "d", label: "ln L(γ̂) − ln L(γ) at your γ" }]);
  const plot = new Plot(f.body, { height: 260, x: { label: "candidate exponent γ", min: 1.6, max: 3.6 }, y: { label: "ln L(γ) − ln L(γ̂)" } });
  let x = null;
  function sample() { x = samplePowerLaw(n, gamma, 1, new RNG(seed)); }
  function draw() {
    const m = new Map();
    for (const v of x) m.set(v, (m.get(v) || 0) + 1);
    const ks = [...m.keys()].sort((a, b) => a - b), tail = { k: ks, count: ks.map((k) => m.get(k)) };
    const fit = powerLawMLE(tail, 1);
    const L0 = fit.logLik;
    t.set("mle", fmt.fix(fit.gamma, 3), `true γ = ${gamma}`); t.set("sig", fmt.fix(fit.sigma, 3), `n = ${fmt.int(n)}`);
    const dl = L0 - powerLawLogLik(tryG, tail, 1);
    t.set("d", fmt.sig(dl, 3), `the data are e^${fmt.sig(dl, 2)} times more likely under γ̂`);
    // "near the peak" zooms in on γ̂ ± 4σ, where the drop of ½ that marks ±1σ is visible
    const near = zoom === "near";
    const lo = near ? fit.gamma - 4 * fit.sigma : 1.6, hi = near ? fit.gamma + 4 * fit.sigma : 3.6;
    plot.update({
      series: [fnSeries((g) => powerLawLogLik(g, tail, 1) - L0, lo, hi, 200, { color: 1, label: "ln L(γ) − ln L(γ̂)" })],
      rules: [
        { x: fit.gamma, label: `γ̂ = ${fit.gamma.toFixed(3)}` },
        ...(tryG >= lo && tryG <= hi ? [{ x: tryG, label: `your γ = ${tryG.toFixed(2)}`, dashed: true, color: "s2", labelY: 26 }] : []),
        { y: -0.5, label: "drop of ½", dashed: true, align: "left" },
        ...(near ? [{ x: fit.gamma - fit.sigma, label: "−1σ", color: "theory", dashed: true, align: "left", labelY: 40 }, { x: fit.gamma + fit.sigma, label: "+1σ", color: "theory", dashed: true, labelY: 40 }] : []),
      ],
      x: { min: lo, max: hi },
      y: near ? { min: -8, max: 1 } : { min: Math.max(-60, powerLawLogLik(1.6, tail, 1) - L0, powerLawLogLik(3.6, tail, 1) - L0), max: 3 },
      xName: "γ", yFormat: (v) => fmt.sig(v, 3),
    });
  }
  slider(f.controls, { label: "try an exponent", min: 1.6, max: 3.6, step: 0.01, value: tryG, format: (v) => v.toFixed(2), onInput: (v) => { tryG = v; draw(); }, wide: true });
  slider(f.controls, { label: "sample size n", min: 100, max: 100000, step: 100, log: true, value: n, format: fmt.int, onChange: (v) => { n = v; sample(); draw(); } });
  button(f.controls, { label: "New sample", icon: "dice", onClick: () => { seed++; sample(); draw(); } });
  segmented(f.controls, { label: "View", value: zoom, options: [{ value: "wide", label: "wide (1.6 to 3.6)" }, { value: "near", label: "near the peak (γ̂ ± 4σ)" }], onChange: (v) => { zoom = v; draw(); } });
  sample(); draw();
  f.setCaption("The curve is concave with a single maximum, so a simple one-dimensional search finds γ̂. The larger the sample, the narrower the peak: the curve drops by ½ at about one standard error on either side of γ̂. Switch to <em>near the peak</em> to see it.");
}

// ------------------------------------------------------------------ 4. real data: the k_min scan, the gotcha, the alternatives, the bootstrap
(async () => {
  const [{ networks }, gof] = await Promise.all([loadNetworks(), loadJSON("data/gof.json")]);
  let name = "internet", maxGamma = 10;
  const f = figure("#fig-scan", { title: "Choosing k_min: the Clauset–Shalizi–Newman scan", sub: "For every candidate k_min: fit γ by MLE on k ≥ k_min and measure the KS distance D. The best k_min minimises D.", cols: "cols-2" });
  const t = stats(f.body, [
    { key: "kmin", label: "best k_min" }, { key: "g", label: "γ̂ (± σ)" }, { key: "tail", label: "nodes in the tail" }, { key: "py", label: "γ̂ from powerlaw (Python)" },
  ]);
  t.el.style.gridColumn = "1 / -1";
  const pa = f.panel("KS distance D between the data and the fit"), pb = f.panel("Estimated γ̂ for each k_min");
  const A = new Plot(pa, { height: 240, legend: false, x: { type: "log", label: "k_min" }, y: { label: "D", min: 0 } });
  const B = new Plot(pb, { height: 240, legend: false, x: { type: "log", label: "k_min" }, y: { label: "γ̂" } });
  let fit = null;
  function draw() {
    const d = networks[name];
    fit = fitPowerLaw(d.degreeHist, { maxGamma, maxCandidates: 200, excludeAtBound: true });
    const scan = fit.scan.filter((r) => r.ntail >= 10);
    t.set("kmin", fmt.int(fit.kmin), `D = ${fit.D.toFixed(4)}`);
    t.set("g", fit.gamma.toFixed(2), `± ${fit.sigma.toFixed(2)}; ` + maxGamma === 3 ? `${scan.filter((r) => r.atBound).length} candidates discarded (γ̂ would exceed 3)` : "γ allowed up to 10");
    t.set("tail", fmt.int(fit.ntail), `${fmt.pct(fit.tailShare, 1)} of all nodes`);
    const py = maxGamma === 3 && d.powerlaw.defaultRange ? d.powerlaw.defaultRange : d.powerlaw;
    t.set("py", py.gamma.toFixed(2), `k_min = ${py.kmin}; ` + (maxGamma === 3 ? "powerlaw 2.0, default range" : "powerlaw 2.0, range widened"));
    const rules = [{ x: fit.kmin, label: `k_min = ${fit.kmin}`, color: "theory" }];
    A.update({ series: [{ type: "line", data: scan.map((r) => [r.kmin, r.D]), color: 1, label: "D" }], rules, xName: "k_min", yFormat: (v) => fmt.fix(v, 4) });
    B.update({
      series: [
        { type: "range", data: scan.map((r) => [r.kmin, r.gamma - r.sigma, r.gamma + r.sigma]), color: 1, label: "±σ", tooltip: false },
        { type: "line", data: scan.map((r) => [r.kmin, r.gamma]), color: 1, label: "γ̂" },
      ],
      rules: [...rules, ...(maxGamma === 3 ? [{ y: 3, label: "upper bound γ = 3", dashed: true, color: "s8", align: "left" }] : [])],
      y: { min: 1, max: Math.min(10, Math.max(4, ...scan.map((r) => r.gamma)) + 0.3) }, xName: "k_min", yFormat: (v) => fmt.fix(v, 3),
    });
    drawAlt(); drawGofTable();
  }
  select(f.controls, { label: "Network", value: name, options: NETWORK_ORDER.map((n) => ({ value: n, label: networks[n].description })), onChange: (v) => { name = v; draw(); } });
  segmented(f.controls, { label: "Allowed exponents", value: "10", options: [{ value: "10", label: "1 < γ ≤ 10" }, { value: "3", label: "powerlaw 2.0 default: γ ≤ 3" }], onChange: (v) => { maxGamma = +v; draw(); } });
  f.setCaption("Candidates with fewer than 10 nodes in the tail are not shown. With the restricted range, a k_min whose best exponent would exceed 3 is discarded, as powerlaw does (its γ̂ is pinned at 3 in the right panel). Switch the allowed range to the powerlaw default for the Internet: the best fit jumps to k_min = 36 and γ̂ = 2.94, because every exponent above 3 has been forbidden.");

  // ---- the CCDF of the tail against the alternatives
  const g = figure("#fig-alt", { title: "Which distribution fits the tail?", sub: "P(K ≥ k | k ≥ k_min) of the data and of four distributions fitted to the same tail (computed with powerlaw 2.0)." });
  const altPlot = new Plot(g.body, { height: 320, x: { type: "log", label: "degree k" }, y: { type: "log", label: "P(K ≥ k | K ≥ k_min)" } });
  const altTbl = h("div");
  g.body.append(altTbl);
  function drawAlt() {
    const d = networks[name], c = d.powerlaw.curves;
    const ser = (key, color, label, dashed) => ({ type: "line", data: c.x.map((x, i) => [x, c[key][i]]).filter((p) => p[1] > 0), color, label, dashed });
    altPlot.update({
      series: [
        { type: "scatter", data: c.x.map((x, i) => [x, c.data[i]]), color: 1, label: `${tl(d.description)}, k ≥ ${d.powerlaw.kmin}`, r: 3 },
        ser("lognormal", 2, "log-normal"), ser("exponential", 3, "exponential"), ser("truncated_power_law", 7, "power law with exponential cutoff"),
        ser("power_law", "theory", `power law, γ̂ = ${d.powerlaw.gamma.toFixed(2)}`, true),
      ],
      y: { min: Math.min(...c.data) / 2, max: 1.2 }, xName: "k", yFormat: (v) => fmt.sig(v, 3),
    });
    const cmp = d.powerlaw.compare;
    const verdict = (R, p) => (p >= 0.1 ? h("span", { class: "verdict meh" }, "inconclusive") : R > 0 ? h("span", { class: "verdict ok" }, "power law favoured") : h("span", { class: "verdict no" }, "alternative favoured"));
    altTbl.replaceChildren(dataTable([{ label: "Power law against", align: "left" }, { label: "R (normalised log-likelihood ratio)" }, { label: "p" }, { label: "verdict", align: "left" }],
      [["exponential", "exponential"], ["log-normal", "lognormal"], ["power law with cutoff (nested test)", "truncated_power_law"], ["stretched exponential", "stretched_exponential"]]
        .filter(([, k]) => cmp[k]).map(([lab, k]) => [lab, cmp[k].R.toFixed(3), fmt.sig(cmp[k].p, 3), verdict(cmp[k].R, cmp[k].p)])));
  }
  g.setCaption("R > 0 favours the power law and R < 0 the alternative; the sign is significant only when p < 0.1. A power law nearly always beats the exponential, so the tail is heavy. Against the log-normal and the power law with a cutoff the test is usually inconclusive or tilts towards the alternative.");

  // ---- goodness of fit
  const q = figure("#fig-gof", { title: "Step 2: is a power law plausible at all?", sub: "Semi-parametric bootstrap (Clauset, Shalizi & Newman 2009). Synthetic data sets are drawn from the fitted model and refitted from scratch; p is the share whose KS distance is at least the observed one." });
  const qs = stats(q.body, [{ key: "p", label: "p-value" }, { key: "done", label: "synthetic data sets" }, { key: "verdict", label: "verdict (p ≥ 0.1: plausible)" }]);
  const hist = new Plot(q.body, { height: 230, x: { label: "KS distance D of the synthetic data sets", min: 0 }, y: { label: "data sets", min: 0 } });
  hist.root.style.display = "none"; // shown once a bootstrap has run
  const gofTbl = h("div");
  q.body.append(gofTbl);
  let reps = 200, job = null;
  const runBtn = button(q.controls, {
    label: "Run the bootstrap", icon: "play",
    onClick: async () => {
      if (job) { job.cancel(); job = null; runBtn.innerHTML = ICONS.play + " Run the bootstrap"; return; }
      const d = networks[name];
      runBtn.innerHTML = ICONS.pause + " Stop";
      const t0 = performance.now();
      job = run("powerLawGoF", { hist: d.degreeHist, fit: { kmin: fit.kmin, gamma: fit.gamma, D: fit.D, ntail: fit.ntail }, reps, seed: 7, maxGamma }, (pr) => {
        qs.set("p", pr.p.toFixed(3), "so far"); qs.set("done", `${pr.done} of ${pr.reps}`, `${((performance.now() - t0) / 1000).toFixed(0)} s`);
      });
      let res;
      try { res = await job.promise; } catch { return; }
      job = null;
      runBtn.innerHTML = ICONS.play + " Run the bootstrap";
      qs.set("p", res.p.toFixed(3), `${tl(SHORT[name])}, k_min = ${fit.kmin}, γ̂ = ${fit.gamma.toFixed(2)}`);
      qs.set("verdict", res.p >= 0.1 ? "plausible" : "ruled out", res.p >= 0.1 ? "a power law cannot be rejected" : "the tail is not a power law");
      const bins = 30, mx = Math.max(fit.D, ...res.Ds) * 1.05, cnt = new Array(bins).fill(0);
      for (const D of res.Ds) cnt[Math.min(bins - 1, Math.floor((D / mx) * bins))]++;
      hist.root.style.display = "";
      hist.update({ series: [{ type: "bar", data: cnt.map((c, i) => [((i + 0.5) * mx) / bins, c]), color: "random", label: "synthetic data sets" }], rules: [{ x: fit.D, label: `observed D = ${fit.D.toFixed(4)}`, color: "s1" }], xName: "D", yFormat: fmt.int });
    },
  });
  select(q.controls, { label: "synthetic data sets", value: "200", options: [50, 200, 1000].map((r) => ({ value: String(r), label: String(r) })), onChange: (v) => { reps = +v; } });
  q.controls.append(h("span", { class: "status-line" }, "Uses the network and settings of the k_min scan above. Small networks take seconds; the WWW takes minutes."));
  function drawGofTable() {
    qs.set("p", "–", "press Run"); qs.set("done", "–"); qs.set("verdict", "–");
    hist.root.style.display = "none"; // a histogram from another network or setting would be stale
    gofTbl.replaceChildren(dataTable([{ label: "Network", align: "left" }, { label: "k_min" }, { label: "γ̂" }, { label: "D" }, { label: "p (1,000 data sets)" }, { label: "power law", align: "left" }],
      NETWORK_ORDER.map((n) => { const r = gof[n]; return [networks[n].description, r.kmin, r.gamma.toFixed(2), r.D.toFixed(4), r.p.toFixed(3), h("span", { class: "verdict " + (r.p >= 0.1 ? "ok" : "no") }, r.p >= 0.1 ? "plausible" : "ruled out")]; }),
      { highlight: (r) => r[0] === networks[name].description }));
  }
  q.setCaption("The table was computed once with 1,000 synthetic data sets per network (tools/gof.mjs). By the CSN criterion the power law is ruled out for collaboration, email and the WWW, and borderline for the Internet (p = 0.06). Our bootstrap is slightly conservative when k_min is re-estimated, so p-values near 0.1 should be read with care.");
  draw();
})();
