import "../layout.js";
import { t as tl } from "../i18n.js";
import { h, figure, slider, select, segmented, button, stats, dataTable, ICONS, color, onThemeChange, whenVisible } from "../lib/ui.js";
import { NetView } from "../lib/netview.js";
import { Plot } from "../lib/plot.js";
import { RNG } from "../lib/rng.js";
import { CSRGraph, Graph, betweenness, closeness, eigenvector, pagerank, coreNumbers, localClustering } from "../lib/graph.js";
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
  if (!document.getElementById("fig-embed")) return; // only on the page that shows it
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
  if (!document.getElementById("fig-walk")) return; // only on the page that shows it
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
  if (!document.getElementById("fig-gnn")) return; // only on the page that shows it
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
  if (!document.getElementById("fig-links")) return; // only on the page that shows it
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
  f.setCaption("Scores built on shared neighbours work well in clustered networks such as collaboration, where triangles close. They fail in networks with few triangles (power grid, protein), where most pairs score zero. In the protein network the degree-only preferential-attachment score does better; in the power grid no score does well. Embeddings and graph neural networks learn such scores from the data instead of fixing them by hand.");
})();

const hexRgb = (c) => { const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(c); return m ? [1, 2, 3].map((i) => parseInt(m[i], 16)) : [128, 128, 128]; };
const mix = (c0, c1, t) => { const a = hexRgb(c0), b = hexRgb(c1); return `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * t)).join(",")})`; };
/** Spearman rank correlation. */
function spearman(a, b) {
  const rank = (x) => { const o = x.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]), r = new Array(x.length); for (let i = 0; i < o.length;) { let j = i; while (j + 1 < o.length && o[j + 1][0] === o[i][0]) j++; for (let k = i; k <= j; k++) r[o[k][1]] = (i + j) / 2; i = j + 1; } return r; };
  const ra = rank(a), rb = rank(b), n = a.length, ma = ra.reduce((s, x) => s + x, 0) / n, mb = rb.reduce((s, x) => s + x, 0) / n;
  let num = 0, da = 0, db = 0; for (let i = 0; i < n; i++) { num += (ra[i] - ma) * (rb[i] - mb); da += (ra[i] - ma) ** 2; db += (rb[i] - mb) ** 2; }
  return num / Math.sqrt(da * db);
}

