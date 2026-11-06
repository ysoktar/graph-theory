import "../layout.js";
import { h, figure, slider, select, segmented, button, stats, dataTable, color, onThemeChange, debounce, tex, renderMath } from "../lib/ui.js";
import { NetView } from "../lib/netview.js";
import { Plot, fnSeries } from "../lib/plot.js";
import { RNG } from "../lib/rng.js";
import { gnp, gnmPairs, CSRGraph, powerlawSequence, configurationGraph, giantComponent, components, removalCurve, subgraph } from "../lib/graph.js";
import { fmt, histogram, pkLogBinned, logLogFit } from "../lib/stats.js";
import { DISTRIBUTIONS, pmf, moments, fcRandom, fcAttack, giantRandom, giantAttack, fcAttackPowerLaw, fcRandomPowerLaw } from "../lib/degdist.js";
import { loadNetworks, loadRealGraph, WITH_EDGES } from "../lib/data.js";
import { t as tl, LANG } from "../i18n.js";

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
      s.title.textContent = `${tl(key === "er" ? "Random network" : "Scale-free network, γ = 2.3")}: ${s.g.n} ${tl("nodes")}, ⟨k⟩ = ${((2 * s.g.m) / s.g.n).toFixed(2)}`;
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
    status.textContent = LANG === "tr" ? `${tl(d.description)} yükleniyor…` : `Loading ${d.description}…`;
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
        { type: "line", data: curve(cur.rr, g.n), color: 1, label: `${tl(d.description)}: ${tl("random failures")}` },
        { type: "line", data: curve(cur.ra, g.n), color: 2, label: `${tl(d.description)}: ${tl("attack")}` },
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

// ================================================================== percolation on a square lattice
{
  const L = 70;
  const f = figure("#fig-lattice", { title: "Percolation on a square lattice", sub: `A ${L}×${L} lattice. Each site is occupied with probability p; neighbouring occupied sites form clusters. The largest cluster is coloured.`, cols: "split" });
  const left = f.panel(null), right = f.panel(null);
  const canvas = h("canvas", { width: 560, height: 560, style: { width: "100%", maxWidth: "420px", aspectRatio: "1", display: "block", margin: "0 auto", borderRadius: "8px" } });
  left.append(canvas);
  const t = stats(right, [{ key: "pinf", tex: "P_\\infty", label: "(share of sites in the largest cluster)" }, { key: "s", tex: "\\langle s\\rangle", label: "(mean finite cluster size)" }]);
  const plot = new Plot(right, { height: 210, x: { label: "occupation probability p", min: 0, max: 1 }, y: { label: "P∞", min: 0, max: 1 } });
  let rng = new RNG(11), u = new Float64Array(L * L), p = 0.55;
  const reroll = () => { for (let i = 0; i < u.length; i++) u[i] = rng.random(); };
  function clusters(pp) {
    const parent = Int32Array.from({ length: L * L }, (_, i) => i), size = new Int32Array(L * L).fill(1);
    const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
    const union = (a, b) => { a = find(a); b = find(b); if (a === b) return; if (size[a] < size[b]) [a, b] = [b, a]; parent[b] = a; size[a] += size[b]; };
    for (let r = 0; r < L; r++) for (let c = 0; c < L; c++) {
      const i = r * L + c;
      if (u[i] >= pp) continue;
      if (c + 1 < L && u[i + 1] < pp) union(i, i + 1);
      if (r + 1 < L && u[i + L] < pp) union(i, i + L);
    }
    let big = -1, bigSize = 0;
    const sizes = new Map();
    for (let i = 0; i < L * L; i++) if (u[i] < pp) { const r = find(i); sizes.set(r, size[r]); if (size[r] > bigSize) { bigSize = size[r]; big = r; } }
    let s1 = 0, s2 = 0;
    for (const [r, s] of sizes) if (r !== big) { s1 += s; s2 += s * s; }
    return { find, big, pinf: bigSize / (L * L), meanS: s1 ? s2 / s1 : 0 };
  }
  let curve = [];
  function draw() {
    const cl = clusters(p);
    const ctx = canvas.getContext("2d"), cs = canvas.width / L;
    ctx.fillStyle = color("surface-2"); ctx.fillRect(0, 0, canvas.width, canvas.height);
    const cBig = color("s2"), cOther = color("random");
    for (let i = 0; i < L * L; i++) {
      if (u[i] >= p) continue;
      ctx.fillStyle = cl.find(i) === cl.big ? cBig : cOther;
      ctx.fillRect((i % L) * cs + 0.5, Math.floor(i / L) * cs + 0.5, cs - 1, cs - 1);
    }
    t.set("pinf", fmt.fix(cl.pinf, 3), `p = ${p.toFixed(2)}`); t.set("s", fmt.fix(cl.meanS, 1));
    plot.update({ series: [{ type: "line", markers: true, data: curve, color: 2, label: "largest cluster P∞(p)" }], rules: [{ x: 0.5927, label: "p_c ≈ 0.593", dashed: true }, { x: p, label: "p" }] });
  }
  function rebuildCurve() { curve = []; for (let pp = 0.3; pp <= 1.0001; pp += 0.025) curve.push([+pp.toFixed(3), clusters(pp).pinf]); }
  slider(f.controls, { label: "occupation probability p", min: 0, max: 1, step: 0.01, value: p, format: (v) => v.toFixed(2), onInput: (v) => { p = v; draw(); }, wide: true });
  button(f.controls, { label: "New lattice", icon: "dice", onClick: () => { reroll(); rebuildCurve(); draw(); } });
  reroll(); rebuildCurve(); draw();
  onThemeChange(draw);
  f.setCaption("Move p slowly through 0.59. Below it only small clusters exist; just above it one cluster suddenly spans the lattice, and the mean size of the other clusters peaks at the transition. Each site keeps its random number, so raising p only adds sites: this is the same experiment as removing a fraction f = 1 − p of the nodes, run backwards.");
}

