import "../layout.js";
import { h, figure, slider, select, segmented, button, stats, dataTable, ICONS } from "../lib/ui.js";
import { NetView } from "../lib/netview.js";
import { Plot } from "../lib/plot.js";
import { RNG } from "../lib/rng.js";
import { CSRGraph } from "../lib/graph.js";
import { symmetricEigen, normalizedLaplacian, deepwalkMatrix } from "../lib/linalg.js";
import { fmt } from "../lib/stats.js";
import { karateGraph, loadNetworks, loadRealGraph, WITH_EDGES } from "../lib/data.js";

const ready = karateGraph();
const CLUB = (c) => (c === "Mr. Hi" ? 1 : 2);

/** Two embedding coordinates per node, plus the accuracy of splitting the club by the sign of the first one. */
function embed(g, method, T) {
  const n = g.n;
  if (method === "spectral") {
    const { values, vectors } = symmetricEigen(normalizedLaplacian(g), n);
    const d = g.degrees();
    // eigenvectors of the normalised Laplacian, rescaled by D^{-1/2} (random-walk Laplacian eigenvectors)
    const coord = (k) => vectors[k].map((x, i) => x / Math.sqrt(d[i]));
    return { x: coord(1), y: coord(2), note: `λ₂ = ${values[1].toFixed(3)} (the algebraic connectivity of the normalised Laplacian)` };
  }
  const { values, vectors } = symmetricEigen(deepwalkMatrix(g, T, 1), n);
  // the two eigenpairs of largest magnitude
  const order = values.map((v, i) => i).sort((a, b) => Math.abs(values[b]) - Math.abs(values[a]));
  const coord = (j) => vectors[order[j]].map((x) => x * Math.sqrt(Math.abs(values[order[j]])));
  return { x: coord(0), y: coord(1), note: `window T = ${T}; top eigenvalues ${values[order[0]].toFixed(2)}, ${values[order[1]].toFixed(2)}` };
}

// ------------------------------------------------------------------ 1. embedding the karate club
(async () => {
  const { graph: K, club } = await ready;
  let method = "spectral", T = 5;
  const f = figure("#fig-embed", { title: "Embedding the karate club in two dimensions", sub: "Each member becomes a point; colour shows the faction it actually joined after the split.", cols: "cols-2" });
  const pa = f.panel("The network"), pb = f.panel("The embedding");
  let E = null, hover = -1;
  const nv = new NetView(pa, {
    height: 320, charge: -90, linkDistance: 36,
    nodeRadius: (v) => (v === hover ? 10 : 7), nodeColor: (v) => (CLUB(club[v]) === 1 ? "s1" : "s2"),
    nodeRing: (v) => (E && Math.sign(E.x[v]) !== Math.sign(E.x[0]) === (CLUB(club[v]) === 1) ? "text" : null),
    tooltip: (v) => `member ${v} (${club[v]})`, onHover: (v) => { hover = v ?? -1; draw(false); },
  });
  nv.setGraph(K);
  const t = stats(f.body, [{ key: "acc", label: "split predicted by the sign of coordinate 1" }, { key: "note", label: "details" }]);
  t.el.style.gridColumn = "1 / -1";
  const plot = new Plot(pb, { height: 320, x: { label: "coordinate 1" }, y: { label: "coordinate 2" } });
  function draw(recompute = true) {
    if (recompute) E = embed(K, method, T);
    const pts = (c) => [...Array(K.n).keys()].filter((v) => CLUB(club[v]) === c).map((v) => [E.x[v], E.y[v], v]);
    // the sign of coordinate 1 is arbitrary: orient it so that node 0 (Mr. Hi) is negative
    let right = 0;
    for (let v = 0; v < K.n; v++) if ((Math.sign(E.x[v]) === Math.sign(E.x[0])) === (CLUB(club[v]) === 1)) right++;
    t.set("acc", `${right} of ${K.n}`, `${fmt.pct(right / K.n, 0)} of members; ringed in the network: misclassified`);
    t.set("note", method === "spectral" ? "spectral" : "DeepWalk", E.note);
    const tip = (p) => [h("div", { class: "tt-title" }, `member ${p[2]}`), h("div", {}, club[p[2]])];
    plot.update({
      series: [
        { type: "scatter", data: pts(1), color: 1, label: "joined Mr. Hi", r: 5, tooltip: tip },
        { type: "scatter", data: pts(2), color: 2, label: "joined the Officer", r: 5, symbol: "square", tooltip: tip },
      ],
      rules: [{ x: 0, dashed: true }], annotations: hover >= 0 ? [{ x: E.x[hover], y: E.y[hover], text: `member ${hover}`, dx: 8, dot: true, color: "text" }] : [],
      x: { zero: false }, xName: "coordinate 1", hover: "point",
    });
    nv.redraw();
  }
  segmented(f.controls, { label: "Method", value: method, options: [{ value: "spectral", label: "spectral (Laplacian eigenvectors)" }, { value: "deepwalk", label: "DeepWalk (random walks, as matrix factorisation)" }], onChange: (v) => { method = v; draw(); } });
  slider(f.controls, { label: "DeepWalk window T", min: 1, max: 10, step: 1, value: T, onInput: (v) => { T = v; if (method === "deepwalk") draw(); } });
  draw();
  f.setCaption("Neither method was told about the factions, only about the links. Nodes that are close in the network end up close in the plane, and a single line through the origin separates the two factions almost perfectly. Hover over a member to find it in both views.");
})();

