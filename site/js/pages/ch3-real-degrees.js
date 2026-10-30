import "../layout.js";
import { h, figure, slider, select, segmented, stats, dataTable } from "../lib/ui.js";
import { Plot } from "../lib/plot.js";
import { loadNetworks, NETWORK_ORDER } from "../lib/data.js";
import { t as tl } from "../i18n.js";
import { poissonPmf, poissonLogPmf, poissonLogSfGe, poissonIsf, pkLinear, pkLogBinned, ccdf, fmt, superscript } from "../lib/stats.js";

/** Expected number of nodes with degree ≥ x in a random network, as a readable string (works down to 10^-300 and below). */
function expectedCount(N, avgk, x) {
  const log10 = (Math.log(N) + poissonLogSfGe(x, avgk)) / Math.LN10;
  if (log10 > -3) return fmt.sig(Math.pow(10, log10), 3);
  const e = Math.floor(log10), m = Math.pow(10, log10 - e);
  return `${m.toFixed(1)}×10${superscript(e)}`;
}
/** Smallest k with P(K ≤ k) ≥ q (scipy's poisson.ppf); terms below 1e-308 underflow harmlessly. */
function poissonPpf(q, lam) {
  let cdf = 0;
  for (let k = 0; ; k++) { cdf += Math.exp(poissonLogPmf(k, lam)); if (cdf >= q) return k; }
}

// ------------------------------------------------------------------ 1. random society
{
  let N = 7e9, k = 1000;
  const f = figure("#fig-society", { title: "If society were a random network", sub: "Poisson degrees with mean ⟨k⟩ among N people." });
  const t = stats(f.body, [
    { key: "max", label: "most connected person, k_max" }, { key: "min", label: "least connected, k_min" },
    { key: "sd", label: "σₖ = √⟨k⟩" }, { key: "lt", label: "k_max by the largest-term shortcut (N·pₖ = 1)" },
  ]);
  const plot = new Plot(f.body, { height: 240, x: { label: "number of acquaintances k" }, y: { label: "people, N·pₖ", type: "log" } });
  function draw() {
    const kmax = poissonIsf(1 / N, k);
    const kmin = poissonPpf(1 / N, k);
    let lt = Math.ceil(k);
    while (Math.exp(Math.log(N) + poissonLogPmf(lt, k)) > 1) lt++;
    t.set("max", fmt.int(kmax), `N·P(K > k_max) = 1`); t.set("min", fmt.int(kmin), "N·P(K ≤ k_min) = 1");
    t.set("sd", fmt.fix(Math.sqrt(k), 1), `typical range ${fmt.int(k - Math.sqrt(k))} … ${fmt.int(k + Math.sqrt(k))}`);
    t.set("lt", fmt.int(lt), "the book's Advanced Topic 3.B");
    const data = [];
    const sd = Math.sqrt(k);
    for (let x = Math.max(0, Math.floor(k - 9 * sd)); x <= k + 9 * sd; x += Math.max(1, Math.round(sd / 8))) data.push([x, Math.exp(Math.log(N) + poissonLogPmf(x, k))]);
    plot.update({
      series: [{ type: "line", data, color: "random", label: "random society" }],
      rules: [{ x: kmax, label: `k_max = ${fmt.int(kmax)}`, dashed: true }, { x: kmin, label: `k_min = ${fmt.int(kmin)}`, dashed: true, align: "left" }],
      y: { min: 1e-3, type: "log" }, xName: "k", yFormat: (v) => fmt.sig(v, 3),
    });
  }
  slider(f.controls, { label: "population N", min: 1e6, max: 1e10, log: true, step: 1, value: N, format: (v) => fmt.exp(v, 1), onInput: (v) => { N = v; draw(); }, wide: true });
  slider(f.controls, { label: "average acquaintances ⟨k⟩", min: 10, max: 3000, log: true, step: 1, value: k, format: (v) => fmt.int(v), onInput: (v) => { k = v; draw(); }, wide: true });
  draw();
  f.setCaption("Both extremes are computed exactly from the Poisson tails. The largest-term shortcut, N·pₖ ≈ 1 (used in the book's Advanced Topic 3.B), gives a slightly smaller k_max. With N = 10⁹ it reproduces the book's 1,185 to within one.");
}

