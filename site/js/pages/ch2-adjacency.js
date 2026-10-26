import "../layout.js";
import { h, figure, segmented, select, stats, tex, tooltip } from "../lib/ui.js";
import { NetView, layouts } from "../lib/netview.js";
import { MatrixView } from "../lib/matrixview.js";
import { karateGraph } from "../lib/data.js";
import { RNG } from "../lib/rng.js";
import { bfs, bfsLayers } from "../lib/graph.js";

const tip = tooltip();

// ------------------------------------------------------------------ 1. edit a small network through A
{
  const n = 6;
  const A = Array.from({ length: n }, () => new Array(n).fill(0));
  for (const [i, j] of [[0, 1], [1, 2], [2, 0], [2, 3], [3, 4], [4, 5]]) { A[i][j] = 1; A[j][i] = 1; }
  let directed = false;
  const f = figure("#fig-edit", { title: "A network and its adjacency matrix", sub: "Click a cell of the matrix to add or remove a link.", cols: "cols-2" });
  const pm = f.panel("Adjacency matrix A (row i, column j)"), pg = f.panel("The network");
  const mv = new MatrixView(pm, {
    rows: n, cols: n, maxSize: 300, labels: true,
    cell: (i, j) => (A[i][j] ? "s1" : null),
    onClick: (i, j) => toggle(i, j),
    onHover: (i, j, ev) => {
      if (i == null) { tip.hide(); return; }
      tip.show(ev.clientX, ev.clientY, h("div", {}, h("b", {}, `A${sub(i)}${sub(j)} = ${A[i][j]}`), " · ", i === j ? "diagonal: no self-loops" : directed ? `link ${j} → ${i}` : `link ${i} – ${j}`));
    },
  });
  const sums = h("div", { class: "small", style: { marginTop: "8px", color: "var(--text-2)" } });
  pm.append(sums);
  const pos = layouts.circle(n, 120);
  const nv = new NetView(pg, {
    height: 300, toolbar: false, zoom: false, drag: true,
    nodeRadius: () => 13, nodeColor: () => "s1", edgeColor: () => "text-2", edgeWidth: () => 2,
    label: (i) => String(i), labelInside: () => true,
  });
  const t = stats(pg, [{ key: "L", label: "links L" }, { key: "nz", label: "non-zero entries" }, { key: "sym", label: "symmetric?" }]);
  function edges() {
    const e = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (A[i][j] && (directed ? true : i < j)) e.push(directed ? [j, i] : [i, j]);
    return e;
  }
  function toggle(i, j) {
    if (i === j) return;
    const v = A[i][j] ? 0 : 1;
    A[i][j] = v;
    if (!directed) A[j][i] = v;
    update();
  }
  function update() {
    nv.opts.directed = directed;
    nv.setGraph({ n, edges: edges() }, { positions: pos });
    mv.redraw();
    let nz = 0, sym = true;
    const row = [], col = [];
    for (let i = 0; i < n; i++) { let r = 0, c = 0; for (let j = 0; j < n; j++) { r += A[i][j]; c += A[j][i]; nz += A[i][j]; if (A[i][j] !== A[j][i]) sym = false; } row.push(r); col.push(c); }
    t.set("L", directed ? nz : nz / 2, directed ? "L = Σ Aᵢⱼ" : "L = ½ Σ Aᵢⱼ");
    t.set("nz", nz, directed ? "= L" : "= 2L");
    t.set("sym", sym ? "yes" : "no", directed ? "directed: need not be" : "undirected: always");
    sums.replaceChildren(h("div", {},
      h("div", {}, h("strong", {}, directed ? "Row sums (in-degrees): " : "Row sums (degrees): "), row.join(", ")),
      directed ? h("div", {}, h("strong", {}, "Column sums (out-degrees): "), col.join(", ")) : null));
  }
  segmented(f.controls, {
    label: "Links", value: "undirected", options: [{ value: "undirected", label: "Undirected" }, { value: "directed", label: "Directed" }],
    onChange: (v) => {
      directed = v === "directed";
      if (!directed) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (A[i][j]) A[j][i] = 1;
      update();
    },
  });
  f.setCaption("Directed links follow the book's convention: $A_{ij} = 1$ means a link pointing <em>from</em> $j$ <em>to</em> $i$, so row $i$ lists the links arriving at $i$.");
  requestAnimationFrame(update);
}
function sub(i) { return String(i).split("").map((c) => "₀₁₂₃₄₅₆₇₈₉"[c]).join(""); }