// ------------------------------------------------------------------ centralities of the karate club
(async () => {
  if (!document.getElementById("fig-central")) return; // only on the page that shows it
  const { graph: K, club } = await ready;
  const deg = K.degrees ? Array.from(K.degrees()) : Array.from({ length: K.n }, (_, i) => K.degree(i));
  const MEASURES = {
    degree: { label: "degree", values: () => deg.slice(), note: "Counts neighbours, all equal. The two leaders, 33 (17 links) and 0 (16), stand out." },
    eigenvector: { label: "eigenvector centrality", values: () => Array.from(eigenvector(K)), note: "Rewards important neighbours: members of the dense core around the leaders score high, peripheral members low even with a few links." },
    pagerank: { label: "PageRank (d = 0.85)", values: () => Array.from(pagerank(K, 0.85)), note: "A random surfer who jumps with probability 0.15. On an undirected network it stays close to degree; it differs on directed ones, where links are votes." },
    betweenness: { label: "betweenness", values: () => Array.from(betweenness(K)), note: "Brokers: node 0 and node 33 carry most shortest paths. Node 31, with only 6 links, carries almost as many as node 32 with 12, because it sits between the factions." },
    closeness: { label: "closeness", values: () => Array.from(closeness(K)), note: "Near everyone: in a small network of diameter 5 the values are compressed. Node 0 is closest to all, followed by node 2 and node 31, which link the two groups, ahead of node 33." },
    core: { label: "k-core number", values: () => Array.from(coreNumbers(K)), note: "Ten members form the 4-core, the club's dense centre; 12 are in the 3-core, 11 in the 2-core and one only in the 1-core. Many ties: a coarse but robust measure." },
    clustering: { label: "local clustering", values: () => Array.from(localClustering(K)), note: "High for members whose friends all know each other (often small degree); the leaders have low clustering because their many friends come from both groups." },
  };
  let key = "degree", vals = MEASURES.degree.values();
  const f = figure("#fig-central", { title: "Seven ways to be important", sub: "Zachary's karate club (34 members, 78 friendships). Colour and size show the chosen measure; the table lists the top members.", cols: "split" });
  const pn = f.panel(null), pr = f.panel(null);
  const nv = new NetView(pn, {
    height: 360, charge: -90, linkDistance: 34,
    nodeRadius: (v) => { const mx = Math.max(...vals), mn = Math.min(...vals); return 4 + 9 * (mx > mn ? (vals[v] - mn) / (mx - mn) : 0.5); },
    nodeColor: (v) => { const mx = Math.max(...vals), mn = Math.min(...vals); return mix(color("surface-3"), color("s2"), mx > mn ? 0.15 + 0.85 * (vals[v] - mn) / (mx - mn) : 0.5); },
    nodeRing: (v) => (CLUB(club[v]) === 1 ? "s1" : null),
    label: (v) => (v === 0 || v === 33 ? String(v) : null),
    tooltip: (v) => `node ${v}: ${fmt.sig(vals[v], 3)} (degree ${deg[v]})`,
    legend: [{ label: "ring: joined Mr. Hi", color: "s1" }],
  });
  nv.setGraph(K);
  onThemeChange(() => nv.redraw());
  const t = stats(pr, [{ key: "rho", label: "rank correlation with degree (Spearman)" }]);
  const note = h("p", { class: "small" });
  const tbl = h("div");
  pr.append(note, tbl);
  function draw() {
    vals = MEASURES[key].values();
    const order = vals.map((v, i) => i).sort((a, b) => vals[b] - vals[a]).slice(0, 8);
    const cols = [{ label: "rank", align: "left" }, { label: "node", align: "left" }, { label: MEASURES[key].label, format: (v) => fmt.sig(v, 3) }];
    if (key !== "degree") cols.push({ label: "degree", format: fmt.int });
    tbl.replaceChildren(dataTable(cols, order.map((v, r) => [String(r + 1), String(v), vals[v], ...(key !== "degree" ? [deg[v]] : [])])));
    t.set("rho", key === "degree" ? "1" : spearman(vals, deg).toFixed(2), key === "degree" ? "" : "1 = same ranking as degree");
    note.textContent = MEASURES[key].note;
    nv.redraw();
  }
  select(f.controls, { label: "Measure", value: key, options: Object.entries(MEASURES).map(([k, m]) => ({ value: k, label: m.label })), onChange: (v) => { key = v; draw(); } });
  draw();
  f.setCaption("Measures that look only at a node's own links (degree, clustering) and measures that look at the whole network (eigenvector, betweenness, closeness) agree on the leaders but disagree on everyone else. Each can be a feature for a classifier; together they describe a node's position far better than degree alone.");
})();

