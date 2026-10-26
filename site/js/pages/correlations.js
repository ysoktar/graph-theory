import "../layout.js";
import { h, figure, select, segmented, button, stats, dataTable } from "../lib/ui.js";
import { NetView } from "../lib/netview.js";
import { Plot, fnSeries } from "../lib/plot.js";
import { RNG } from "../lib/rng.js";
import { powerlawSequence, configurationGraph, giantComponent, assortativity, neighborDegree } from "../lib/graph.js";
import { logLogFit, fmt } from "../lib/stats.js";
import { loadNetworks, NETWORK_ORDER } from "../lib/data.js";

// ------------------------------------------------------------------ 1. rewire towards (dis)assortativity
{
  let g, edges, rng, mode = "assortative";
  const f = figure("#fig-rewire", { title: "Same degrees, different correlations", sub: "A scale-free network (N = 300, γ = 2.5). Degree-preserving swaps are accepted only when they make hubs link more (or less) to hubs.", cols: "split" });
  const pn = f.panel(null), pr = f.panel(null);
  const nv = new NetView(pn, {
    height: 380, charge: -20, linkDistance: 16, gravity: 0.1,
    nodeRadius: (i) => 2 + 1.1 * Math.sqrt(g.degree(i)), nodeColor: (i) => (g.degree(i) >= 10 ? "s2" : "s1"),
    edgeColor: (u, v) => (g.degree(u) >= 10 && g.degree(v) >= 10 ? "s2" : "axis"), edgeWidth: (u, v) => (g.degree(u) >= 10 && g.degree(v) >= 10 ? 2 : 0.9),
    legend: [{ label: "hubs (k ≥ 10)", color: "s2" }, { label: "other nodes", color: "s1" }], tooltip: (i) => `degree ${g.degree(i)}`,
  });
  const t = stats(pr, [{ key: "r", label: "assortativity r" }, { key: "hh", label: "links between hubs" }, { key: "sw", label: "accepted swaps" }]);
  const plot = new Plot(pr, { height: 220, x: { type: "log", label: "degree k" }, y: { type: "log", label: "k_nn(k)" } });
  let accepted = 0;
  function reset() {
    rng = new RNG(4);
    g = giantComponent(configurationGraph(powerlawSequence(300, 2.5, 2, rng), rng)).graph;
    edges = g.edges(); accepted = 0;
    nv.setGraph(g, { keep: false }); paint();
  }
  function paint() {
    let hh = 0;
    for (const [u, v] of edges) if (g.degree(u) >= 10 && g.degree(v) >= 10) hh++;
    t.set("r", fmt.fix(assortativity(g), 3)); t.set("hh", hh); t.set("sw", fmt.int(accepted));
    const kn = neighborDegree(g).byDegree;
    plot.update({ series: [{ type: "scatter", data: kn, color: 1, label: "k_nn(k)", r: 3.5 }], xName: "k", yFormat: (v) => fmt.fix(v, 1) });
  }
  function rewire(n) {
    const sgn = mode === "assortative" ? 1 : -1;
    for (let it = 0; it < n; it++) {
      const i = rng.int(edges.length); let j = rng.int(edges.length - 1); if (j >= i) j++;
      let [a, b] = edges[i]; const [c, d] = edges[j];
      if (rng.random() < 0.5) [a, b] = [b, a];
      if (a === d || c === b || a === c || b === d || g.hasEdge(a, d) || g.hasEdge(c, b)) continue;
      const k = (x) => g.degree(x);
      const delta = k(a) * k(d) + k(c) * k(b) - k(a) * k(b) - k(c) * k(d);
      if (sgn * delta <= 0) continue;
      g.removeEdge(a, b); g.removeEdge(c, d); g.addEdge(a, d); g.addEdge(c, b);
      edges[i] = [a, d]; edges[j] = [c, b]; accepted++;
    }
    nv.setGraph(g, { keep: true, alpha: 0.4 }); paint();
  }
  segmented(f.controls, { label: "Push towards", value: mode, options: [{ value: "assortative", label: "assortative (hubs with hubs)" }, { value: "dis", label: "disassortative (hubs with small nodes)" }], onChange: (v) => { mode = v; } });
  const row = h("div", { class: "btn-row" });
  f.controls.append(row);
  button(row, { label: "200 swap attempts", icon: "step", onClick: () => rewire(200) });
  button(row, { label: "2,000 attempts", onClick: () => rewire(2000) });
  button(row, { label: "Reset", icon: "reset", onClick: reset });
  reset();
  f.setCaption("Every node keeps its degree, so the degree distribution is identical throughout; only who links to whom changes. Assortative rewiring gathers the hubs into a core; disassortative rewiring spreads them out like hubs-and-spokes. A swap is accepted when it raises (or lowers) the sum of k_u k_v over the links, which is what r measures.");
}

