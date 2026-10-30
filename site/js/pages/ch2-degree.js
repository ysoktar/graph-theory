import "../layout.js";
import { h, figure, segmented, select, button, stats, tex } from "../lib/ui.js";
import { GraphEditor, PRESETS } from "../lib/editor.js";
import { NetView } from "../lib/netview.js";
import { Plot } from "../lib/plot.js";
import { karateGraph, loadNetworks } from "../lib/data.js";
import { histogram, pkLinear, fmt, histMoments, arrMax, arrMin } from "../lib/stats.js";
import { LANG } from "../i18n.js";

const TR = LANG === "tr", IN = TR ? "giriş" : "in", OUT = TR ? "çıkış" : "out";

// ------------------------------------------------------------------ 1. editor
{
  const f = figure("#fig-editor", {
    title: "Your network", cols: "split",
    sub: "Degrees, the average degree and the degree distribution update as you edit.",
  });
  const left = f.panel(null), right = f.panel(null);
  const formula = h("div", { class: "eq", style: { margin: "0 0 10px" } });
  const tiles = stats(null, [
    { key: "N", label: "nodes N" }, { key: "L", label: "links L" }, { key: "avg", label: "average degree" },
    { key: "max", label: "largest degree" }, { key: "odd", label: "odd-degree nodes" },
  ]);
  const degList = h("div", { class: "small", style: { margin: "8px 0", color: "var(--text-2)", lineHeight: 1.8 } });
  right.append(formula, tiles.el, degList);
  const plot = new Plot(right, { height: 190, x: { label: "degree k", integer: true }, y: { label: "pₖ", max: null }, legend: false });

  const ed = new GraphEditor(left, {
    height: 360,
    onChange: update,
    nodeColor: (i, e) => {
      if (!e.directed) return "s1";
      const d = e.degrees();
      return d.kin[i] > d.kout[i] ? "s2" : d.kout[i] > d.kin[i] ? "s3" : "s1";
    },
  });

  function update(e) {
    const N = e.n, L = e.arcs.length, d = e.degrees();
    const kmax = N ? arrMax(d.k) : 0;
    tiles.set("N", N);
    tiles.set("L", L);
    tiles.set("max", N ? kmax : "–");
    tiles.set("odd", N ? d.k.filter((k) => k % 2).length : "–");
    if (e.directed) {
      tiles.set("avg", N ? fmt.fix(L / N, 2) : "–", "⟨k_in⟩ = ⟨k_out⟩");
      tex(formula, N ? `\\langle k^{\\text{${IN}}}\\rangle = \\langle k^{\\text{${OUT}}}\\rangle = \\frac{L}{N} = \\frac{${L}}{${N}} = ${fmt.fix(L / N, 2)},\\quad \\textstyle\\sum k^{\\text{${IN}}} = \\sum k^{\\text{${OUT}}} = ${L}` : (TR ? "\\text{Birkaç düğüm ekleyin}" : "\\text{Add some nodes}"), true);
      degList.replaceChildren(...(N ? [h("strong", {}, "(k_in, k_out) by node: "), d.kin.map((x, i) => `${i}: (${x}, ${d.kout[i]})`).join(", ")] : []));
      e.view.setLegend([{ label: "more in than out", color: "s2" }, { label: "more out than in", color: "s3" }, { label: "balanced", color: "s1" }]);
    } else {
      tiles.set("avg", N ? fmt.fix((2 * L) / N, 2) : "–", "⟨k⟩ = 2L/N");
      const sum = d.k.reduce((a, b) => a + b, 0);
      tex(formula, N ? `\\langle k\\rangle = \\frac{2L}{N} = \\frac{2\\cdot ${L}}{${N}} = ${fmt.fix((2 * L) / N, 2)},\\qquad \\textstyle\\sum_i k_i = ${sum} = 2L` : (TR ? "\\text{Birkaç düğüm ekleyin}" : "\\text{Add some nodes}"), true);
      degList.replaceChildren(...(N ? [h("strong", {}, "Degree by node: "), d.k.map((x, i) => `k${sub(i)} = ${x}`).join(", ")] : []));
      e.view.setLegend([]);
    }
    const hist = histogram(e.directed ? d.kin : d.k);
    plot.update({
      series: [{ id: "pk", type: "bar", data: N ? pkLinear(hist) : [], color: 1, label: e.directed ? "in-degree distribution" : "pₖ" }],
      x: { label: e.directed ? "in-degree k_in" : "degree k" }, xName: "k",
      yFormat: (v) => fmt.fix(v, 3),
    });
  }

  select(f.controls, {
    label: "Start from", value: "example",
    options: [
      { value: "example", label: "Example" }, { value: "empty", label: "Empty canvas" }, { value: "triangle", label: "Triangle" },
      { value: "star", label: "Star" }, { value: "path", label: "Path" }, { value: "ring", label: "Ring" }, { value: "complete", label: "Complete graph" },
    ],
    onChange: (v) => { const p = PRESETS[v](); ed.load(p.pos, p.edges); },
  });
  segmented(f.controls, {
    label: "Links", value: "undirected",
    options: [{ value: "undirected", label: "Undirected" }, { value: "directed", label: "Directed" }],
    onChange: (v) => ed.setDirected(v === "directed"),
  });
  const btns = h("div", { class: "btn-row" });
  button(btns, { label: "Delete selected node", onClick: () => ed.deleteSelected() });
  f.controls.append(btns);
  f.setCaption("Click empty space to add a node; click one node, then another, to add or remove the link between them. Select a node and press <kbd>Delete</kbd> to remove it. In directed mode the first node clicked is the source.");

  requestAnimationFrame(() => { const p = PRESETS.example(); ed.load(p.pos, p.edges); });
}
function sub(i) { return String(i).split("").map((c) => "₀₁₂₃₄₅₆₇₈₉"[c]).join(""); }