// ------------------------------------------------------------------ 2. random walks are sentences
(async () => {
  const { graph: K, club } = await ready;
  let rng = new RNG(3), walk = [], timer = null;
  const L = 12;
  const f = figure("#fig-walk", { title: "Random walks turn a network into sentences", sub: "DeepWalk and node2vec start short random walks from every node and feed them to word2vec, as if each walk were a sentence and each node a word.", cols: "split" });
  const pn = f.panel(null), pr = f.panel(null);
  const counts = new Map();
  const nv = new NetView(pn, {
    height: 340, charge: -90, linkDistance: 36,
    nodeRadius: (v) => (v === walk[walk.length - 1] ? 11 : walk.includes(v) ? 8 : 6),
    nodeColor: (v) => (v === walk[walk.length - 1] ? "s4" : walk.includes(v) ? (CLUB(club[v]) === 1 ? "s1" : "s2") : "random"),
    edgeColor: (u, v) => { for (let i = 1; i < walk.length; i++) if ((walk[i - 1] === u && walk[i] === v) || (walk[i - 1] === v && walk[i] === u)) return "s4"; return "axis"; },
    edgeWidth: (u, v) => { for (let i = 1; i < walk.length; i++) if ((walk[i - 1] === u && walk[i] === v) || (walk[i - 1] === v && walk[i] === u)) return 2.6; return 1; },
  });
  nv.setGraph(K);
  const sent = h("div", { class: "small", style: { fontFamily: "var(--mono)", lineHeight: 1.8 } });
  const t = stats(pr, [{ key: "pairs", label: "context pairs counted" }, { key: "same", label: "pairs within one faction" }]);
  pr.append(sent);
  const sentences = [];
  function step() {
    if (!walk.length) walk = [rng.int(K.n)];
    else if (walk.length < L) walk.push(rng.pick(K.neighbors(walk[walk.length - 1])));
    else {
      sentences.unshift(walk.slice());
      if (sentences.length > 6) sentences.pop();
      for (let i = 0; i < walk.length; i++) for (let j = Math.max(0, i - 3); j < i; j++) { const k = walk[i] + "," + walk[j]; counts.set(k, (counts.get(k) || 0) + 1); }
      walk = [rng.int(K.n)];
    }
    let tot = 0, same = 0;
    for (const [k, c] of counts) { const [a, b] = k.split(",").map(Number); tot += c; if (CLUB(club[a]) === CLUB(club[b])) same += c; }
    t.set("pairs", fmt.int(tot), "nodes within 3 steps of each other in a walk"); t.set("same", tot ? fmt.pct(same / tot, 0) : "–", "the walks rarely cross between factions");
    sent.replaceChildren(h("div", {}, h("strong", {}, "current: "), walk.join(" → ")), ...sentences.map((s) => h("div", { class: "muted" }, s.join(" → "))));
    nv.redraw();
  }
  const row = h("div", { class: "btn-row" });
  f.controls.append(row);
  const play = button(row, { label: "Walk", icon: "play", onClick: () => { if (timer) { clearInterval(timer); timer = null; play.innerHTML = ICONS.play + " Walk"; } else { timer = setInterval(step, 160); play.innerHTML = ICONS.pause + " Pause"; } } });
  button(row, { label: "100 walks at once", onClick: () => { for (let i = 0; i < 100 * (L + 1); i++) step(); } });
  step();
  f.setCaption("word2vec learns vectors that make co-occurring words similar. Here nodes that co-occur in walks get similar vectors. Qiu et al. (2018) showed that, with enough walks, this is equivalent to factorising the matrix log(vol(G)/T · Σ_{r ≤ T} (D⁻¹A)^r D⁻¹), which is how the DeepWalk embedding above is computed exactly, without sampling.");
})();

