import "../layout.js";
import { h, figure, stats } from "../lib/ui.js";
import { Plot, fnSeries } from "../lib/plot.js";
import { ccdf, fitPowerLaw, fmt } from "../lib/stats.js";
import { run } from "../lib/compute.js";

const C = 1.255; // Bianconi–Barabási constant for uniform fitness on [0, 1] (book Section 6.3)
const PLANTED = [{ t: 10, eta: 0.3 }, { t: 100, eta: 0.6 }, { t: 1000, eta: 1 }];

(async () => {
  const N = 50000, m = 2;
  const f = figure("#fig-race", { title: "Late but fit: the race for links", sub: `N = ${fmt.int(N)}, m = 2, fitness η drawn uniformly from [0, 1]; three nodes have their fitness fixed. Built in a background thread.`, cols: "cols-2" });
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