// ------------------------------------------------------------------ PageRank step by step
fig_pagerank: {
  if (!document.getElementById("fig-pagerank")) break fig_pagerank; // only on the page that shows it
  const NAMES = ["A", "B", "C", "D", "E"];
  const GRAPHS = {
    worked: { label: "the worked example", n: 4, edges: [[0, 1], [0, 2], [1, 2], [2, 0], [3, 2]], pos: [[0, 0], [1, -0.9], [1.6, 0.4], [2.4, 1.3]] },
    trap: { label: "a spider trap (B ⇄ C)", n: 4, edges: [[0, 1], [1, 2], [2, 1], [3, 0], [0, 3]], pos: [[0, 0], [1.2, -0.6], [2.2, 0.2], [-0.8, 0.9]] },
    star: { label: "everyone links to A", n: 5, edges: [[1, 0], [2, 0], [3, 0], [4, 0], [0, 1]], pos: [[0, 0], [1.2, 0], [0, 1.2], [-1.2, 0], [0, -1.2]] },
  };
  let gkey = "worked", d = 1, rows = [];
  const f = figure("#fig-pagerank", { title: "PageRank, one iteration at a time", sub: "Each node splits its score equally over its out-links; with damping d < 1 every node also gets (1 − d)/N. Press Step and follow the table.", cols: "split" });
  const pn = f.panel(null), pr = f.panel(null);
  let r = [];
  const nv = new NetView(pn, { height: 300, directed: true, drag: false, nodeRadius: (v) => 7 + 16 * Math.sqrt(r[v] || 0), nodeColor: () => "s1", label: (v) => NAMES[v], labelSize: 12 });
  const tbl = h("div", { class: "small" });
  const t = stats(pr, [{ key: "sum", label: "total score" }, { key: "it", label: "iteration" }]);
  pr.append(tbl);
  function reset() {
    const G = GRAPHS[gkey];
    r = new Array(G.n).fill(1 / G.n); rows = [r.slice()];
    nv.setGraph({ n: G.n, edges: G.edges }, { positions: G.pos.map(([x, y]) => [x * 90, y * 90]) });
    paint();
  }
  function step() {
    const G = GRAPHS[gkey], out = new Array(G.n).fill(0);
    for (const [u] of G.edges) out[u]++;
    const nr = new Array(G.n).fill((1 - d) / G.n);
    for (const [u, v] of G.edges) nr[v] += (d * r[u]) / out[u];
    r = nr; rows.push(r.slice()); paint();
  }
  function paint() {
    const G = GRAPHS[gkey], show = rows.length > 9 ? [rows[0], ...rows.slice(-8)] : rows;
    const first = rows.length > 9 ? rows.length - 8 : 1;
    tbl.replaceChildren(dataTable([{ label: "iteration", align: "left" }, ...NAMES.slice(0, G.n).map((nm) => ({ label: nm, format: (v) => v.toFixed(3) }))],
      show.map((row, i) => [i === 0 ? "start" : String(first + i - 1), ...row])));
    t.set("sum", r.reduce((a, b) => a + b, 0).toFixed(3), "stays 1: score only moves"); t.set("it", String(rows.length - 1));
    nv.redraw();
  }
  select(f.controls, { label: "Network", value: gkey, options: Object.entries(GRAPHS).map(([k, g]) => ({ value: k, label: g.label })), onChange: (v) => { gkey = v; reset(); } });
  slider(f.controls, { label: "damping d", min: 0.5, max: 1, step: 0.05, value: d, format: (v) => (v === 1 ? "1 (simplified)" : v.toFixed(2)), onInput: (v) => { d = v; reset(); } });
  const row = h("div", { class: "btn-row" });
  f.controls.append(row);
  button(row, { label: "Step", icon: "step", onClick: step });
  button(row, { label: "20 steps", onClick: () => { for (let i = 0; i < 20; i++) step(); } });
  button(row, { label: "Reset", icon: "reset", onClick: reset });
  reset();
  f.setCaption("With d = 1 a node without in-links drops to 0 after one step, and in the spider trap B and C end up with all the score, because nothing ever leaves them. Lower d and every node keeps a floor of (1 − d)/N while the trap loses its grip. In the third network, with d = 1, the whole score bounces between A and B and never settles; with d = 0.85 it converges to A = 0.48, B = 0.43 and 0.03 for each of the others.");
}