// ------------------------------------------------------------------ 2. karate club matrix + network, linked
const karateReady = karateGraph();
(async () => {
  const { graph: K, club } = await karateReady;
  const N = K.n;
  const f = figure("#fig-karate", { title: "Zachary's karate club: matrix and network", sub: "Hover a cell to see the link; hover a member to see their row.", cols: "cols-2" });
  const pm = f.panel(null), pn = f.panel(null);
  let order = [...Array(N).keys()];
  let mode = "faction";
  let hoverNodes = [];
  const hi = (v) => club[v] === "Mr. Hi";
  const nHi = club.filter((c) => c === "Mr. Hi").length;
  const pos = new Int32Array(N);
  const mv = new MatrixView(pm, {
    rows: N, cols: N, maxSize: 420,
    cell: (i, j) => {
      const u = order[i], v = order[j];
      if (!K.hasEdge(u, v)) return null;
      return hi(u) && hi(v) ? "s1" : !hi(u) && !hi(v) ? "s2" : "text-2";
    },
    onHover: (i, j, ev) => {
      if (i == null) { hoverNodes = []; nv.redraw(); tip.hide(); return; }
      const u = order[i], v = order[j];
      hoverNodes = [u, v];
      nv.redraw();
      tip.show(ev.clientX, ev.clientY, h("div", {}, h("b", {}, `A = ${K.hasEdge(u, v) ? 1 : 0}`), ` · members ${u} and ${v}`, h("br"), h("span", { class: "tt-dim" }, `${hi(u) ? "Mr. Hi" : "President"}'s faction · ${hi(v) ? "Mr. Hi" : "President"}'s faction`)));
    },
  });
  const nv = new NetView(pn, {
    height: 420, charge: -90, linkDistance: 40,
    nodeRadius: (i) => 4 + 1.6 * Math.sqrt(K.degree(i)),
    nodeColor: (i) => (hi(i) ? "s1" : "s2"),
    nodeRing: (i) => (hoverNodes.includes(i) ? "text" : null),
    edgeColor: (u, v) => (hoverNodes.length === 2 && ((u === hoverNodes[0] && v === hoverNodes[1]) || (v === hoverNodes[0] && u === hoverNodes[1])) ? "text" : hi(u) !== hi(v) ? "muted" : "axis"),
    edgeWidth: (u, v) => (hoverNodes.length === 2 && hoverNodes.includes(u) && hoverNodes.includes(v) ? 3 : 1.2),
    label: (i) => (i === 0 || i === 33 ? String(i) : null),
    onHover: (i) => { mv.set({ highlightRows: i == null ? [] : [pos[i]], highlightCols: i == null ? [] : [pos[i]] }); },
    tooltip: (i) => `member ${i} · degree ${K.degree(i)}`,
    legend: [{ label: "Mr. Hi's faction", color: "s1" }, { label: "President's faction", color: "s2" }, { label: "link across factions", color: "muted" }],
  });
  nv.setGraph(K);
  let within = 0, across = 0;
  for (const [u, v] of K.edges()) (hi(u) === hi(v) ? within++ : across++);
  const tl = stats(pm, [{ key: "w", label: "links within a faction" }, { key: "a", label: "links across factions" }, { key: "nz", label: "non-zero entries" }]);
  tl.set("w", within, `${Math.round((100 * within) / K.m)}% of the links`); tl.set("a", across); tl.set("nz", 2 * K.m, `of ${N * N} entries`);
  function setOrder(m) {
    mode = m;
    const ids = [...Array(N).keys()];
    if (m === "id") order = ids;
    else if (m === "faction") order = ids.sort((a, b) => (hi(b) - hi(a)) || a - b);
    else if (m === "degree") order = ids.sort((a, b) => K.degree(b) - K.degree(a) || a - b);
    else if (m === "random") order = new RNG(Date.now() % 100000).shuffle(ids);
    else if (m === "bfs") order = bfsLayers(K, 0).flat();
    order.forEach((v, i) => { pos[v] = i; });
    mv.set({ separators: m === "faction" ? { rows: [nHi], cols: [nHi] } : null });
  }
  select(f.controls, {
    label: "Order rows and columns by", value: "faction",
    options: [{ value: "faction", label: "faction (as in the notebook)" }, { value: "id", label: "member number" }, { value: "degree", label: "degree" }, { value: "bfs", label: "distance from node 0 (BFS)" }, { value: "random", label: "random" }],
    onChange: setOrder,
  });
  setOrder("faction");
  f.setCaption("Blue and orange cells are links within each faction; grey cells are links across. Ordering by distance from node 0 (breadth-first) gathers the links near the diagonal, the idea behind bandwidth-reducing orderings of sparse matrices.");
})();