// ------------------------------------------------------------------ 2. real networks against Poisson
(async () => {
  const { networks } = await loadNetworks();
  let name = "collaboration", view = "log", x = 50;
  const f = figure("#fig-compare", { title: "Real degree distribution versus a Poisson distribution with the same ⟨k⟩" });
  const t = stats(f.body, [
    { key: "pk", label: "Poisson k_max (random network)" }, { key: "ok", label: "observed k_max" },
    { key: "obs", label: "nodes with k ≥ x: observed" }, { key: "exp", label: "nodes with k ≥ x: expected if random" },
  ]);
  const plot = new Plot(f.body, { height: 320, x: { type: "log", label: "degree k" }, y: { type: "log", label: "pₖ" } });
  const sx = slider(f.controls, { label: "threshold x", min: 2, max: 300, step: 1, log: true, value: x, onInput: (v) => { x = Math.round(v); draw(); }, wide: true });
  function draw() {
    const d = networks[name], h0 = d.degreeHist, N = d.N, k = d.avgk;
    let obs = 0;
    h0.k.forEach((kk, i) => { if (kk >= x) obs += h0.count[i]; });
    t.set("pk", fmt.int(poissonIsf(1 / N, k)), `⟨k⟩ = ${k.toFixed(2)}`); t.set("ok", fmt.int(d.kmax));
    t.set("obs", fmt.int(obs), `x = ${x}`); t.set("exp", expectedCount(N, k, x), `x = ${x}`);
    const kmax = d.kmax;
    let dataSeries, theory = [], yLabel;
    if (view === "ccdf") {
      dataSeries = { type: "scatter", data: ccdf(h0).filter((p) => p[0] > 0), color: 1, label: `${tl(d.description)} (${tl("data")})`, r: 3.5 };
      for (let kk = 1; kk <= kmax; kk = kk < 60 ? kk + 1 : Math.ceil(kk * 1.05)) theory.push([kk, Math.exp(poissonLogSfGe(kk, k))]);
      yLabel = "P(K ≥ k)";
    } else {
      dataSeries = view === "log"
        ? { type: "scatter", data: pkLogBinned(h0).map(([a, b]) => [a, b]), color: 1, label: `${tl(d.description)} (${tl("log-binned")})`, r: 4.5 }
        : { type: "scatter", data: pkLinear(h0).filter((p) => p[0] > 0), color: 1, label: `${tl(d.description)} (${tl("linear bins, as the notebook")})`, r: 3.5 };
      for (let kk = 1; kk <= kmax; kk = kk < 60 ? kk + 1 : Math.ceil(kk * 1.05)) theory.push([kk, Math.exp(poissonLogPmf(kk, k))]);
      yLabel = "pₖ";
    }
    plot.update({
      series: [dataSeries, { type: "line", data: theory.filter((p) => p[1] > 1e-30), color: "random", label: `Poisson, ⟨k⟩ = ${k.toFixed(2)}` }],
      y: { type: "log", label: yLabel, min: Math.min(0.2 / N, 1e-7), max: 1 },
      rules: [{ x, label: `x = ${x}`, color: "theory" }, ...(view === "linear" ? [{ y: 1 / N, label: "pₖ = 1/N (a single node)", dashed: true, align: "left" }] : [])],
      xName: "k", yFormat: (v) => fmt.sig(v, 3),
    });
  }
  select(f.controls, { label: "Network", value: name, options: NETWORK_ORDER.map((n) => ({ value: n, label: networks[n].description })), onChange: (v) => { name = v; draw(); } });
  segmented(f.controls, {
    label: "Plot", value: view,
    options: [{ value: "log", label: "log bins" }, { value: "linear", label: "linear bins" }, { value: "ccdf", label: "CCDF" }],
    onChange: (v) => { view = v; draw(); },
  });
  draw();
  f.setCaption("With linear bins the tail collapses onto the plateau pₖ = 1/N, where each degree is held by a single node; log-binning or the CCDF (see How (not) to plot pₖ) shows the actual shape. In every view, the Poisson curve plunges where the data keep going.");

  // table: hubs no random network would produce
  const rows = NETWORK_ORDER.map((n) => {
    const d = networks[n], kp = poissonIsf(1 / d.N, d.avgk);
    let above = 0;
    d.degreeHist.k.forEach((kk, i) => { if (kk > kp) above += d.degreeHist.count[i]; });
    return [d.description, d.avgk, kp, d.kmax, above, expectedCount(d.N, d.avgk, d.kmax)];
  });
  document.getElementById("tbl-kmax").append(dataTable([
    { label: "Network", align: "left" }, { label: "⟨k⟩", format: (v) => v.toFixed(2) }, { label: "Poisson k_max", format: fmt.int },
    { label: "observed k_max", format: fmt.int }, { label: "nodes above the Poisson k_max", format: fmt.int },
    { label: "expected nodes with k ≥ observed k_max", align: "right" },
  ], rows));
})();