// ------------------------------------------------------------------ 2. real networks
(async () => {
  const { networks } = await loadNetworks();
  let name = "collaboration";
  const f = figure("#fig-knn", { title: "Degree correlation function k_nn(k)", sub: "Average degree of the neighbours of nodes with degree k, against the neutral expectation ⟨k²⟩/⟨k⟩." });
  const t = stats(f.body, [{ key: "r", label: "assortativity r" }, { key: "mu", label: "fitted μ in k_nn ∝ k^μ" }, { key: "cfg", label: "r after random wiring (same degrees)" }, { key: "ks", label: "structural cutoff √(⟨k⟩N)" }]);
  const plot = new Plot(f.body, { height: 320, x: { type: "log", label: "degree k" }, y: { type: "log", label: "k_nn(k)" } });
  function draw() {
    const d = networks[name];
    const data = d.knn.k.map((k, i) => [k, d.knn.knn[i]]).filter((p) => p[1] > 0);
    const fit = logLogFit(data.map((p) => p[0]), data.map((p) => p[1]));
    const ks = Math.sqrt(d.avgk * d.N);
    t.set("r", fmt.fix(d.assortativity, 3), d.assortativity > 0.05 ? "assortative" : d.assortativity < -0.05 ? "disassortative" : "roughly neutral");
    t.set("mu", fmt.fix(fit.slope, 2)); t.set("cfg", fmt.fix(d.nullModels.configuration.r, 3), "structural correlations only");
    t.set("ks", fmt.int(ks), d.kmax > ks ? `k_max = ${fmt.int(d.kmax)} exceeds it` : `k_max = ${fmt.int(d.kmax)} is below it`);
    plot.update({
      series: [
        { type: "scatter", data, color: 1, label: d.description, r: 3 },
        fnSeries((k) => Math.pow(10, fit.intercept) * Math.pow(k, fit.slope), data[0][0], data[data.length - 1][0], 10, { log: true, color: 1, thin: true, label: `fit: k^${fit.slope.toFixed(2)}`, tooltip: false }),
        fnSeries(() => d.k2 / d.avgk, data[0][0], data[data.length - 1][0], 2, { log: true, color: "theory", dashed: true, label: "neutral: ⟨k²⟩/⟨k⟩", tooltip: false }),
      ],
      rules: [{ x: ks, label: "structural cutoff", dashed: true, color: "random" }], xName: "k", yFormat: (v) => fmt.sig(v, 3),
    });
  }
  select(f.controls, { label: "Network", value: name, options: NETWORK_ORDER.map((n) => ({ value: n, label: networks[n].description })), onChange: (v) => { name = v; draw(); } });
  draw();
  document.getElementById("tbl-r").append(dataTable([
    { label: "Network", align: "left" }, { label: "r (data)", format: (v) => v.toFixed(3) }, { label: "r, same degrees wired at random", format: (v) => v.toFixed(3) },
    { label: "k_max", format: fmt.int }, { label: "√(⟨k⟩N)", format: fmt.int }, { label: "type", align: "left" },
  ], NETWORK_ORDER.map((n) => { const d = networks[n]; return [d.description, d.assortativity, d.nullModels.configuration.r, d.kmax, Math.sqrt(d.avgk * d.N), d.assortativity > 0.05 ? "assortative" : d.assortativity < -0.05 ? "disassortative" : "neutral"]; })));
})();
