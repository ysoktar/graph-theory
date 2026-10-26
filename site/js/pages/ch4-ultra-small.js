import "../layout.js";
import { h, figure, segmented, dataTable } from "../lib/ui.js";
import { Plot } from "../lib/plot.js";
import { fmt } from "../lib/stats.js";
import { loadNetworks, NETWORK_ORDER } from "../lib/data.js";
import { run } from "../lib/compute.js";

const GAMMAS = [2.1, 2.5, 3.5];

// ------------------------------------------------------------------ 1. ⟨d⟩ versus N (worker, notebook cell 66)
(async () => {
  let baseline = "matched", rows = [];
  const f = figure("#fig-dn", { title: "Average distance versus network size", sub: "Configuration-model networks with power-law degrees (k_min = 2) against random networks. 3 networks per point, 60 BFS sources each, in a background thread." });
  const status = h("div", { class: "status-line" }, "Simulating…");
  const plot = new Plot(f.body, { height: 340, x: { type: "log", label: "number of nodes N" }, y: { label: "average distance ⟨d⟩", min: 0 } });
  const tbl = h("div");
  f.body.append(tbl);
  function draw() {
    const pick = (label) => rows.filter((r) => r.label === label).map((r) => [r.N, r.d, r]);
    const tip = (p) => [h("div", { class: "tt-title" }, `${p[2].label}, N = ${fmt.int(p[2].N)}`), h("div", {}, `⟨d⟩ = ${p[2].d.toFixed(2)}, realised ⟨k⟩ = ${p[2].avgk.toFixed(2)}`)];
    plot.update({
      series: [
        ...GAMMAS.map((g, i) => ({ type: "line", markers: true, data: pick(`γ = ${g}`), color: i + 1, label: `power law, γ = ${g}`, tooltip: tip })),
        ...(baseline === "matched"
          ? GAMMAS.map((g, i) => ({ type: "line", markers: true, data: pick(`random, matched to γ = ${g}`), color: i + 1, dashed: true, symbol: "square", label: `random network, same ⟨k⟩ as γ = ${g}`, tooltip: tip }))
          : [{ type: "line", markers: true, data: pick("random, ⟨k⟩ = 3"), color: "random", label: "random network, ⟨k⟩ = 3 (notebook)", tooltip: tip }]),
      ],
      xName: "N", yFormat: (v) => fmt.fix(v, 2), hover: "point",
    });
    const Ns = [...new Set(rows.map((r) => r.N))].sort((a, b) => a - b);
    tbl.replaceChildren(dataTable([{ label: "model", align: "left" }, ...Ns.map((N) => ({ label: `N = ${fmt.int(N)}` }))],
      [...new Set(rows.map((r) => r.label))].map((l) => [l, ...Ns.map((N) => { const r = rows.find((x) => x.label === l && x.N === N); return r ? `${r.d.toFixed(2)}, ⟨k⟩ = ${r.avgk.toFixed(1)}` : "…"; })])));
  }
  segmented(f.controls, { label: "Random baseline", value: baseline, options: [{ value: "matched", label: "same ⟨k⟩ as each power law" }, { value: "fixed", label: "⟨k⟩ = 3 for all (as the notebook)" }], onChange: (v) => { baseline = v; draw(); } });
  f.controls.append(status);
  const models = [
    ...GAMMAS.map((g) => ({ kind: "pl", gamma: g, kmin: 2, label: `γ = ${g}` })),
    ...GAMMAS.map((g) => ({ kind: "er", matchTo: `γ = ${g}`, label: `random, matched to γ = ${g}` })),
    { kind: "er", avgk: 3, label: "random, ⟨k⟩ = 3" },
  ];
  await run("distanceVsN", { models, Ns: [100, 300, 1000, 3000, 10000, 30000], reps: 3, sources: 60, seed: 21 }, (r) => { rows.push(r); status.textContent = `${r.label}, N = ${fmt.int(r.N)}`; draw(); }).promise;
  status.textContent = "Done.";
  f.setCaption("With γ = 2.1 the realised ⟨k⟩ is 7 to 8 and grows with N, because the hubs grow. Against a random network of that density the power law is still shorter, but by much less than against the notebook's ⟨k⟩ = 3. For γ = 3.5 the power law and its matched random network are practically the same.");
})();

// ------------------------------------------------------------------ 2. the book's networks
(async () => {
  const { networks } = await loadNetworks();
  const rows = NETWORK_ORDER.map((n) => { const d = networks[n]; return [d.description, d.N, d.powerlaw.gamma, d.distances.avg, d.nullModels.configuration.avgd, d.nullModels.er.avgd]; });
  document.getElementById("tbl-real").append(dataTable([
    { label: "Network", align: "left" }, { label: "N", format: fmt.int }, { label: "γ̂", format: (v) => v.toFixed(2) },
    { label: "observed ⟨d⟩", format: (v) => v.toFixed(2) }, { label: "same degrees, random wiring", format: (v) => v.toFixed(2) }, { label: "G(N, L)", format: (v) => v.toFixed(2) },
  ], rows, { highlight: (r) => r[4] < r[5] * 0.8 }));
})();
