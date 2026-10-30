import "../layout.js";
import { h, figure, slider, stats, dataTable } from "../lib/ui.js";
import { Plot, fnSeries } from "../lib/plot.js";
import { poissonIsf, fmt } from "../lib/stats.js";
import { loadNetworks, NETWORK_ORDER } from "../lib/data.js";
import { run } from "../lib/compute.js";

const natural = (N, g, kmin) => kmin * Math.pow(N, 1 / (g - 1));
/** Exponential p(k) = λe^{−λ(k − k_min)} with the same mean as the power law: k_max ≈ k_min + ln N / λ. */
const expo = (N, g, kmin) => kmin + Math.log(N) * ((kmin * (g - 1)) / (g - 2) - kmin);

// ------------------------------------------------------------------ 1. theory
{
  let gamma = 2.5, N = 1e6;
  const kmin = 1;
  const f = figure("#fig-theory", { title: "How large is the largest hub?", sub: "Natural cutoff of a power law against an exponential and a Poisson distribution with the same ⟨k⟩ (k_min = 1)." });
  const t = stats(f.body, [{ key: "pl", label: "power law: k_min N^(1/(γ−1))" }, { key: "ex", label: "exponential: k_min + ln N / λ" }, { key: "po", label: "Poisson: N·P(K > k_max) = 1" }, { key: "k", label: "⟨k⟩ of all three" }]);
  const plot = new Plot(f.body, { height: 300, x: { type: "log", label: "network size N" }, y: { type: "log", label: "largest degree k_max" } });
  function draw() {
    const mk = (kmin * (gamma - 1)) / (gamma - 2);
    t.set("pl", fmt.sig(natural(N, gamma, kmin), 3), `N = ${fmt.exp(N, 0)}`); t.set("ex", fmt.sig(expo(N, gamma, kmin), 3)); t.set("po", fmt.int(poissonIsf(1 / N, mk))); t.set("k", fmt.fix(mk, 2), "(γ − 1)/(γ − 2) for k_min = 1");
    const po = [];
    for (let e = 2; e <= 12.001; e += 0.25) po.push([Math.pow(10, e), poissonIsf(Math.pow(10, -e), mk)]);
    plot.update({
      series: [
        fnSeries((n) => natural(n, gamma, kmin), 100, 1e12, 60, { log: true, color: 1, label: `power law, γ = ${gamma.toFixed(2)}` }),
        fnSeries((n) => expo(n, gamma, kmin), 100, 1e12, 60, { log: true, color: 2, label: "exponential, same ⟨k⟩" }),
        { type: "line", data: po, color: "random", label: "Poisson, same ⟨k⟩" },
        fnSeries((n) => n - 1, 100, 1e12, 10, { log: true, color: "theory", dashed: true, label: "N − 1 (a node linked to all others)", tooltip: false }),
      ],
      rules: [{ x: N, label: `N = ${fmt.exp(N, 0)}`, color: "theory" }],
      xName: "N", yFormat: (v) => fmt.sig(v, 3),
    });
  }
  slider(f.controls, { label: "degree exponent γ", min: 2.05, max: 4, step: 0.01, value: gamma, format: (v) => v.toFixed(2), onInput: (v) => { gamma = v; draw(); }, wide: true });
  slider(f.controls, { label: "network size N", min: 100, max: 1e12, step: 1, log: true, value: N, format: (v) => fmt.exp(v, 0), onInput: (v) => { N = v; draw(); }, wide: true });
  draw();
  f.setCaption("The power-law hub grows like a power of N; the exponential one only like ln N; the Poisson one more slowly still. For γ close to 2 the exponent 1/(γ − 1) approaches 1, and the largest hub becomes comparable to the whole network.");
}

// ------------------------------------------------------------------ 2. simulation (worker)
{
  let gamma = 2.5, job = null;
  const f = figure("#fig-sim", { title: "Largest of N random degrees", sub: "Median over 50 samples per N (notebook cell 58), computed in a background thread." });
  const status = h("div", { class: "status-line" });
  const plot = new Plot(f.body, { height: 300, x: { type: "log", label: "number of nodes N" }, y: { type: "log", label: "k_max (median of 50 samples)" } });
  async function go() {
    if (job) job.cancel();
    const Ns = [];
    for (let e = 2; e <= 6.001; e += 0.5) Ns.push(Math.round(Math.pow(10, e)));
    const rows = [];
    job = run("kmaxVsN", { gamma, kmin: 1, Ns, reps: 50, seed: 3 }, (r) => {
      rows.push(r);
      status.textContent = `N = ${fmt.int(r.N)} done`;
      plot.update({
        series: [
          { type: "scatter", data: rows.map((x) => [x.N, x.pl]), color: 1, label: `power law, γ = ${gamma}`, r: 4.5 },
          { type: "scatter", data: rows.map((x) => [x.N, x.exp]), color: 2, label: "exponential, same ⟨k⟩", r: 4.5, symbol: "diamond" },
          { type: "scatter", data: rows.map((x) => [x.N, x.poisson]), color: "random", label: "Poisson, same ⟨k⟩", r: 4, symbol: "square" },
          fnSeries((n) => natural(n, gamma, 1), 100, 1e6, 30, { log: true, color: "theory", dashed: true, label: "theory: k_min N^(1/(γ−1)) and k_min + ln N / λ", tooltip: false }),
          fnSeries((n) => expo(n, gamma, 1), 100, 1e6, 30, { log: true, color: "theory", dashed: true, legend: false, tooltip: false }),
        ],
        xName: "N", yFormat: (v) => fmt.sig(v, 3),
      });
    });
    try { await job.promise; status.textContent = "Done."; } catch { /* cancelled */ }
  }
  slider(f.controls, { label: "γ", min: 2.1, max: 3.5, step: 0.1, value: gamma, format: (v) => v.toFixed(1), onChange: (v) => { gamma = v; go(); } });
  f.controls.append(status);
  go();
  f.setCaption("The samples grow with the slopes the theory predicts. They sit slightly above the dashed lines because the median of the maximum solves P(max ≤ k) = ½, not N·P(K ≥ k) = 1: for the power law that is (N/ln 2)^(1/(γ−1)), about 1.3 times the natural cutoff at γ = 2.5. The power-law maximum fluctuates strongly from sample to sample, which is why the median is shown. The Poisson value is its exact median, from P(max ≤ k) = F(k)^N.");
}

// ------------------------------------------------------------------ 3. real networks (notebook cell 59)
(async () => {
  const { networks } = await loadNetworks();
  const rows = NETWORK_ORDER.map((n) => {
    const d = networks[n], p = d.powerlaw;
    const cut = p.kmin * Math.pow(p.ntail, 1 / (p.gamma - 1));
    return [d.description, d.N, d.kmax, poissonIsf(1 / d.N, d.avgk), cut, d.kmax / cut, p.kmin, p.gamma];
  });
  document.getElementById("tbl-real").append(dataTable([
    { label: "Network", align: "left" }, { label: "N", format: fmt.int }, { label: "observed k_max", format: fmt.int },
    { label: "Poisson k_max", format: fmt.int }, { label: "natural cutoff k_min·n_tail^(1/(γ−1))", format: fmt.int },
    { label: "observed / cutoff", format: (v) => v.toFixed(2) }, { label: "k_min", format: fmt.int }, { label: "γ̂", format: (v) => v.toFixed(2) },
  ], rows, { highlight: (r) => r[5] > 1 }));
})();
