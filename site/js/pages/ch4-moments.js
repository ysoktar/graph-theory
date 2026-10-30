import "../layout.js";
import { h, figure, slider, stats, dataTable } from "../lib/ui.js";
import { Plot, fnSeries } from "../lib/plot.js";
import { fmt } from "../lib/stats.js";
import { loadNetworks, NETWORK_ORDER, SHORT } from "../lib/data.js";
import { run } from "../lib/compute.js";

/** n-th moment of the continuous power law on [k_min, k_max] (book Eq. for ⟨kⁿ⟩, Section 4.4). */
function moment(n, g, kmin, kmax) {
  const a = n - g + 1;
  if (Math.abs(a) < 1e-9) return (g - 1) * Math.pow(kmin, g - 1) * Math.log(kmax / kmin);
  return ((g - 1) / a) * Math.pow(kmin, g - 1) * (Math.pow(kmax, a) - Math.pow(kmin, a));
}

// ------------------------------------------------------------------ 1. moments with the natural cutoff
{
  let gamma = 2.5, N = 1e6;
  const kmin = 1;
  const f = figure("#fig-theory", { title: "Moments of a power law with its natural cutoff", sub: "Continuous power law on [k_min, k_max] with k_max = k_min N^(1/(γ−1)) and k_min = 1." });
  const t = stats(f.body, [{ key: "k1", label: "⟨k⟩" }, { key: "k2", label: "⟨k²⟩" }, { key: "sd", label: "σₖ" }, { key: "ratio", label: "σₖ / √⟨k⟩ (Poisson: 1)" }]);
  const plot = new Plot(f.body, { height: 280, x: { type: "log", label: "network size N" }, y: { type: "log", label: "moment" } });
  function draw() {
    const km = (n) => kmin * Math.pow(n, 1 / (gamma - 1));
    const m1 = moment(1, gamma, kmin, km(N)), m2 = moment(2, gamma, kmin, km(N)), sd = Math.sqrt(Math.max(0, m2 - m1 * m1));
    t.set("k1", fmt.sig(m1, 3), gamma > 2 ? "finite as N → ∞" : "diverges"); t.set("k2", fmt.sig(m2, 3), gamma > 3 ? "finite as N → ∞" : "diverges as N → ∞");
    t.set("sd", fmt.sig(sd, 3)); t.set("ratio", fmt.sig(sd / Math.sqrt(m1), 3));
    plot.update({
      series: [
        fnSeries((n) => moment(1, gamma, kmin, km(n)), 10, 1e12, 60, { log: true, color: 1, label: "⟨k⟩" }),
        fnSeries((n) => moment(2, gamma, kmin, km(n)), 10, 1e12, 60, { log: true, color: 2, label: "⟨k²⟩" }),
        fnSeries((n) => moment(3, gamma, kmin, km(n)), 10, 1e12, 60, { log: true, color: 3, label: "⟨k³⟩" }),
      ],
      rules: [{ x: N, label: `N = ${fmt.exp(N, 0)}`, color: "theory" }], xName: "N", yFormat: (v) => fmt.sig(v, 3),
    });
  }
  slider(f.controls, { label: "degree exponent γ", min: 1.8, max: 4.5, step: 0.01, value: gamma, format: (v) => v.toFixed(2), onInput: (v) => { gamma = v; draw(); }, wide: true });
  slider(f.controls, { label: "network size N", min: 10, max: 1e12, step: 1, log: true, value: N, format: (v) => fmt.exp(v, 0), onInput: (v) => { N = v; draw(); }, wide: true });
  draw();
  f.setCaption("A moment ⟨kⁿ⟩ levels off as N grows only when n < γ − 1. For 2 < γ < 3 the average degree settles while ⟨k²⟩ keeps growing, like N^((3−γ)/(γ−1)).");
}