// ------------------------------------------------------------------ 3. matrix powers
(async () => {
  const { graph: K } = await karateReady;
  const N = K.n;
  const A = Array.from({ length: N }, (_, i) => Array.from({ length: N }, (_, j) => (K.hasEdge(i, j) ? 1 : 0)));
  const mul = (X, Y) => X.map((row) => Y[0].map((_, j) => row.reduce((s, x, k) => s + x * Y[k][j], 0)));
  const P = [null, A];
  for (let n = 2; n <= 5; n++) P[n] = mul(P[n - 1], A);
  let I = 0, J = 33, n = 2, walkHL = null, clickTurn = 0;
  const f = figure("#fig-powers", { title: "Counting walks with Aⁿ", sub: "Pick two members (or click them in the network: first i, then j) and a walk length n.", cols: "split" });
  const pn = f.panel(null), pr = f.panel(null);
  const nodeOpts = [...Array(N).keys()].map((v) => ({ value: String(v), label: String(v) }));
  const si = select(f.controls, { label: "from i", value: "0", options: nodeOpts, onChange: (v) => { I = +v; update(); } });
  const sj = select(f.controls, { label: "to j", value: "33", options: nodeOpts, onChange: (v) => { J = +v; update(); } });
  segmented(f.controls, { label: "walk length n", value: 2, options: [1, 2, 3, 4].map((x) => ({ value: x, label: String(x) })), onChange: (v) => { n = v; update(); } });
  const nv = new NetView(pn, {
    height: 400, charge: -90, linkDistance: 40,
    nodeRadius: (v) => (v === I || v === J ? 11 : 4 + 1.4 * Math.sqrt(K.degree(v))),
    nodeColor: (v) => (v === I ? "s3" : v === J ? "s2" : walkHL && walkHL.nodes.has(v) ? "s1" : "random"),
    edgeColor: (u, v) => (walkHL && walkHL.edges.has(Math.min(u, v) + "," + Math.max(u, v)) ? "s1" : "axis"),
    edgeWidth: (u, v) => (walkHL && walkHL.edges.has(Math.min(u, v) + "," + Math.max(u, v)) ? 3 : 1),
    label: (v) => (v === I ? "i" : v === J ? "j" : null),
    tooltip: (v) => `member ${v} · degree ${K.degree(v)}`,
    onClick: (v) => { if (clickTurn === 0) { I = v; si.value = String(v); } else { J = v; sj.value = String(v); } clickTurn = 1 - clickTurn; update(); },
    legend: [{ label: "i", color: "s3" }, { label: "j", color: "s2" }, { label: "on a listed walk", color: "s1" }],
  });
  nv.setGraph(K);
  const out = h("div");
  pr.append(out);
  const checks = h("div", { style: { marginTop: "12px" } });
  pr.append(checks);

  function walks(i, j, len, limit = 12) {
    const res = [];
    const path = [i];
    (function rec(v, left) {
      if (res.length >= limit) return;
      if (left === 0) { if (v === j) res.push(path.slice()); return; }
      for (const w of K.neighbors(v)) { path.push(w); rec(w, left - 1); path.pop(); if (res.length >= limit) return; }
    })(i, len);
    return res;
  }
  function update() {
    const count = P[n][I][J];
    const d = bfs(K, I).dist[J];
    const list = walks(I, J, n);
    walkHL = { nodes: new Set(list.flat()), edges: new Set() };
    for (const w of list) for (let k = 1; k < w.length; k++) walkHL.edges.add(Math.min(w[k - 1], w[k]) + "," + Math.max(w[k - 1], w[k]));
    nv.redraw();
    const eq = h("div", { class: "eq", style: { margin: "0 0 8px" } });
    tex(eq, `(A^{${n}})_{${I},${J}} = ${count}`, true);
    const notes = [];
    if (I === J && n === 2) notes.push(`On the diagonal, (A²)ᵢᵢ = kᵢ = ${K.degree(I)}: one walk i → k → i per neighbour.`);
    if (I === J && n === 3) notes.push(`(A³)ᵢᵢ = 2 × (triangles through ${I}) = ${count}.`);
    if (I !== J && n === 2) notes.push(`For i ≠ j this is the number of common neighbours of ${I} and ${J}.`);
    if (I !== J) notes.push(d < 0 ? "No path joins them." : d === n ? `n equals the distance d = ${d}: every walk of this length is a shortest path, so ${count} is the number of shortest paths.` : d > n ? `The distance is d = ${d} > n, so no walk this short exists.` : `The distance is d = ${d} < n, so these walks are longer than necessary and many revisit nodes.`);
    const revisit = list.filter((w) => new Set(w).size < w.length).length;
    out.replaceChildren(eq,
      h("p", { class: "small" }, notes.join(" ")),
      h("div", { class: "small", style: { color: "var(--text-2)" } }, h("strong", {}, count ? `${Math.min(list.length, count)} of ${count} walk${count > 1 ? "s" : ""}` : "No walks"),
        list.length ? `${revisit ? ` (${revisit} revisit a node: walks, not paths)` : ""}:` : ""),
      h("ol", { class: "small", style: { margin: "4px 0 0", paddingLeft: "1.3rem", columns: list.length > 6 ? 2 : 1 } }, list.map((w) => h("li", {}, w.join(" → ")))));
  }
  // the notebook's checks
  let sym = true, rows = true, total = 0, tr3 = 0;
  for (let i = 0; i < N; i++) { let r = 0; for (let j = 0; j < N; j++) { r += A[i][j]; total += A[i][j]; if (A[i][j] !== A[j][i]) sym = false; } if (r !== K.degree(i)) rows = false; tr3 += P[3][i][i]; }
  checks.append(h("div", { class: "panel-title" }, "The notebook's checks, recomputed"));
  const tc = stats(checks, [{ key: "sym", label: "A symmetric?" }, { key: "rows", label: "row sums = degrees?" }, { key: "L", label: "L = ½ Σ Aᵢⱼ" }, { key: "cn", label: "(A²)₀,₃₃" }, { key: "tri", label: "Tr(A³)/6" }]);
  tc.set("sym", sym ? "yes" : "no"); tc.set("rows", rows ? "yes" : "no"); tc.set("L", total / 2); tc.set("cn", P[2][0][33], "common neighbours"); tc.set("tri", tr3 / 6, "triangles");
  update();
})();