// ------------------------------------------------------------------ 2. karate club
(async () => {
  const f = figure("#fig-karate", { title: "Zachary's karate club", sub: "Node size grows with degree; hover a node for its degree.", cols: "split" });
  const { graph: K, club } = await karateGraph();
  const left = f.panel(null), right = f.panel(null);
  const d = K.degrees();
  new NetView(left, {
    height: 380, charge: -90, linkDistance: 40,
    nodeRadius: (i) => 4 + 1.5 * Math.sqrt(d[i]) * 1.6,
    nodeColor: (i) => (club[i] === "Mr. Hi" ? "s1" : "s2"),
    edgeColor: () => "axis", edgeWidth: () => 1.2,
    label: (i) => (i === 0 || i === 33 ? String(i) : null),
    tooltip: (i) => `member ${i} · degree ${d[i]} · ${club[i] === "Mr. Hi" ? "Mr. Hi's faction" : "president's faction"}`,
    legend: [{ label: "Mr. Hi's faction", color: "s1" }, { label: "President's faction", color: "s2" }],
  }).setGraph(K);
  const L = K.m, N = K.n;
  const t = stats(right, [
    { key: "N", label: "members N" }, { key: "L", label: "links L" }, { key: "avg", label: "⟨k⟩ = 2L/N" },
    { key: "max", label: "largest degree" }, { key: "min", label: "smallest degree" },
  ]);
  t.set("N", N); t.set("L", L); t.set("avg", fmt.fix((2 * L) / N, 2));
  t.set("max", 17, "node 33"); t.set("min", arrMin(d));
  const p = new Plot(right, { height: 220, x: { label: "degree k", integer: true }, y: { label: "pₖ" }, legend: false });
  p.update({ series: [{ type: "bar", data: pkLinear(histogram(d)), color: 1, label: "pₖ", format: (v, row) => `${fmt.fix(v, 3)} (${Math.round(v * N)} members)` }], xName: "k" });
})();

// ------------------------------------------------------------------ 3. collaboration network
(async () => {
  const f = figure("#fig-collab", { title: "Science collaboration network: degree distribution", sub: "Book data, N = 23,133 scientists. One bar per degree." });
  const { networks } = await loadNetworks();
  const net = networks.collaboration;
  const h0 = net.degreeHist;
  const m = histMoments(h0);
  const N = m.n;
  let below10 = 0, above100 = 0;
  h0.k.forEach((k, i) => { if (k <= 10) below10 += h0.count[i]; if (k >= 100) above100 += h0.count[i]; });
  // median
  let acc = 0, med = 0;
  for (let i = 0; i < h0.k.length; i++) { acc += h0.count[i]; if (acc >= N / 2) { med = h0.k[i]; break; } }
  const t = stats(f.body, [
    { key: "avg", label: "average ⟨k⟩" }, { key: "med", label: "median degree" }, { key: "max", label: "largest k_max" },
    { key: "low", label: "share with k ≤ 10" }, { key: "hubs", label: "nodes with k ≥ 100" },
  ]);
  t.set("avg", fmt.fix(m.mean, 2)); t.set("med", med); t.set("max", m.kmax); t.set("low", fmt.pct(below10 / N)); t.set("hubs", above100);
  const plot = new Plot(f.body, { height: 280, x: { label: "degree k", min: 0 }, y: { label: "pₖ" }, legend: false });
  let yType = "linear";
  const draw = () => {
    plot.axes({ y: { type: yType, label: "pₖ", min: yType === "log" ? 1e-5 : undefined } });
    plot.update({
      series: [{ type: "bar", data: pkLinear(h0).filter((d) => d[0] > 0), color: 1, label: "pₖ", maxWidth: 6, format: (v) => `${fmt.sig(v, 3)} (${Math.round(v * N).toLocaleString()} scientists)` }],
      rules: [{ x: m.kmax, label: `k_max = ${m.kmax}`, align: "left", dashed: true }], xName: "k",
    });
  };
  segmented(f.controls, { label: "Vertical axis", value: "linear", options: [{ value: "linear", label: "Linear" }, { value: "log", label: "Log" }], onChange: (v) => { yType = v; draw(); } });
  draw();
})();