// ================================================================== choose a degree distribution
{
  const f = figure("#fig-calc", { title: "Choose a degree distribution", sub: "A randomly wired network (configuration model) with the chosen pₖ. Left: the distribution. Right: the giant component after random failures and after an attack, solved exactly with generating functions.", cols: "cols-2" });
  const left = f.panel("Degree distribution pₖ"), right = f.panel("Giant component S after removing a fraction f");
  const formula = h("div", { class: "small", style: { margin: "0 0 .4rem" } });
  left.append(formula);
  const pkPlot = new Plot(left, { height: 240, x: { type: "log", label: "degree k" }, y: { type: "log", label: "pₖ" }, legend: false });
  const sPlot = new Plot(right, { height: 240, x: { label: "fraction of nodes removed f", min: 0, max: 1 }, y: { label: "S", min: 0, max: 1 } });
  const t = stats(f.body, [{ key: "k", tex: "\\langle k\\rangle" }, { key: "k2", tex: "\\langle k^2\\rangle" }, { key: "kappa", tex: "\\kappa" }, { key: "fr", tex: "f_c", label: "random", hl: true }, { key: "fa", tex: "f_c", label: "attack", hl: true }, { key: "fer", tex: "f_c^{ER}", label: "same ⟨k⟩" }]);
  const paramHost = h("div", { class: "fig-controls", style: { padding: 0 } });
  let type = "powerlaw", params = {};
  const run = debounce(update, 120);
  function paramControls() {
    paramHost.replaceChildren();
    params = {};
    for (const [key, [val, lo, hi, step, label]] of Object.entries(DISTRIBUTIONS[type].params)) {
      params[key] = val;
      slider(paramHost, { label, min: lo, max: hi, step, value: val, format: (v) => (step >= 1 ? String(v) : v.toFixed(step < 0.01 ? 3 : step < 0.1 ? 2 : 1)), onInput: (v) => { params[key] = v; run(); } });
    }
    tex(formula, DISTRIBUTIONS[type].tex);
  }
  function update() {
    const pk = pmf(type, params), m = moments(pk);
    const pts = [];
    for (let k = 1; k < pk.length; k++) if (pk[k] > 1e-12) pts.push([k, pk[k]]);
    pkPlot.update({ series: [{ type: pts.length > 60 ? "line" : "scatter", markers: pts.length <= 60, data: pts, color: 1, r: 4 }] });
    const fr = fcRandom(m.kappa), fa = fcAttack(pk), fer = m.m1 > 1 ? 1 - 1 / m.m1 : 0;
    const n = 36, rnd = [], atk = [];
    for (let i = 0; i <= n; i++) { const x = i / n; rnd.push([x, giantRandom(pk, x)]); }
    const amax = Math.min(1, Math.max(0.05, fa * 1.6));
    for (let i = 0; i <= n; i++) { const x = (i / n) * amax; atk.push([x, giantAttack(pk, x)]); }
    sPlot.update({ series: [{ type: "line", data: rnd, color: 1, label: "random failures" }, { type: "line", data: atk, color: 2, label: "attack (largest degree first)" }],
      rules: [fr > 0 ? { x: fr, label: "f_c random", dashed: true } : null, fa > 0 ? { x: fa, label: "f_c attack", dashed: true } : null].filter(Boolean) });
    t.set("k", fmt.fix(m.m1, 2)); t.set("k2", fmt.sig(m.m2, 3)); t.set("kappa", fmt.sig(m.kappa, 3), m.kappa > 2 ? "> 2: a giant component exists" : "≤ 2: no giant component");
    t.set("fr", fmt.pct(fr, 1), "1 − 1/(κ − 1)"); t.set("fa", fmt.pct(fa, 1), "top-degree nodes removed"); t.set("fer", fmt.pct(fer, 1), "1 − 1/⟨k⟩");
    renderMath(f.body);
  }
  select(f.controls, { label: "Distribution", value: type, options: Object.entries(DISTRIBUTIONS).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => { type = v; paramControls(); update(); } });
  f.controls.append(paramHost);
  paramControls(); update();
  f.setCaption("Try the power law: raising log₁₀ N pushes the random threshold towards 1, while the attack threshold stays at a few per cent. The Poisson and regular networks have no hubs, so failures and attacks hurt them about equally. The bimodal network with one hub (r = 1/N) and the rest equal is the design that best resists both (Section 8.7). These are exact results for random wiring with the chosen pₖ; real networks with clustering or geography break earlier.");
}

