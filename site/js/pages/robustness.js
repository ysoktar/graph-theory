import "../layout.js";
import { h, figure, slider, select, segmented, button, stats, dataTable } from "../lib/ui.js";
import { NetView } from "../lib/netview.js";
import { Plot } from "../lib/plot.js";
import { RNG } from "../lib/rng.js";
import { gnp, gnmPairs, CSRGraph, powerlawSequence, configurationGraph, giantComponent, components, removalCurve, subgraph } from "../lib/graph.js";
import { fmt } from "../lib/stats.js";
import { loadNetworks, loadRealGraph, WITH_EDGES } from "../lib/data.js";

const randomOrder = (n, rng) => { const o = Int32Array.from({ length: n }, (_, i) => i); rng.shuffle(o); return o; };
const degreeOrder = (g) => { const d = g.degrees(); return Int32Array.from({ length: g.n }, (_, i) => i).sort((a, b) => d[b] - d[a]); };
/** Molloy–Reed: a random-failure threshold f_c = 1 − 1/(κ − 1), κ = ⟨k²⟩/⟨k⟩. */
const molloyReed = (k1, k2) => 1 - 1 / (k2 / k1 - 1);

// ------------------------------------------------------------------ 1. watch a network break
{
  const N = 250;
  let f0 = 0, mode = "attack", seed = 2;
  const fig = figure("#fig-break", { title: "Removing nodes from a random and a scale-free network", sub: "Both have N = 250 and about the same ⟨k⟩. Largest remaining component in colour; removed nodes vanish.", cols: "cols-2" });
  const nets = {};
  const make = (key, title, color) => {
    const p = fig.panel(title);
    const state = { g: null, removed: new Set(), label: null, giant: -1 };
    state.view = new NetView(p, {
      height: 300, toolbar: false, charge: -14, linkDistance: 14, gravity: 0.12,
      nodeRadius: (i) => (state.removed.has(i) ? 0 : 1.6 + 1.1 * Math.sqrt(state.g.degree(i))),
      nodeColor: (i) => (state.label && state.label[i] === state.giant ? color : "random"),
      nodeOpacity: (i) => (state.removed.has(i) ? 0 : 1),
      edgeColor: (u, v) => (state.removed.has(u) || state.removed.has(v) ? null : "axis"),
    });
    state.title = p.querySelector(".panel-title");
    nets[key] = state;
  };
  make("er", "Random network", "s3");
  make("sf", "Scale-free network, γ = 2.3", "s1");
  const t = stats(fig.body, [{ key: "er", label: "random: largest component" }, { key: "sf", label: "scale-free: largest component" }]);
  t.el.style.gridColumn = "1 / -1";
  function build() {
    const rng = new RNG(seed);
    const sf = giantComponent(configurationGraph(powerlawSequence(N, 2.3, 1, rng), rng)).graph;
    const er = giantComponent(gnp(N, (2 * sf.m) / sf.n / (N - 1), rng)).graph;
    nets.er.g = er; nets.sf.g = sf;
    for (const s of Object.values(nets)) { s.order = { random: randomOrder(s.g.n, rng), attack: degreeOrder(s.g) }; s.view.setGraph(s.g, { keep: false }); }
    update();
  }
  function update() {
    for (const [key, s] of Object.entries(nets)) {
      const nrem = Math.round(f0 * s.g.n);
      s.removed = new Set(s.order[mode].slice(0, nrem));
      const keep = [];
      for (let i = 0; i < s.g.n; i++) if (!s.removed.has(i)) keep.push(i);
      const sub = subgraph(s.g, keep), c = components(sub.graph);
      s.label = new Int32Array(s.g.n).fill(-1);
      keep.forEach((v, i) => { s.label[v] = c.label[i]; });
      s.giant = c.giant;
      const share = c.giantSize / s.g.n;
      t.set(key, fmt.pct(share, 0), `of the original ${s.g.n} nodes`);
      s.title.textContent = `${key === "er" ? "Random network" : "Scale-free network, γ = 2.3"}: ${s.g.n} nodes, ⟨k⟩ = ${((2 * s.g.m) / s.g.n).toFixed(2)}`;
      s.view.redraw();
    }
  }
  slider(fig.controls, { label: "fraction of nodes removed f", min: 0, max: 0.6, step: 0.01, value: f0, format: (v) => fmt.pct(v, 0), onInput: (v) => { f0 = v; update(); }, wide: true });
  segmented(fig.controls, { label: "Removal", value: mode, options: [{ value: "random", label: "random failures" }, { value: "attack", label: "attack (largest degree first)" }], onChange: (v) => { mode = v; update(); } });
  button(fig.controls, { label: "New pair", icon: "dice", onClick: () => { seed++; build(); } });
  build();
  fig.setCaption("Under attack the scale-free network falls apart after losing a few per cent of its nodes: the hubs held it together. Under random failures it shrinks gracefully, because a randomly chosen node is almost never a hub.");
}

