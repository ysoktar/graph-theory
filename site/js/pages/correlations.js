import "../layout.js";
import { h, figure, select, segmented, button, stats, dataTable, slider, debounce, whenVisible, color, onThemeChange } from "../lib/ui.js";
import { MatrixView } from "../lib/matrixview.js";
import { pmf, moments } from "../lib/degdist.js";
import { NetView } from "../lib/netview.js";
import { Plot, fnSeries } from "../lib/plot.js";
import { RNG } from "../lib/rng.js";
import { powerlawSequence, configurationGraph, configurationModel, giantComponent, assortativity, neighborDegree, gnmPairs } from "../lib/graph.js";
import { logLogFit, fmt } from "../lib/stats.js";
import { loadNetworks, NETWORK_ORDER } from "../lib/data.js";

// ------------------------------------------------------------------ 1. rewire towards (dis)assortativity
fig_rewire: {
  if (!document.getElementById("fig-rewire")) break fig_rewire; // only on the page that shows it
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
  if (!document.getElementById("fig-knn")) return; // only on the page that shows it
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

// ================================================================== shared helpers on edge lists (pairs = [u0, v0, u1, v1, …])
const degreesOf = (n, pairs) => { const d = new Int32Array(n); for (const v of pairs) d[v]++; return d; };
const adjOf = (n, pairs) => { const a = Array.from({ length: n }, () => []); for (let e = 0; e < pairs.length; e += 2) { a[pairs[e]].push(pairs[e + 1]); a[pairs[e + 1]].push(pairs[e]); } return a; };
/** Pearson correlation of the degrees at the two ends of a link (multi-links and self-loops allowed). */
function rOf(n, pairs, deg = degreesOf(n, pairs)) {
  let m = 0, a = 0, b = 0, c = 0;
  for (let e = 0; e < pairs.length; e += 2) { const x = deg[pairs[e]], y = deg[pairs[e + 1]]; m++; a += x * y; b += (x + y) / 2; c += (x * x + y * y) / 2; }
  const mu = b / m, den = c / m - mu * mu;
  return den > 0 ? (a / m - mu * mu) / den : NaN;
}
/** k_nn averaged over the nodes in logarithmic degree bins: [[k, k_nn]]. */
function knnBinned(n, pairs, deg = degreesOf(n, pairs), factor = 1.35) {
  const sum = new Float64Array(n);
  for (let e = 0; e < pairs.length; e += 2) { const u = pairs[e], v = pairs[e + 1]; sum[u] += deg[v]; sum[v] += deg[u]; }
  const bins = new Map();
  for (let i = 0; i < n; i++) {
    if (!deg[i]) continue;
    const b = Math.floor(Math.log(deg[i]) / Math.log(factor));
    const x = bins.get(b) || [0, 0, 0];
    x[0] += deg[i]; x[1] += sum[i] / deg[i]; x[2]++;
    bins.set(b, x);
  }
  return [...bins.values()].map(([k, s, c]) => [k / c, s / c]).sort((a, b) => a[0] - b[0]);
}
/**
 * Xalvi-Brunet & Sokolov rewiring: take two links, order their four ends by degree a ≥ b ≥ c ≥ d, and with
 * probability p pair a–b, c–d (assortative) or a–d, b–c (disassortative); otherwise pair them at random.
 * Rewirings that would create a multi-link are rejected, so a simple network stays simple. Degrees never change.
 */
function xbsRewire(n, pairs, mode, p, attempts, rng) {
  const L = pairs.length / 2, deg = degreesOf(n, pairs), key = (u, v) => (u < v ? u * n + v : v * n + u), set = new Set();
  for (let e = 0; e < L; e++) set.add(key(pairs[2 * e], pairs[2 * e + 1]));
  const q = [0, 0, 0, 0];
  for (let it = 0; it < attempts; it++) {
    const e1 = rng.int(L); let e2 = rng.int(L - 1); if (e2 >= e1) e2++;
    q[0] = pairs[2 * e1]; q[1] = pairs[2 * e1 + 1]; q[2] = pairs[2 * e2]; q[3] = pairs[2 * e2 + 1];
    if (q[0] === q[2] || q[0] === q[3] || q[1] === q[2] || q[1] === q[3]) continue;
    q.sort((x, y) => deg[y] - deg[x] || x - y);
    const [a, b, c, d] = q;
    let x1, y1, x2, y2;
    if (rng.random() < p) { if (mode === "assortative") { x1 = a; y1 = b; x2 = c; y2 = d; } else { x1 = a; y1 = d; x2 = b; y2 = c; } }
    else if (rng.random() < 0.5) { x1 = a; y1 = c; x2 = b; y2 = d; } else { x1 = a; y1 = d; x2 = b; y2 = c; }
    const k1 = key(x1, y1), k2 = key(x2, y2), o1 = key(pairs[2 * e1], pairs[2 * e1 + 1]), o2 = key(pairs[2 * e2], pairs[2 * e2 + 1]);
    if ((k1 === o1 || k1 === o2) && (k2 === o1 || k2 === o2)) continue;
    if (set.has(k1) || set.has(k2)) continue;
    set.delete(o1); set.delete(o2); set.add(k1); set.add(k2);
    pairs[2 * e1] = x1; pairs[2 * e1 + 1] = y1; pairs[2 * e2] = x2; pairs[2 * e2 + 1] = y2;
  }
  return pairs;
}
const hexRgb = (c) => { const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(c); return m ? [1, 2, 3].map((i) => parseInt(m[i], 16)) : [128, 128, 128]; };
const mix = (c0, c1, t) => { const a = hexRgb(c0), b = hexRgb(c1); return `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * t)).join(",")})`; };

// ================================================================== the degree correlation matrix
fig_matrix: {
  if (!document.getElementById("fig-matrix")) break fig_matrix; // only on the page that shows it
  const N = 1000, L = 5000;
  const f = figure("#fig-matrix", { title: "The degree correlation matrix e_jk", sub: `A random network with Poisson degrees (N = ${fmt.int(N)}, ⟨k⟩ = 10), rewired with the Xalvi-Brunet–Sokolov algorithm. Every node keeps its degree.`, cols: "cols-2" });
  const left = f.panel("e_jk: degree j (rows, small at the top) against degree k (columns)"), right = f.panel("Degree correlation function");
  const info = h("div", { class: "small muted", style: { minHeight: "1.4em" } }, "Hover over a cell.");
  let cells = null, lo = 0, view = "e";
  const mv = new MatrixView(left, { rows: 1, cols: 1, maxSize: 340, gridLines: false, cell: (i, j) => (cells ? cells(i, j) : null),
    onHover: (i, j) => { info.textContent = i == null || !cur ? "Hover over a cell." : `j = ${lo + i}, k = ${lo + j}: e_jk = ${cur.e[i][j].toFixed(4)}, neutral q_j q_k = ${cur.qq[i][j].toFixed(4)}`; } });
  left.append(info);
  const plot = new Plot(right, { height: 230, x: { type: "log", label: "degree k" }, y: { label: "k_nn(k)" } });
  const t = stats(right, [{ key: "r", label: "degree correlation coefficient r", hl: true }, { key: "mu", label: "fitted μ in k_nn ∝ k^μ" }]);
  let mode = "assortative", p = 1, seed = 2, cur = null;
  function build() {
    const rng = new RNG(seed), pairs = Int32Array.from(gnmPairs(N, L, rng));
    if (mode !== "neutral") xbsRewire(N, pairs, mode, p, 20 * L, rng);
    const deg = degreesOf(N, pairs);
    let kmin = Infinity, kmax = 0; for (const k of deg) { if (k) { kmin = Math.min(kmin, k); kmax = Math.max(kmax, k); } }
    lo = kmin; const R = kmax - kmin + 1;
    const e = Array.from({ length: R }, () => new Float64Array(R));
    for (let i = 0; i < pairs.length; i += 2) { const a = deg[pairs[i]] - lo, b = deg[pairs[i + 1]] - lo; e[a][b] += 1 / (2 * L); e[b][a] += 1 / (2 * L); }
    const q = new Float64Array(R); for (let a = 0; a < R; a++) for (let b = 0; b < R; b++) q[a] += e[a][b];
    const qq = Array.from({ length: R }, (_, a) => Float64Array.from(q, (x) => x * q[a]));
    cur = { e, qq, R };
    paintCells();
    const kn = knnBinned(N, pairs, deg, 1.15);
    let s1 = 0, s2 = 0; for (const k of deg) { s1 += k; s2 += k * k; }
    const fitPts = kn.filter((d) => d[1] > 0);
    const fit = logLogFit(fitPts.map((d) => d[0]), fitPts.map((d) => d[1]));
    plot.update({ series: [{ type: "line", markers: true, data: kn, color: 1, label: "k_nn(k)" }, fnSeries(() => s2 / s1, kn[0][0], kn[kn.length - 1][0], 2, { log: true, color: "theory", dashed: true, label: "neutral ⟨k²⟩/⟨k⟩", tooltip: false })] });
    t.set("r", fmt.fix(rOf(N, pairs, deg), 3), mode === "neutral" ? "random wiring" : `p = ${p.toFixed(2)}`);
    t.set("mu", fmt.fix(fit.slope, 2));
  }
  function paintCells() {
    if (!cur) return;
    const { e, qq, R } = cur;
    const bg = color("surface"), pos = color("s1"), neg = color("s2");
    let vmax = 0;
    for (let a = 0; a < R; a++) for (let b = 0; b < R; b++) vmax = Math.max(vmax, view === "e" ? e[a][b] : Math.abs(e[a][b] - qq[a][b]));
    cells = (i, j) => {
      const v = view === "e" ? e[i][j] : e[i][j] - qq[i][j];
      if (!v) return null;
      const t2 = Math.min(1, Math.sqrt(Math.abs(v) / vmax));
      return mix(bg, v > 0 ? pos : neg, t2);
    };
    mv.set({ rows: R, cols: R });
  }
  onThemeChange(paintCells);
  const run = debounce(build, 150);
  segmented(f.controls, { label: "Rewire towards", value: mode, options: [{ value: "assortative", label: "assortative" }, { value: "neutral", label: "neutral" }, { value: "disassortative", label: "disassortative" }], onChange: (v) => { mode = v; build(); } });
  slider(f.controls, { label: "strength p", min: 0, max: 1, step: 0.05, value: p, format: (v) => v.toFixed(2), onInput: (v) => { p = v; run(); } });
  segmented(f.controls, { label: "Show", value: view, options: [{ value: "e", label: "e_jk" }, { value: "d", label: "e_jk − q_j q_k" }], onChange: (v) => { view = v; paintCells(); } });
  whenVisible(f.el, build);
  f.setCaption("Blue cells hold more links than average (or than chance, in the second view), orange cells fewer. Neutral wiring gives a blob centred on the average degree with no tilt, and e_jk − q_j q_k is noise. Assortative rewiring piles the links onto the diagonal (j ≈ k) and k_nn rises; disassortative rewiring moves them to the anti-diagonal and k_nn falls. The degrees, and so q_k, never change.");
}

// ================================================================== structural cutoff
fig_cutoff: {
  if (!document.getElementById("fig-cutoff")) break fig_cutoff; // only on the page that shows it
  const N = 10000, kmin = 2;
  const f = figure("#fig-cutoff", { title: "Natural and structural cutoffs", sub: `Configuration-model networks with N = ${fmt.int(N)} and k_min = ${kmin}: with multi-links allowed, made simple, and simple with every degree above k_s removed.`, cols: "cols-2" });
  const left = f.panel("Degree distribution and the two cutoffs"), right = f.panel("Degree correlation function k_nn(k)");
  const pk = new Plot(left, { height: 250, x: { type: "log", label: "degree k" }, y: { type: "log", label: "pₖ" } });
  const kp = new Plot(right, { height: 250, x: { type: "log", label: "degree k" }, y: { type: "log", label: "k_nn(k)" } });
  const t = stats(f.body, [{ key: "ks", tex: "k_s = \\sqrt{\\langle k\\rangle N}" }, { key: "kmax", tex: "k_{\\max}", label: "largest degree" }, { key: "rm", tex: "r", label: "multi-links allowed" }, { key: "rs", tex: "r", label: "simple", hl: true }, { key: "rc", tex: "r", label: "simple, k ≤ k_s" }]);
  t.el.style.gridColumn = "1 / -1";
  let gamma = 2.2, seed = 1;
  function draw() {
    const rng = new RNG(seed);
    const seq = powerlawSequence(N, gamma, kmin, rng);
    let s1 = 0, s2 = 0, kmax = 0; for (const k of seq) { s1 += k; s2 += k * k; kmax = Math.max(kmax, k); }
    const ks = Math.sqrt(s1);
    const cm = configurationModel(seq, rng);
    const multi = cm.raw, simple = Int32Array.from(cm.pairs.flat ? cm.pairs.flat() : cm.pairs);
    const seqC = powerlawSequence(N, gamma, kmin, rng, Math.floor(ks));
    const cut = configurationModel(seqC, rng), cutPairs = Int32Array.from(cut.pairs.flat ? cut.pairs.flat() : cut.pairs);
    const h = new Map(); for (const k of seq) h.set(k, (h.get(k) || 0) + 1);
    const bins = new Map(); for (const [k, c] of h) { const b = Math.floor(Math.log(k) / Math.log(1.4)); const x = bins.get(b) || [0, 0, Infinity, 0]; x[0] += c; x[1] += k * c; x[2] = Math.min(x[2], k); x[3] = Math.max(x[3], k); bins.set(b, x); }
    const pts = [...bins.values()].map(([c, kc, a, b]) => [kc / c, c / N / (b - a + 1)]).sort((a, b) => a[0] - b[0]);
    pk.update({ series: [{ type: "scatter", data: pts, color: 1, r: 4, label: "pₖ (log-binned)" }], rules: [{ x: ks, label: "k_s", dashed: true }, { x: kmax, label: "k_max", dashed: true, color: "random" }] });
    const dM = degreesOf(N, multi), dS = degreesOf(N, simple), dC = degreesOf(N, cutPairs);
    kp.update({ series: [
            { type: "line", markers: true, data: knnBinned(N, multi, dM).filter((d) => d[0] >= kmin), color: 1, label: "multi-links allowed" },
      { type: "line", markers: true, data: knnBinned(N, simple, dS).filter((d) => d[0] >= kmin), color: 2, label: "simple" },
      { type: "line", markers: true, data: knnBinned(N, cutPairs, dC).filter((d) => d[0] >= kmin), color: 3, label: "simple, k ≤ k_s" },
      fnSeries(() => s2 / s1, 2, kmax, 2, { log: true, color: "theory", dashed: true, label: "neutral ⟨k²⟩/⟨k⟩", tooltip: false }),
    ], rules: [{ x: ks, label: "k_s", dashed: true }] });
    t.set("ks", fmt.int(ks)); t.set("kmax", fmt.int(kmax), kmax > ks ? "above k_s: conflict" : "below k_s: no conflict");
    t.set("rm", fmt.fix(rOf(N, multi, dM), 3)); t.set("rs", fmt.fix(rOf(N, simple, dS), 3), `${fmt.int(cm.multiLinks + cm.selfLoops)} multi-links and loops erased`); t.set("rc", fmt.fix(rOf(N, cutPairs, dC), 3));
  }
  const run = debounce(draw, 150);
  slider(f.controls, { label: "degree exponent γ", min: 2.1, max: 3.5, step: 0.1, value: gamma, format: (v) => v.toFixed(1), onInput: (v) => { gamma = v; run(); }, wide: true });
  button(f.controls, { label: "Rerun", icon: "dice", onClick: () => { seed++; draw(); } });
  whenVisible(f.el, draw);
  f.setCaption("With multi-links allowed, k_nn(k) is flat: the configuration model is neutral. Erasing the multi-links between hubs makes it fall above about k_s: structural disassortativity, though nobody asked for correlations. Without hubs above k_s it is flat again. Compare shapes, not levels: erasing links and removing hubs lower ⟨k²⟩/⟨k⟩, so those flat curves sit below the dashed line. Raise γ towards 3 and the effect fades: k_max approaches k_s and fewer hubs are in conflict. The largest degree fluctuates a lot between runs; press Rerun.");
}

// ================================================================== giant component and distances under correlations
fig_giant: {
  if (!document.getElementById("fig-giant")) break fig_giant; // only on the page that shows it
  const N = 3000, grid = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
  const f = figure("#fig-giant", { title: "Correlations change the giant component", sub: `Random networks (N = ${fmt.int(N)}) rewired with the Xalvi-Brunet–Sokolov algorithm. Each point averages 3 networks.`, cols: "cols-2" });
  const left = f.panel("Giant component against ⟨k⟩"), right = f.panel("Distances at ⟨k⟩ = 3");
  const gp = new Plot(left, { height: 250, x: { label: "average degree ⟨k⟩", min: 0, max: 3 }, y: { label: "S = N_G / N", min: 0, max: 1 } });
  const dp = new Plot(right, { height: 250, x: { label: "distance d", min: 0 }, y: { label: "share of pairs", min: 0 } });
  const t = stats(right, [{ key: "a", label: "assortative" }, { key: "n", label: "neutral" }, { key: "d", label: "disassortative" }]);
  const status = h("div", { class: "status-line" });
  const MODES = [["assortative", 1, "assortative"], ["neutral", "random", "neutral"], ["disassortative", 2, "disassortative"]];
  let p = 0.5, seed = 1, job = 0;
  function bfsCounts(n, adj, src, counts) {
    const d = new Int32Array(n).fill(-1); d[src] = 0; const Q = [src];
    for (let h2 = 0; h2 < Q.length; h2++) { const v = Q[h2]; for (const w of adj[v]) if (d[w] < 0) { d[w] = d[v] + 1; Q.push(w); counts[d[w]] = (counts[d[w]] || 0) + 1; } }
  }
  function giantNodes(n, adj) {
    const comp = new Int32Array(n).fill(-1); let best = [];
    for (let s = 0; s < n; s++) { if (comp[s] >= 0) continue; const st = [s], nodes = []; comp[s] = s; while (st.length) { const v = st.pop(); nodes.push(v); for (const w of adj[v]) if (comp[w] < 0) { comp[w] = s; st.push(w); } } if (nodes.length > best.length) best = nodes; }
    return best;
  }
  async function runAll() {
    const my = ++job;
    status.textContent = "Rewiring…";
    const curves = MODES.map(() => []);
    for (const k of grid) {
      for (let mi = 0; mi < MODES.length; mi++) {
        let S = 0;
        for (let run = 0; run < 3; run++) {
          const rng = new RNG(seed * 1000 + run * 37 + Math.round(k * 100));
          const pairs = Int32Array.from(gnmPairs(N, Math.round((k * N) / 2), rng));
          if (MODES[mi][0] !== "neutral") xbsRewire(N, pairs, MODES[mi][0], p, 10 * (pairs.length / 2), rng);
          S += giantNodes(N, adjOf(N, pairs)).length / N;
        }
        curves[mi].push([k, S / 3]);
      }
      gp.update({ series: MODES.map(([, c, label], mi) => ({ type: "line", markers: true, data: curves[mi], color: c, label })) });
      await new Promise((r) => setTimeout(r, 0));
      if (my !== job) return;
    }
    // distances at ⟨k⟩ = 3
    const series = [];
    MODES.forEach(([mode, c, label], mi) => {
      const rng = new RNG(seed * 7 + mi);
      const pairs = Int32Array.from(gnmPairs(N, Math.round(1.5 * N), rng));
      if (mode !== "neutral") xbsRewire(N, pairs, mode, p, 10 * (pairs.length / 2), rng);
            const adj = adjOf(N, pairs), nodes = giantNodes(N, adj), counts = [];
      for (let s = 0; s < 60; s++) bfsCounts(N, adj, nodes[rng.int(nodes.length)], counts);
      let tot = 0, sum = 0; counts.forEach((x, d) => { if (x) { tot += x; sum += d * x; } });
      // diameter by repeated double sweeps: BFS to the farthest node, then BFS again from there
      const far = (s) => { const d = new Int32Array(N).fill(-1); d[s] = 0; const Q = [s]; for (let i = 0; i < Q.length; i++) for (const w of adj[Q[i]]) if (d[w] < 0) { d[w] = d[Q[i]] + 1; Q.push(w); } const z = Q[Q.length - 1]; return [z, d[z]]; };
      let dmax = 0;
      for (let s = 0; s < 10; s++) { const [a] = far(nodes[rng.int(nodes.length)]); const [b, d1] = far(a); const [, d2] = far(b); dmax = Math.max(dmax, d1, d2); }
      series.push({ type: "line", markers: true, data: counts.map((x, d) => [d, (x || 0) / tot]).filter((q) => q[0] > 0), color: c, label });
      t.set(["a", "n", "d"][mi], `⟨d⟩ = ${(sum / tot).toFixed(2)}`, `diameter ${dmax}; r = ${rOf(N, pairs).toFixed(2)}`);
    });
    dp.update({ series });
    status.textContent = "";
  }
  slider(f.controls, { label: "strength p", min: 0.1, max: 1, step: 0.1, value: p, format: (v) => v.toFixed(1), onChange: (v) => { p = v; runAll(); } });
  button(f.controls, { label: "Rerun", icon: "dice", onClick: () => { seed++; runAll(); } });
  f.controls.append(status);
  whenVisible(f.el, runAll);
  f.setCaption("Assortative networks form a giant component earlier: around ⟨k⟩ = 1 their hubs have already linked up while the neutral and disassortative ones are still in pieces. Past ⟨k⟩ ≈ 1.5 the order reverses: in a disassortative network every hub pulls in its small nodes, so its giant component is the largest. On the right, assortativity shifts typical distances down a little, yet its diameter is at least as large as the neutral one (often a step or two larger at this size), because small nodes link into long chains; disassortative networks have clearly the smallest diameter. Distance shares come from 60 random start nodes in the giant component; diameters from repeated double sweeps.");
}

// ================================================================== the friendship paradox: p_k against q_k
fig_paradox: {
  if (!document.getElementById("fig-paradox")) break fig_paradox; // only on the page that shows it
  const f = figure("#fig-paradox", { title: "The friendship paradox", sub: "The degree of a random node (pₖ) against the degree of the node at the end of a random link (qₖ = k pₖ/⟨k⟩), computed exactly." });
  const plot = new Plot(f.body, { height: 280, x: { type: "log", label: "degree k" }, y: { type: "log", label: "probability" } });
  const t = stats(f.body, [{ key: "k", tex: "\\langle k\\rangle", label: "a random node" }, { key: "q", tex: "\\langle k^2\\rangle/\\langle k\\rangle", label: "a random neighbour", hl: true }, { key: "x", label: "ratio" }]);
  let type = "powerlaw", gamma = 2.3, mean = 4;
  function draw() {
    const pk = type === "poisson" ? pmf("poisson", { mean }) : pmf("powerlaw", { gamma, kmin: 1, logN: 4 });
    const m = moments(pk), p = [], q = [];
    for (let k = 1; k < pk.length; k++) if (pk[k] > 1e-10) { p.push([k, pk[k]]); q.push([k, (k * pk[k]) / m.m1]); }
    plot.update({ series: [{ type: "line", data: p, color: "random", label: "pₖ: degree of a random node" }, { type: "line", data: q, color: 1, label: "qₖ: degree of a random neighbour" }], y: { min: 1e-8 } });
    t.set("k", fmt.fix(m.m1, 2)); t.set("q", fmt.fix(m.kappa, 2)); t.set("x", fmt.fix(m.kappa / m.m1, 1) + "×", "how much more popular your friends are");
  }
  const ctl = h("div", { class: "fig-controls", style: { padding: 0 } });
  segmented(f.controls, { label: "Network", value: type, options: [{ value: "poisson", label: "random (Poisson)" }, { value: "powerlaw", label: "scale-free (power law)" }], onChange: (v) => { type = v; controls(); draw(); } });
  f.controls.append(ctl);
  function controls() {
    ctl.replaceChildren();
    if (type === "poisson") slider(ctl, { label: "⟨k⟩", min: 1, max: 20, step: 0.5, value: mean, format: (v) => v.toFixed(1), onInput: (v) => { mean = v; draw(); } });
    else slider(ctl, { label: "degree exponent γ", min: 2.05, max: 4, step: 0.05, value: gamma, format: (v) => v.toFixed(2), onInput: (v) => { gamma = v; draw(); } });
  }
  controls(); draw();
  f.setCaption("Following a link picks a node in proportion to its degree, so qₖ leans towards hubs. In a random network the neighbour has exactly one link more than average, 1 + ⟨k⟩. With a power law (N = 10⁴, k_min = 1) and γ below 3 the gap is many-fold: this is why the neutral k_nn equals ⟨k²⟩/⟨k⟩, and why vaccinating a random friend of a random person finds hubs.");
}