// ================================================================== f_c versus γ
{
  const f = figure("#fig-gamma", { title: "Thresholds against the degree exponent", sub: "Random failures and attacks on scale-free networks. Solid: the book's continuum formulas (8.9) and (8.12). Dashed: exact values for integer degrees." });
  const plot = new Plot(f.body, { height: 300, x: { label: "degree exponent γ", min: 2, max: 4.5 }, y: { label: "critical fraction f_c", min: 0, max: 1 } });
  let kmin = 2, logN = 4;
  function draw() {
    const N = Math.pow(10, logN), gs = [];
    for (let g = 2.05; g <= 4.5001; g += 0.05) gs.push(+g.toFixed(2));
    const bookR = [], bookA = [], exR = [], exA = [];
    for (const g of gs) {
      bookR.push([g, fcRandomPowerLaw(g, kmin, N).fc]);
      const a = fcAttackPowerLaw(g, kmin); if (Number.isFinite(a)) bookA.push([g, a]);
      const pk = pmf("powerlaw", { gamma: g, kmin, logN });
      exR.push([g, fcRandom(moments(pk).kappa)]); exA.push([g, fcAttack(pk)]);
    }
    plot.update({ series: [
      { type: "line", data: bookR, color: 1, label: "random failures, Eq. (8.9)" },
      { type: "line", data: bookA, color: 2, label: "attack, Eq. (8.12)" },
      { type: "line", data: exR, color: 1, dashed: true, label: "random failures, exact" },
      { type: "line", data: exA, color: 2, dashed: true, label: "attack, exact" },
    ], bands: [{ x0: 2, x1: 3, label: "2 < γ < 3", opacity: 0.04 }] });
  }
  segmented(f.controls, { label: "k_min", value: "2", options: [{ value: "1", label: "1" }, { value: "2", label: "2" }, { value: "3", label: "3" }], onChange: (v) => { kmin = +v; draw(); } });
  slider(f.controls, { label: "log₁₀ N", min: 3, max: 8, step: 0.5, value: logN, format: (v) => v.toFixed(1), onInput: (v) => { logN = v; draw(); } });
  draw();
  f.setCaption("Below γ = 3 random failures need almost every node removed, and more so the larger N; attacks need only a few per cent to some tens of per cent. Above γ = 3 the network behaves like a random one. The continuum formulas replace sums over integer degrees by integrals and overestimate both thresholds when k_min is small; simulations on networks of 10⁵ nodes agree with the dashed curves.");
}