// ------------------------------------------------------------------ 2. sample moments (worker, notebook cell 61)
{
  let gamma = 2.5, job = null;
  const f = figure("#fig-sim", { title: "Sample moments of N random degrees", sub: "Median over 30 samples per N: power law (k_min = 1) against Poisson with the same mean.", cols: "cols-2" });
  const pa = f.panel("First moment ⟨k⟩ converges"), pb = f.panel("Second moment ⟨k²⟩");
  const A = new Plot(pa, { height: 250, x: { type: "log", label: "N" }, y: { label: "⟨k⟩", min: 0 } });
  const B = new Plot(pb, { height: 250, x: { type: "log", label: "N" }, y: { type: "log", label: "⟨k²⟩" } });
  const status = h("div", { class: "status-line" });
  async function go() {
    if (job) job.cancel();
    const Ns = [];
    for (let e = 2; e <= 6.001; e += 0.5) Ns.push(Math.round(Math.pow(10, e)));
    const rows = [];
    job = run("momentsVsN", { gamma, kmin: 1, Ns, reps: 30, seed: 5 }, (r) => {
      rows.push(r);
      status.textContent = `N = ${fmt.int(r.N)} done`;
      A.update({ series: [{ type: "line", markers: true, data: rows.map((x) => [x.N, x.m1pl]), color: 1, label: `power law, γ = ${gamma}` }, { type: "line", markers: true, data: rows.map((x) => [x.N, x.m1po]), color: "random", label: "Poisson, same mean" }], xName: "N", yFormat: (v) => fmt.fix(v, 3) });
      B.update({
        series: [
          { type: "line", markers: true, data: rows.map((x) => [x.N, x.m2pl]), color: 1, label: `power law, γ = ${gamma}` },
          { type: "line", markers: true, data: rows.map((x) => [x.N, x.m2po]), color: "random", label: "Poisson, same mean" },
          gamma < 3 ? fnSeries((n) => rows[0].m2pl * Math.pow(n / 100, (3 - gamma) / (gamma - 1)), 100, 1e6, 20, { log: true, color: "theory", dashed: true, label: "∝ N^((3−γ)/(γ−1))", tooltip: false }) : null,
        ],
        xName: "N", yFormat: (v) => fmt.sig(v, 3),
      });
    });
    try { await job.promise; status.textContent = "Done."; } catch { /* cancelled */ }
  }
  slider(f.controls, { label: "γ", min: 2.1, max: 3.9, step: 0.1, value: gamma, format: (v) => v.toFixed(1), onChange: (v) => { gamma = v; go(); } });
  f.controls.append(status);
  go();
}

// ------------------------------------------------------------------ 3. real networks: ⟨k⟩ ± σ (notebook cell 62, book Fig. 4.8)
(async () => {
  const { networks } = await loadNetworks();
  const nets = NETWORK_ORDER.map((n) => networks[n]).sort((a, b) => a.sigmak / a.avgk - b.sigmak / b.avgk);
  const f = figure("#fig-real", { title: "Real networks have no typical degree", sub: "⟨k⟩ ± σₖ of each network (blue) against a random network with the same ⟨k⟩, ⟨k⟩ ± √⟨k⟩ (grey). Sorted by σₖ/⟨k⟩." });
  const plot = new Plot(f.body, {
    height: 340, legend: true, x: { label: "degree k", min: -45, max: 55 },
    y: { label: "", min: -0.7, max: nets.length - 0.3, tickValues: nets.map((_, i) => i), format: (v) => SHORT[nets[v]?.name] || "", grid: false },
    margin: { top: 12, right: 18, bottom: 42, left: 96 },
  });
  plot.update({
    series: [
      ...nets.map((d, i) => ({ type: "line", data: [[d.avgk - d.sigmak, i], [d.avgk + d.sigmak, i]], color: 1, width: 4, label: i === 0 ? "⟨k⟩ ± σₖ (data)" : undefined, legend: i === 0, tooltip: false })),
      ...nets.map((d, i) => ({ type: "line", data: [[d.avgk - Math.sqrt(d.avgk), i + 0.28], [d.avgk + Math.sqrt(d.avgk), i + 0.28]], color: "random", width: 4, label: i === 0 ? "⟨k⟩ ± √⟨k⟩ (random network)" : undefined, legend: i === 0, tooltip: false })),
      { type: "scatter", data: nets.map((d, i) => [d.avgk, i, d]), color: 1, r: 4.5, label: "⟨k⟩", legend: false, tooltip: (p) => [h("div", { class: "tt-title" }, p[2].description), h("div", {}, `⟨k⟩ = ${p[2].avgk.toFixed(2)}, σₖ = ${p[2].sigmak.toFixed(2)}`), h("div", {}, `random network: σₖ = ${Math.sqrt(p[2].avgk).toFixed(2)}`)] },
    ],
    rules: [{ x: 0 }], xName: "k", hover: "point",
  });
  f.body.append(dataTable([
    { label: "Network", align: "left" }, { label: "⟨k⟩", format: (v) => v.toFixed(2) }, { label: "σₖ", format: (v) => v.toFixed(2) }, { label: "√⟨k⟩ (random)", format: (v) => v.toFixed(2) },
    { label: "σₖ / √⟨k⟩", format: (v) => v.toFixed(1) }, { label: "σₖ / ⟨k⟩", format: (v) => v.toFixed(2) }, { label: "⟨k²⟩/⟨k⟩", format: (v) => v.toFixed(1) },
  ], nets.map((d) => [d.description, d.avgk, d.sigmak, Math.sqrt(d.avgk), d.sigmak / Math.sqrt(d.avgk), d.sigmak / d.avgk, d.k2 / d.avgk]), { highlight: (r) => r[4] < 2 }));
  f.setCaption("Bars that run below zero are not an error: when σₖ exceeds ⟨k⟩ the interval ⟨k⟩ ± σₖ includes negative degrees, a sign that the average and the standard deviation are a poor summary. Email's interval reaches far off the chart (⟨k⟩ = 3.2, σₖ = 35). Highlighted: the networks whose σₖ is less than twice the random value.");
})();