// ------------------------------------------------------------------ Weisfeiler–Lehman colour refinement
fig_wl: {
  if (!document.getElementById("fig-wl")) break fig_wl; // only on the page that shows it
  const PAIRS = {
    path: { label: "path of 5 vs triangle + link", a: { n: 5, edges: [[0, 1], [1, 2], [2, 3], [3, 4]] }, b: { n: 5, edges: [[0, 1], [1, 2], [2, 0], [3, 4]] } },
    cycle: { label: "6-cycle vs two triangles", a: { n: 6, edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0]] }, b: { n: 6, edges: [[0, 1], [1, 2], [2, 0], [3, 4], [4, 5], [5, 3]] } },
    star: { label: "star vs path (4 nodes)", a: { n: 4, edges: [[0, 1], [0, 2], [0, 3]] }, b: { n: 4, edges: [[0, 1], [1, 2], [2, 3]] } },
    deco: { label: "two graphs with the same degrees", a: { n: 6, edges: [[0, 1], [1, 2], [2, 0], [2, 3], [3, 4], [4, 5]] }, b: { n: 6, edges: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 5]] } },
  };
  let key = "path", round = 0, cols = null;
  const f = figure("#fig-wl", { title: "Weisfeiler–Lehman colour refinement", sub: "Every node starts with the same colour. Each round recolours a node by its colour and the multiset of its neighbours' colours; equal signatures get equal colours in both graphs.", cols: "cols-2" });
  const pa = f.panel("Graph 1"), pb = f.panel("Graph 2");
  const PALETTE = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"];
  const adj = (g) => { const a = Array.from({ length: g.n }, () => []); for (const [u, v] of g.edges) { a[u].push(v); a[v].push(u); } return a; };
  const views = [pa, pb].map((p, gi) => new NetView(p, { height: 220, charge: -160, linkDistance: 46, drag: true, nodeRadius: () => 11, nodeColor: (v) => PALETTE[(cols ? cols[gi][v] : 0) % PALETTE.length], label: (v) => (cols ? String(cols[gi][v] + 1) : "1"), labelSize: 11 }));
  const verdict = h("p", { class: "small", style: { gridColumn: "1 / -1", margin: "0.3rem 0 0" } });
  f.body.append(verdict);
  function reset() {
    const P = PAIRS[key];
    cols = [new Array(P.a.n).fill(0), new Array(P.b.n).fill(0)]; round = 0;
    views[0].setGraph(P.a, { keep: false }); views[1].setGraph(P.b, { keep: false });
    paint();
  }
  function step() {
    const P = PAIRS[key], A = [adj(P.a), adj(P.b)], sigs = [[], []], map = new Map();
    for (let gi = 0; gi < 2; gi++) for (let v = 0; v < cols[gi].length; v++) sigs[gi][v] = cols[gi][v] + "|" + A[gi][v].map((u) => cols[gi][u]).sort((x, y) => x - y).join(",");
    [...new Set([...sigs[0], ...sigs[1]])].sort().forEach((s, i) => map.set(s, i));
    cols = sigs.map((sg) => sg.map((s) => map.get(s)));
    round++; paint();
  }
  function paint() {
        const hist = (c) => { const m = new Map(); for (const x of c) m.set(x, (m.get(x) || 0) + 1); return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([c2, n]) => `${n}× ${tl("colour")} ${c2 + 1}`).join(", "); };
    const h1 = hist(cols[0]), h2 = hist(cols[1]), same = h1 === h2;
    const msg = same ? (round === 0 ? tl("Press Step to refine.") : tl("Same colour counts: WL cannot tell them apart (yet).")) : tl("Different colour counts: the graphs are not isomorphic.");
    verdict.replaceChildren(h("strong", { "data-no-tr": "" }, `${tl("Round")} ${round}. `), h("span", { "data-no-tr": "" }, `${tl("Graph 1")}: ${h1}. ${tl("Graph 2")}: ${h2}. `), same ? h("span", { "data-no-tr": "" }, msg) : h("strong", { "data-no-tr": "" }, msg));
    views.forEach((v) => v.redraw());
  }
  select(f.controls, { label: "Pair", value: key, options: Object.entries(PAIRS).map(([k, p]) => ({ value: k, label: p.label })), onChange: (v) => { key = v; reset(); } });
  const row = h("div", { class: "btn-row" });
  f.controls.append(row);
  button(row, { label: "Step", icon: "step", onClick: step });
  button(row, { label: "Reset", icon: "reset", onClick: reset });
  whenVisible(f.el, reset);
  f.setCaption("Round 1 colours nodes by degree, so it already separates the star from the path. The path and the triangle-plus-link need round 2. The 6-cycle and the two triangles never separate, however many rounds you run: a limit shared by every message-passing graph neural network. The last pair, a triangle with a tail of three against a square with a tail of two, has the same degrees but separates in round 2: only the square has a degree-2 node whose neighbours both have degree 2.");
}