// ================================================================== cascades: the failure propagation model
{
  const N = 2000;
  const f = figure("#fig-cascade", { title: "Cascading failures: the failure propagation model", sub: `A random network of ${fmt.int(N)} nodes. A node fails once at least a fraction φ of its neighbours have failed. Each run starts from one randomly failed node.`, cols: "split" });
  const left = f.panel(null), right = f.panel(null);
  const plot = new Plot(left, { height: 260, x: { type: "log", label: "cascade size s (failed nodes)" }, y: { type: "log", label: "p(s)" } });
  const t = stats(right, [{ key: "global", label: "global cascades (> 10% of nodes)", hl: true }, { key: "mean", label: "mean size of the others" }, { key: "regime", label: "regime" }]);
  let avgk = 3, phi = 0.18, seed = 1;
  function simulate() {
    const rng = new RNG(seed);
    const g = gnp(N, avgk / (N - 1), rng), { off, nbr } = g.csr();
    const deg = new Int32Array(N); for (let v = 0; v < N; v++) deg[v] = off[v + 1] - off[v];
    const sizes = [];
    const failed = new Uint8Array(N), hits = new Int32Array(N), touched = [];
    for (let run = 0; run < 600; run++) {
      const s0 = rng.int(N), queue = [s0];
      failed[s0] = 1; touched.length = 0; touched.push(s0);
      let size = 1;
      while (queue.length) {
        const v = queue.pop();
        for (let j = off[v]; j < off[v + 1]; j++) {
          const w = nbr[j];
          if (failed[w]) continue;
          if (hits[w] === 0) touched.push(w);
          hits[w]++;
          if (hits[w] >= phi * deg[w]) { failed[w] = 1; size++; queue.push(w); }
        }
      }
      for (const v of touched) { failed[v] = 0; hits[v] = 0; }
      sizes.push(size);
    }
    const global = sizes.filter((s) => s > 0.1 * N), small = sizes.filter((s) => s <= 0.1 * N);
    const binned = pkLogBinned(histogram(sizes), 5).filter((d) => d[1] > 0);
    plot.update({ series: [
      { type: "scatter", data: binned, color: 2, r: 4.5, label: "simulated" },
      fnSeries((s) => 0.5 * Math.pow(s, -1.5), 1, N, 40, { log: true, color: "theory", dashed: true, label: "slope −3/2" }),
    ] });
    const shareG = global.length / sizes.length, meanSmall = small.reduce((a, b) => a + b, 0) / Math.max(1, small.length);
    t.set("global", fmt.pct(shareG, 0), `${global.length} of ${sizes.length} runs`);
    t.set("mean", fmt.fix(meanSmall, 1), "nodes");
    t.set("regime", shareG > 0.3 ? "supercritical" : shareG > 0.005 ? "near critical" : "subcritical", shareG > 0.3 ? "most seeds trigger a global cascade" : shareG > 0.005 ? "sizes of every scale" : "cascades die out quickly");
  }
  const run = debounce(simulate, 150);
  slider(f.controls, { label: "average degree ⟨k⟩", min: 1, max: 12, step: 0.25, value: avgk, format: (v) => v.toFixed(2), onInput: (v) => { avgk = v; run(); } });
  slider(f.controls, { label: "threshold φ", min: 0.05, max: 0.5, step: 0.01, value: phi, format: (v) => v.toFixed(2), onInput: (v) => { phi = v; run(); } });
  button(f.controls, { label: "New network", icon: "dice", onClick: () => { seed++; simulate(); } });
  simulate();
  f.setCaption("With φ = 0.18, try ⟨k⟩ = 1.05, 3, 6 and 10 (the book's Fig. 8.20). Sparse networks rarely let a cascade start; very dense ones protect every node with many healthy neighbours; in between, one failure can bring down most of the network. At the edges of that window the cascade sizes follow a power law with exponent close to 3/2.");
}