// ------------------------------------------------------------------ 2. real networks
(async () => {
  const { networks } = await loadNetworks();
  let name = "email";
  const f = figure("#fig-real", { title: "Random failures and attacks on a real network", sub: "Share of nodes in the largest component as nodes are removed, against a random network G(N, L) of the same size." });
  const t = stats(f.body, [{ key: "fc", label: "Molloy–Reed f_c (random failures)" }, { key: "half", label: "random failures: removed when the largest component halves" }, { key: "att", label: "attack: removed when it halves" }]);
  const status = h("div", { class: "status-line" });
  const plot = new Plot(f.body, { height: 320, x: { label: "fraction of nodes removed f", min: 0, max: 1 }, y: { label: "largest component / N", min: 0, max: 1 } });
  const curve = (arr, n) => { const out = []; const step = Math.max(1, Math.floor(n / 400)); for (let i = 0; i <= n; i += step) out.push([i / n, arr[i] / n]); return out; };
  const halfAt = (arr, n) => { for (let i = 0; i <= n; i++) if (arr[i] <= arr[0] / 2) return i / n; return 1; };
  async function draw() {
    const d = networks[name];
    status.textContent = `Loading ${d.description}…`;
    const g = await loadRealGraph(name);
    const rng = new RNG(1);
    const er = CSRGraph.fromPairs(d.N, gnmPairs(d.N, d.L, rng));
    const cur = { rr: removalCurve(g, randomOrder(g.n, rng)), ra: removalCurve(g, degreeOrder(g)), er: removalCurve(er, randomOrder(er.n, rng)), ea: removalCurve(er, degreeOrder(er)) };
    status.textContent = "";
    const fc = molloyReed(d.avgk, d.k2);
    t.set("fc", fmt.pct(fc, 1), `κ = ⟨k²⟩/⟨k⟩ = ${(d.k2 / d.avgk).toFixed(1)}; random network: ${fmt.pct(1 - 1 / d.avgk, 0)}`);
    t.set("half", fmt.pct(halfAt(cur.rr, g.n), 1)); t.set("att", fmt.pct(halfAt(cur.ra, g.n), 1), `random network: ${fmt.pct(halfAt(cur.ea, er.n), 1)}`);
    plot.update({
      series: [
        { type: "line", data: curve(cur.rr, g.n), color: 1, label: `${d.description}: random failures` },
        { type: "line", data: curve(cur.ra, g.n), color: 2, label: `${d.description}: attack` },
        { type: "line", data: curve(cur.er, er.n), color: "random", dashed: true, label: "G(N, L): random failures" },
        { type: "line", data: curve(cur.ea, er.n), color: "random", label: "G(N, L): attack" },
      ],
      rules: [{ x: fc, label: "Molloy–Reed f_c", dashed: true, color: "theory", align: fc > 0.8 ? "left" : "right" }], xName: "f", yFormat: (v) => fmt.pct(v, 1),
    });
  }
  select(f.controls, { label: "Network", value: name, options: WITH_EDGES.map((n) => ({ value: n, label: networks[n].description })), onChange: (v) => { name = v; draw(); } });
  f.controls.append(status);
  await draw();
  f.setCaption("The attack removes nodes in order of their original degree (a static attack). Recomputing degrees after every removal makes it even more damaging. The Molloy–Reed threshold assumes a network wired at random; real networks with clustering and communities break apart earlier.");

  document.getElementById("tbl-fc").append(dataTable([
    { label: "Network", align: "left" }, { label: "⟨k⟩", format: (v) => v.toFixed(2) }, { label: "κ = ⟨k²⟩/⟨k⟩", format: (v) => v.toFixed(1) },
    { label: "f_c, Molloy–Reed", format: (v) => fmt.pct(v, 1) }, { label: "f_c, random network with the same ⟨k⟩", format: (v) => fmt.pct(v, 1) },
  ], Object.values(networks).map((d) => [d.description, d.avgk, d.k2 / d.avgk, molloyReed(d.avgk, d.k2), 1 - 1 / d.avgk])));
})();