// ------------------------------------------------------------------ 3. message passing (the idea behind graph neural networks)
(async () => {
  const { graph: K, club } = await ready;
  let layers = 0;
  const f = figure("#fig-gnn", { title: "Message passing: what a graph neural network layer does", sub: "Start with a feature known only for two members (+1 for Mr. Hi, node 0; −1 for the Officer, node 33; 0 elsewhere). Each layer replaces every node's value by the average over itself and its neighbours.", cols: "split" });
  const pn = f.panel(null), pr = f.panel(null);
  let x = new Float64Array(K.n);
  const nv = new NetView(pn, {
    height: 340, charge: -90, linkDistance: 36,
    nodeRadius: (v) => (v === 0 || v === 33 ? 11 : 8),
    nodeColor: (v) => (Math.abs(x[v]) < 1e-12 ? "random" : x[v] > 0 ? "s1" : "s2"),
    nodeOpacity: (v) => (Math.abs(x[v]) < 1e-12 ? 0.35 : 0.3 + 0.7 * Math.min(1, Math.abs(x[v]) * 6)),
    nodeRing: (v) => (CLUB(club[v]) === 1 ? null : "text"), tooltip: (v) => `member ${v} (${club[v]}): value ${x[v].toFixed(4)}`,
  });
  nv.setGraph(K);
  const t = stats(pr, [{ key: "acc", label: "faction predicted by the sign" }, { key: "spread", label: "spread of the values" }]);
  const plot = new Plot(pr, { height: 220, legend: false, x: { label: "member", min: -1, max: 34 }, y: { label: "value after the layers" } });
  function run_() {
    x = new Float64Array(K.n); x[0] = 1; x[33] = -1;
    for (let l = 0; l < layers; l++) {
      const y = new Float64Array(K.n);
      for (let v = 0; v < K.n; v++) { let s = x[v]; for (const u of K.neighbors(v)) s += x[u]; y[v] = s / (K.degree(v) + 1); }
      x = y;
    }
    let right = 0, lo = Infinity, hi = -Infinity;
    for (let v = 0; v < K.n; v++) { if ((x[v] > 0) === (CLUB(club[v]) === 1) && x[v] !== 0) right++; lo = Math.min(lo, x[v]); hi = Math.max(hi, x[v]); }
    t.set("acc", `${right} of ${K.n}`, layers ? `after ${layers} layer${layers > 1 ? "s" : ""}` : "only the two seeds are known");
    t.set("spread", fmt.sig(hi - lo, 3), "max − min");
    plot.update({ series: [{ type: "bar", data: [...Array(K.n).keys()].map((v) => [v, x[v], { color: CLUB(club[v]) === 1 ? "s1" : "s2" }]), color: 1, label: "value", maxWidth: 10 }], rules: [{ y: 0 }], xName: "member", yFormat: (v) => fmt.sig(v, 3) });
    nv.redraw();
  }
  slider(f.controls, { label: "number of layers", min: 0, max: 40, step: 1, value: layers, onInput: (v) => { layers = v; run_(); }, wide: true });
  run_();
  f.setCaption("A few layers spread the two labels through the network and the sign of the value predicts most members' faction (ringed: the Officer's side). With many layers every value converges to the same number and the information is lost: over-smoothing, a known limitation of deep graph neural networks.");
})();