// ================================================================== the branching model
{
  const f = figure("#fig-branch", { title: "The branching model of an avalanche", sub: "Each failed node triggers k new failures, k drawn from pₖ with mean 1 (the critical point). 20,000 avalanches; the sizes of very large ones are capped at 10⁵." });
  const plot = new Plot(f.body, { height: 280, x: { type: "log", label: "avalanche size s" }, y: { type: "log", label: "p(s)" } });
  const t = stats(f.body, [{ key: "alpha", tex: "\\alpha", label: "predicted", hl: true }, { key: "fit", tex: "\\hat\\alpha", label: "fitted slope" }]);
  let kind = "poisson", gamma = 2.5, seed = 3;
  function offspring() {
    if (kind === "poisson") { const p = [Math.exp(-1)]; for (let k = 1; k < 40; k++) p.push(p[k - 1] / k); return p; } // e⁻¹/k!
    const K = 20000; let s0 = 0, s1 = 0;
    for (let k = 1; k <= K; k++) { s0 += Math.pow(k, -gamma); s1 += Math.pow(k, 1 - gamma); }
    const c = 1 / s1, p = [Math.max(0, 1 - c * s0)];
    for (let k = 1; k <= K; k++) p.push(c * Math.pow(k, -gamma));
    return p;
  }
  function simulate() {
    const p = offspring(), cum = new Float64Array(p.length);
    let acc = 0; for (let k = 0; k < p.length; k++) { acc += p[k]; cum[k] = acc; }
    const draw = (u) => { let lo = 0, hi = cum.length - 1; u *= acc; while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < u) lo = m + 1; else hi = m; } return lo; };
    const rng = new RNG(seed), sizes = [], CAP = 1e5;
    for (let run = 0; run < 20000; run++) {
      let active = 1, size = 1;
      while (active > 0 && size < CAP) { const k = draw(rng.random()); active += k - 1; size += k; }
      sizes.push(Math.min(size, CAP));
    }
    const binned = pkLogBinned(histogram(sizes.filter((s) => s < CAP)), 5).filter((d) => d[1] > 0);
    const alpha = kind === "poisson" || gamma >= 3 ? 1.5 : gamma / (gamma - 1);
    const fitPts = binned.filter((d) => d[0] >= 3 && d[0] <= 3e4);
    const fit = logLogFit(fitPts.map((d) => d[0]), fitPts.map((d) => d[1]));
    const a0 = binned.length ? binned[0][1] * Math.pow(binned[0][0], alpha) : 1;
    plot.update({ series: [
      { type: "scatter", data: binned, color: 2, r: 4.5, label: "simulated avalanches" },
      fnSeries((s) => a0 * Math.pow(s, -alpha), 1, 1e5, 40, { log: true, color: "theory", dashed: true, label: `slope −${alpha.toFixed(2)}` }),
    ] });
    t.set("alpha", alpha.toFixed(2), kind === "poisson" ? "narrow pₖ: 3/2" : gamma >= 3 ? "γ ≥ 3: 3/2" : "γ/(γ − 1)");
    t.set("fit", fit ? (-fit.slope).toFixed(2) : "–", "log-binned, s from 3 to 3×10⁴");
  }
  const run = debounce(simulate, 150);
    slider(f.controls, { label: "γ of pₖ", min: 2.1, max: 4, step: 0.05, value: gamma, format: (v) => v.toFixed(2), onInput: (v) => { gamma = v; run(); } });
  segmented(f.controls, { label: "Offspring pₖ", value: kind, options: [{ value: "poisson", label: "Poisson, mean 1" }, { value: "powerlaw", label: "power law, mean 1" }], onChange: (v) => { kind = v; run(); } });
  button(f.controls, { label: "Rerun", icon: "dice", onClick: () => { seed++; simulate(); } });
  
  simulate();
  f.setCaption("At the critical point each failure triggers on average one more, so some avalanches die at once and others run very far: there is no typical size. With a narrow offspring distribution p(s) falls as s^(−3/2), the return time of a random walk. With a scale-free one and 2 < γ < 3 the exponent is γ/(γ − 1), between 1.5 and 2, which is the range measured for blackouts, Twitter cascades and earthquakes.");
}
