import "../layout.js";
import { figure, slider, segmented, stats } from "../lib/ui.js";
import { Plot } from "../lib/plot.js";
import { RNG } from "../lib/rng.js";
import { gnpCSR } from "../lib/graph.js";
import { poissonPmf, binomPmf, histogram, pkLinear, fmt } from "../lib/stats.js";

// ------------------------------------------------------------------ 1. simulated random networks of three sizes
{
  let k = 10, yType = "linear";
  const Ns = [500, 5000, 50000];
  const f = figure("#fig-sim", { title: "Degree distributions of simulated random networks", sub: "Three sizes, the same average degree ⟨k⟩." });
  const t = stats(f.body, [{ key: "sd", label: "σₖ = √⟨k⟩" }, { key: "in", label: "share within ⟨k⟩ ± 3σₖ" }, { key: "max", label: "largest degree (N = 50,000)" }]);
  const plot = new Plot(f.body, { height: 300, x: { label: "degree k", min: 0, integer: true }, y: { label: "pₖ" } });
  function run() {
    const rng = new RNG(2026);
    const sims = Ns.map((N) => {
      const g = gnpCSR(N, k / (N - 1), rng);
      return { N, h: histogram(g.degrees()) };
    });
    const kmax = Math.ceil(k + 6 * Math.sqrt(k) + 6);
    const th = [];
    for (let x = 0; x <= kmax; x++) th.push([x, poissonPmf(x, k)]);
    const sd = Math.sqrt(k);
    let inside = 0;
    for (let x = Math.ceil(k - 3 * sd); x <= Math.floor(k + 3 * sd); x++) if (x >= 0) inside += poissonPmf(x, k);
    t.set("sd", fmt.fix(sd, 2)); t.set("in", fmt.pct(inside, 2)); t.set("max", sims[2].h.k[sims[2].h.k.length - 1]);
    plot.axes({ y: { type: yType, label: "pₖ", min: yType === "log" ? 1e-5 : undefined } });
    plot.update({
      series: [
        ...sims.map((s, i) => ({ id: "n" + s.N, type: "scatter", data: pkLinear(s.h), color: i + 1, label: `simulation, N = ${fmt.int(s.N)}`, r: 4.2, symbol: ["circle", "square", "triangle"][i] })),
        { type: "line", data: th, color: "theory", dashed: true, label: `Poisson, ⟨k⟩ = ${k}` },
      ],
      x: { max: kmax }, xName: "k", yFormat: (v) => fmt.sig(v, 3),
    });
  }
  slider(f.controls, { label: "average degree ⟨k⟩", min: 1, max: 30, step: 0.5, value: k, onChange: (v) => { k = v; run(); }, wide: true });
  segmented(f.controls, { label: "Vertical axis", value: "linear", options: [{ value: "linear", label: "Linear" }, { value: "log", label: "Log" }], onChange: (v) => { yType = v; run(); } });
  run();
  f.setCaption("The ⟨k⟩ slider updates on release, because the largest network has 50,000 nodes and about 250,000 links (generated in your browser). With ⟨k⟩ = 10, as in the notebook, σₖ = 3.16 and 99.65% of nodes lie within k = 10 ± 9.5.");
}

// ------------------------------------------------------------------ 2. binomial versus Poisson
{
  let N = 20, k = 4;
  const f = figure("#fig-binpoi", { title: "Exact binomial versus its Poisson approximation", sub: "Theory only: the exact degree distribution of G(N, p) with p = ⟨k⟩/(N − 1)." });
  const t = stats(f.body, [{ key: "var", label: "binomial variance ⟨k⟩(1 − p)" }, { key: "pv", label: "Poisson variance ⟨k⟩" }, { key: "d", label: "largest difference in pₖ" }]);
  const plot = new Plot(f.body, { height: 280, x: { label: "degree k", min: -0.5, integer: true }, y: { label: "pₖ" } });
  function draw() {
    const p = k / (N - 1);
    const kmax = Math.min(N - 1, Math.ceil(k + 6 * Math.sqrt(k) + 4));
    const bin = [], poi = [];
    let dmax = 0;
    for (let x = 0; x <= kmax; x++) {
      const b = binomPmf(x, N - 1, p), q = poissonPmf(x, k);
      bin.push([x, b]); poi.push([x, q]);
      dmax = Math.max(dmax, Math.abs(b - q));
    }
    t.set("var", fmt.fix(k * (1 - p), 3)); t.set("pv", fmt.fix(k, 3)); t.set("d", fmt.fix(dmax, 4));
    plot.update({
      series: [
        { type: "bar", data: bin, color: 1, label: `binomial, N = ${N}`, format: (v) => v.toFixed(4) },
        { type: "line", data: poi, color: "theory", dashed: true, markers: true, r: 3, label: `Poisson, ⟨k⟩ = ${k}`, format: (v) => v.toFixed(4) },
      ],
      x: { max: kmax + 0.5 }, xName: "k",
    });
  }
  slider(f.controls, { label: "nodes N", min: 5, max: 400, step: 1, value: N, log: true, onInput: (v) => { N = Math.max(Math.ceil(k) + 2, Math.round(v)); draw(); }, wide: true });
  slider(f.controls, { label: "average degree ⟨k⟩", min: 0.5, max: 10, step: 0.5, value: k, onInput: (v) => { k = v; if (N < k + 2) N = Math.ceil(k) + 2; draw(); } });
  draw();
}
