import "../layout.js";
import { h, figure, select, stats, dataTable } from "../lib/ui.js";
import { NetView } from "../lib/netview.js";
import { Plot } from "../lib/plot.js";
import { loadNetworks, loadJSON, sampleGraph, NETWORK_ORDER } from "../lib/data.js";
import { fmt, pkLogBinned, poissonPmf } from "../lib/stats.js";

(async () => {
  const [{ networks }, gof] = await Promise.all([loadNetworks(), loadJSON("data/gof.json")]);
  const CAT = { biological: "biological", technological: "technological", social: "social", information: "information" };

  // ---------------------------------------------------------------- explorer
  const f = figure("#fig-explore", { title: "A closer look", cols: "split" });
  const left = f.panel(null), right = f.panel(null);
  let current = "powergrid";
  let sample = null;
  const nv = new NetView(left, {
    height: 420, charge: -18, linkDistance: 14, gravity: 0.08,
    nodeRadius: (i) => 2 + 1.1 * Math.sqrt(Math.min(sample.fullDegree[i], 400)),
    nodeColor: () => "s1", edgeColor: () => "axis",
    tooltip: (i) => `degree ${fmt.int(sample.fullDegree[i])} in the full network (${sample.graph.degree(i)} within this sample)`,
  });
  const note = h("p", { class: "fig-note", style: { margin: "6px 0 0" } });
  left.append(note);
  const tiles = stats(right, [
    { key: "N", label: "nodes N" }, { key: "L", label: "links L" }, { key: "k", label: "⟨k⟩" }, { key: "kmax", label: "largest degree" },
    { key: "gc", label: "giant component" }, { key: "C", label: "⟨C⟩" }, { key: "d", label: "⟨d⟩" }, { key: "g", label: "γ̂ (k ≥ k_min)" },
  ]);
  const plot = new Plot(right, { height: 230, x: { type: "log", label: "degree k" }, y: { type: "log", label: "pₖ" } });

  async function show(name) {
    current = name;
    const d = networks[name];
    sample = await sampleGraph(name);
    nv.setGraph(sample.graph, { keep: false });
    note.textContent = `${d.description}: a random-walk sample of ${sample.graph.n} nodes (node size grows with the degree in the full network of ${fmt.int(d.N)} nodes). Originally ${d.originallyDirected ? "directed" : "undirected"}; ${CAT[d.category]}.`;
    tiles.set("N", fmt.int(d.N)); tiles.set("L", fmt.int(d.L)); tiles.set("k", fmt.fix(d.avgk, 2)); tiles.set("kmax", fmt.int(d.kmax));
    tiles.set("gc", fmt.pct(d.components.giantFraction), `${fmt.int(d.components.count)} component${d.components.count === 1 ? "" : "s"}`);
    tiles.set("C", fmt.fix(d.clustering.avg, 3)); tiles.set("d", fmt.fix(d.distances.avg, 2));
    tiles.set("g", fmt.fix(d.powerlaw.gamma, 2), `k_min = ${d.powerlaw.kmin} · p = ${gof[name].p < 0.001 ? "<0.001" : fmt.fix(gof[name].p, 2)}`);
    const lb = pkLogBinned(d.degreeHist);
    const kk = [];
    for (let k = 1; k <= Math.min(d.kmax, Math.max(40, 6 * d.avgk)); k++) kk.push([k, poissonPmf(k, d.avgk)]);
    plot.update({
      series: [
        { id: "data", type: "scatter", data: lb.map(([x, y]) => [x, y]), color: 1, label: "data (log-binned)" },
        { id: "poisson", type: "line", data: kk.filter((p) => p[1] > 1e-12), color: "random", label: `Poisson, same ⟨k⟩ = ${fmt.fix(d.avgk, 2)}` },
      ],
      y: { type: "log", label: "pₖ", min: Math.max(1e-12, 0.2 / d.N / 10) }, xName: "k",
    });
  }
  select(f.controls, {
    label: "Network", value: current,
    options: NETWORK_ORDER.map((n) => ({ value: n, label: networks[n].description })),
    onChange: show,
  });
  await show(current);

  // ---------------------------------------------------------------- table
  const rows = NETWORK_ORDER.map((n) => {
    const d = networks[n];
    return [d.description, d.N, d.L, d.avgk, d.kmax, d.sigmak / d.avgk, d.components.giantFraction, d.clustering.avg, d.distances.avg, d.assortativity, d.powerlaw.gamma, d.powerlaw.kmin, gof[n].p];
  });
  document.getElementById("tbl-all").append(dataTable([
    { label: "Network", align: "left" }, { label: "N", format: fmt.int }, { label: "L", format: fmt.int },
    { label: "⟨k⟩", format: (v) => fmt.fix(v, 2) }, { label: "k_max", format: fmt.int }, { label: "σₖ/⟨k⟩", format: (v) => fmt.fix(v, 2) },
    { label: "giant comp.", format: (v) => fmt.pct(v) }, { label: "⟨C⟩", format: (v) => fmt.fix(v, 3) }, { label: "⟨d⟩", format: (v) => fmt.fix(v, 2) },
    { label: "r", format: (v) => fmt.fix(v, 3) }, { label: "γ̂", format: (v) => fmt.fix(v, 2) }, { label: "k_min", format: fmt.int },
    { label: "p (power law)", format: (v) => (v < 0.001 ? "< 0.001" : fmt.fix(v, 3)), cls: (v) => (v < 0.1 ? "bad" : "") },
  ], rows));
})();
