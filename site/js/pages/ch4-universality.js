import "../layout.js";
import { h, figure, segmented, dataTable } from "../lib/ui.js";
import { Plot } from "../lib/plot.js";
import { ccdf, hurwitzZeta, poissonLogSfGe, fmt } from "../lib/stats.js";
import { loadNetworks, loadJSON, NETWORK_ORDER } from "../lib/data.js";

(async () => {
  const [{ networks }, gof] = await Promise.all([loadNetworks(), loadJSON("data/gof.json")]);
  let form = "discrete";
  const f = figure("#fig-multiples", { title: "Eight networks, one procedure", sub: "P(K ≥ k) of each network (blue), a Poisson distribution with the same ⟨k⟩ (grey) and the fitted power-law tail (dashed).", cols: "cols-4" });
  const plots = NETWORK_ORDER.map((n) => {
    const d = networks[n];
    const p = f.panel(`${d.description}: γ̂ = ${d.powerlaw.gamma.toFixed(2)}, k_min = ${d.powerlaw.kmin}`);
    return { d, plot: new Plot(p, { height: 190, legend: false, table: false, margin: { top: 8, right: 8, bottom: 34, left: 44 }, x: { type: "log", label: "k" }, y: { type: "log", label: "P(K ≥ k)", min: 0.5 / d.N, max: 1.5 } }) };
  });
  function draw() {
    for (const { d, plot } of plots) {
      const p = d.powerlaw, share = p.tailShare;
      const data = ccdf(d.degreeHist).filter((x) => x[0] > 0);
      const pois = [];
      for (let k = 1; k <= Math.max(12, 6 * d.avgk); k++) { const v = Math.exp(poissonLogSfGe(k, d.avgk)); if (v > 0.5 / d.N) pois.push([k, v]); }
      const tail = [];
      const z0 = hurwitzZeta(p.gamma, p.kmin);
      for (let k = p.kmin; k <= d.kmax; k = Math.max(k + 1, Math.round(k * 1.1))) tail.push([k, form === "discrete" ? (share * hurwitzZeta(p.gamma, k)) / z0 : share * Math.pow(k / p.kmin, 1 - p.gamma)]);
      plot.update({
        series: [
          { type: "scatter", data, color: 1, label: "data", r: 2.2 },
          { type: "line", data: pois, color: "random", label: "Poisson, same ⟨k⟩" },
          { type: "line", data: tail, color: "theory", dashed: true, label: form === "discrete" ? "discrete power-law fit" : "continuous approximation (notebook)" },
        ],
        xName: "k", yFormat: (v) => fmt.sig(v, 3),
      });
    }
  }
  segmented(f.controls, { label: "Fitted tail drawn as", value: form, options: [{ value: "discrete", label: "discrete CCDF ζ(γ, k)/ζ(γ, k_min)" }, { value: "continuous", label: "continuous (k/k_min)^(1−γ), as the notebook" }], onChange: (v) => { form = v; draw(); } });
  draw();
  f.setCaption("Switch to the continuous form and look at email and the WWW, whose tails start at small k_min: the dashed line lifts off the data just above k_min. The fit itself is discrete, so the discrete curve is the right one to draw.");

  const rows = NETWORK_ORDER.map((n) => {
    const d = networks[n], p = d.powerlaw, g = gof[n];
    const ex = p.compare.exponential, ln = p.compare.lognormal;
    return [d.description, d.N, d.kmax, p.kmin, `${p.gamma.toFixed(2)} ± ${p.sigma.toFixed(2)}`, p.tailShare, g.p, `${ex.R.toFixed(1)} (p ${fmt.sig(ex.p, 2)})`, `${ln.R.toFixed(2)} (p ${fmt.sig(ln.p, 2)})`];
  });
  document.getElementById("tbl-fits").append(dataTable([
    { label: "Network", align: "left" }, { label: "N", format: fmt.int }, { label: "k_max", format: fmt.int }, { label: "k_min", format: fmt.int }, { label: "γ̂ ± σ" },
    { label: "tail share", format: (v) => fmt.pct(v, 1) }, { label: "GoF p", format: (v) => v.toFixed(3), cls: (v) => (v >= 0.1 ? "good" : "bad") },
    { label: "R vs exponential" }, { label: "R vs log-normal" },
  ], rows));
})();