// ------------------------------------------------------------------ 4. link prediction on a real network
(async () => {
  const { networks } = await loadNetworks();
  let name = "protein";
  const f = figure("#fig-links", { title: "Link prediction: which missing links are real?", sub: "Hide 10% of the links, score node pairs with four classic heuristics, and check how well each score ranks the hidden links above random non-links (AUC)." });
  const status = h("div", { class: "status-line" });
  const host = h("div");
  f.body.append(host);
  const plot = new Plot(f.body, { height: 280, x: { label: "false positive rate", min: 0, max: 1 }, y: { label: "true positive rate", min: 0, max: 1 } });
  async function go() {
    status.textContent = "Loading…";
    const G = await loadRealGraph(name);
    const rng = new RNG(8);
    const all = G.edges();
    rng.shuffle(all);
    const nTest = Math.floor(all.length / 10);
    const test = all.slice(0, nTest), train = all.slice(nTest);
    const n = G.n;
    const pairs = new Int32Array(2 * train.length);
    train.forEach(([u, v], i) => { pairs[2 * i] = u; pairs[2 * i + 1] = v; });
    const g = CSRGraph.fromPairs(n, pairs);
    const nb = Array.from({ length: n }, (_, v) => new Set(g.neighbors(v)));
    const deg = g.degrees();
    const existing = new Set(all.map(([u, v]) => Math.min(u, v) * n + Math.max(u, v)));
    const neg = [];
    while (neg.length < Math.min(20000, 5 * nTest)) { const u = rng.int(n), v = rng.int(n); if (u !== v && !existing.has(Math.min(u, v) * n + Math.max(u, v))) neg.push([u, v]); }
    const pos = test.slice(0, 20000);
    const scores = {
      "common neighbours": (u, v) => { let c = 0; for (const w of nb[u]) if (nb[v].has(w)) c++; return c; },
      Jaccard: (u, v) => { let c = 0; for (const w of nb[u]) if (nb[v].has(w)) c++; const un = deg[u] + deg[v] - c; return un ? c / un : 0; },
      "Adamic–Adar": (u, v) => { let s = 0; for (const w of nb[u]) if (nb[v].has(w)) s += 1 / Math.log(Math.max(2, deg[w])); return s; },
      "preferential attachment kᵤkᵥ": (u, v) => deg[u] * deg[v],
    };
    const res = [];
    for (const [label, s] of Object.entries(scores)) {
      const sp = pos.map(([u, v]) => s(u, v)), sn = neg.map(([u, v]) => s(u, v));
      // AUC = P(score of a hidden link > score of a non-link), ties count ½
      const all2 = [...sp.map((x) => [x, 1]), ...sn.map((x) => [x, 0])].sort((a, b) => b[0] - a[0]);
      let tp = 0, fp = 0, auc = 0, prevFp = 0, prevTp = 0;
      const roc = [[0, 0]];
      for (let i = 0; i < all2.length;) {
        let j = i, dtp = 0, dfp = 0;
        while (j < all2.length && all2[j][0] === all2[i][0]) { if (all2[j][1]) dtp++; else dfp++; j++; }
        tp += dtp; fp += dfp;
        auc += (fp - prevFp) * (tp + prevTp) / 2;
        roc.push([fp / sn.length, tp / sp.length]);
        prevFp = fp; prevTp = tp; i = j;
      }
      res.push({ label, auc: auc / (sp.length * sn.length), roc });
    }
    status.textContent = `${fmt.int(pos.length)} hidden links against ${fmt.int(neg.length)} random non-linked pairs.`;
    host.replaceChildren(dataTable([{ label: "Score", align: "left" }, { label: "AUC (0.5 = guessing, 1 = perfect)" }], res.map((r) => [r.label, r.auc.toFixed(3)]), { highlight: (r) => r[1] === Math.max(...res.map((x) => x.auc)).toFixed(3) }));
    plot.update({ series: [...res.map((r, i) => ({ type: "line", data: r.roc, color: i + 1, label: `${r.label} (AUC ${r.auc.toFixed(2)})` })), { type: "line", data: [[0, 0], [1, 1]], color: "theory", dashed: true, label: "guessing", tooltip: false }], xName: "false positive rate", yFormat: (v) => fmt.fix(v, 3) });
  }
  select(f.controls, { label: "Network", value: name, options: WITH_EDGES.map((n) => ({ value: n, label: networks[n].description })), onChange: (v) => { name = v; go(); } });
  f.controls.append(status);
  go();
  f.setCaption("Scores built on shared neighbours work well in clustered networks such as collaboration, where triangles close. They fail in networks with few triangles (power grid, protein), where they give most pairs a score of zero. There the preferential-attachment score, which only uses degrees, can do better. Embeddings and graph neural networks learn such scores from the data instead of fixing them by hand.");
})();
