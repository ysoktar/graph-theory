// Graphs, generators and algorithms: a small, dependency-free NetworkX for the browser.
// Every function is a direct translation of a definition from the book (section numbers in comments).
//
// Two representations:
//   Graph     mutable, adjacency lists + an edge set (editing, animations, swaps)
//   CSRGraph  immutable compressed sparse rows (fast traversal of the real networks)
// Algorithms accept either: they call g.csr() to get {n, off, nbr}.

import { samplePowerLaw } from "./stats.js";

const KEY = 2097152; // 2^21: edge keys u*KEY+v stay exact doubles for up to 2 million nodes
export const edgeKey = (u, v) => (u < v ? u * KEY + v : v * KEY + u);

export class Graph {
  constructor(n = 0) {
    this.adj = [];
    for (let i = 0; i < n; i++) this.adj.push([]);
    this.keys = new Set();
    this.m = 0;
    this.version = 0;
    this._csr = null;
  }

  get n() { return this.adj.length; }

  _touch() { this.version++; this._csr = null; }

  addNode() { this.adj.push([]); this._touch(); return this.adj.length - 1; }

  addNodes(k) { for (let i = 0; i < k; i++) this.adj.push([]); this._touch(); }

  hasEdge(u, v) { return this.keys.has(edgeKey(u, v)); }

  /** Adds an undirected link; ignores self-loops and repeated links (the graph stays simple). */
  addEdge(u, v) {
    if (u === v || u < 0 || v < 0 || u >= this.adj.length || v >= this.adj.length) return false;
    const key = edgeKey(u, v);
    if (this.keys.has(key)) return false;
    this.keys.add(key);
    this.adj[u].push(v);
    this.adj[v].push(u);
    this.m++;
    this._touch();
    return true;
  }

  removeEdge(u, v) {
    const key = edgeKey(u, v);
    if (!this.keys.has(key)) return false;
    this.keys.delete(key);
    removeFrom(this.adj[u], v);
    removeFrom(this.adj[v], u);
    this.m--;
    this._touch();
    return true;
  }

  /** Removes all links of v (the node itself keeps its index). */
  isolate(v) {
    for (const u of [...this.adj[v]]) this.removeEdge(u, v);
  }

  /** Deletes node v and renumbers the nodes above it (v+1 → v, …). */
  removeNode(v) {
    const edges = this.edges().filter(([a, b]) => a !== v && b !== v).map(([a, b]) => [a > v ? a - 1 : a, b > v ? b - 1 : b]);
    const n = this.n - 1;
    this.adj = [];
    for (let i = 0; i < n; i++) this.adj.push([]);
    this.keys = new Set();
    this.m = 0;
    for (const [a, b] of edges) this.addEdge(a, b);
    this._touch();
  }

  degree(v) { return this.adj[v].length; }

  degrees() {
    const d = new Int32Array(this.n);
    for (let i = 0; i < this.n; i++) d[i] = this.adj[i].length;
    return d;
  }

  neighbors(v) { return this.adj[v]; }

  /** All links as [u, v] with u < v. */
  edges() {
    const out = [];
    for (let u = 0; u < this.n; u++) for (const v of this.adj[u]) if (u < v) out.push([u, v]);
    return out;
  }

  clone() {
    const g = new Graph(this.n);
    for (let u = 0; u < this.n; u++) g.adj[u] = this.adj[u].slice();
    g.keys = new Set(this.keys);
    g.m = this.m;
    return g;
  }

  csr() {
    if (this._csr) return this._csr;
    const n = this.n, off = new Int32Array(n + 1);
    for (let i = 0; i < n; i++) off[i + 1] = off[i] + this.adj[i].length;
    const nbr = new Int32Array(off[n]);
    for (let i = 0; i < n; i++) nbr.set(this.adj[i], off[i]);
    this._csr = { n, m: this.m, off, nbr };
    return this._csr;
  }

  static fromEdges(n, edges) {
    const g = new Graph(n);
    for (const [u, v] of edges) g.addEdge(u, v);
    return g;
  }
}

function removeFrom(arr, x) {
  const i = arr.indexOf(x);
  if (i >= 0) { arr[i] = arr[arr.length - 1]; arr.pop(); }
}

/** Read-only compressed sparse row graph, for networks with up to ~10^6 links. */
export class CSRGraph {
  constructor(n, off, nbr) {
    this.n = n; this.off = off; this.nbr = nbr; this.m = nbr.length / 2;
  }
  csr() { return this; }
  degree(v) { return this.off[v + 1] - this.off[v]; }
  neighbors(v) { return this.nbr.subarray(this.off[v], this.off[v + 1]); }
  degrees() {
    const d = new Int32Array(this.n);
    for (let i = 0; i < this.n; i++) d[i] = this.off[i + 1] - this.off[i];
    return d;
  }
  edges() {
    const out = [];
    for (let u = 0; u < this.n; u++) for (let j = this.off[u]; j < this.off[u + 1]; j++) if (u < this.nbr[j]) out.push([u, this.nbr[j]]);
    return out;
  }
  toGraph() { return Graph.fromEdges(this.n, this.edges()); }

  /** From a flat array of pairs [u0, v0, u1, v1, …] that is already simple (no loops, no repeats). */
  static fromPairs(n, pairs) {
    const off = new Int32Array(n + 1);
    for (let i = 0; i < pairs.length; i++) off[pairs[i] + 1]++;
    for (let i = 0; i < n; i++) off[i + 1] += off[i];
    const fill = off.slice(0, n), nbr = new Int32Array(pairs.length);
    for (let i = 0; i < pairs.length; i += 2) {
      const u = pairs[i], v = pairs[i + 1];
      nbr[fill[u]++] = v;
      nbr[fill[v]++] = u;
    }
    return new CSRGraph(n, off, nbr);
  }
}

/** Removes self-loops and repeated links from a flat pair list; returns {pairs, selfLoops, multiLinks}. */
export function simplifyPairs(pairs) {
  const seen = new Set(), out = [];
  let selfLoops = 0, multiLinks = 0;
  for (let i = 0; i < pairs.length; i += 2) {
    const u = pairs[i], v = pairs[i + 1];
    if (u === v) { selfLoops++; continue; }
    const k = edgeKey(u, v);
    if (seen.has(k)) { multiLinks++; continue; }
    seen.add(k);
    out.push(u, v);
  }
  return { pairs: Int32Array.from(out), selfLoops, multiLinks };
}

// ===================================================================== generators

/** Erdős–Rényi G(N, p) (Section 3.2), by geometric skipping (Batagelj & Brandes 2005): O(N + L). */
export function gnpPairs(n, p, rng) {
  const out = [];
  if (p <= 0 || n < 2) return Int32Array.from(out);
  if (p >= 1) { for (let v = 1; v < n; v++) for (let w = 0; w < v; w++) out.push(v, w); return Int32Array.from(out); }
  const lp = Math.log(1 - p);
  let v = 1, w = -1;
  while (v < n) {
    w += 1 + Math.floor(Math.log(1 - rng.random()) / lp);
    while (w >= v && v < n) { w -= v; v++; }
    if (v < n) out.push(v, w);
  }
  return Int32Array.from(out);
}
export const gnp = (n, p, rng) => pairsToGraph(n, gnpPairs(n, p, rng));
export const gnpCSR = (n, p, rng) => CSRGraph.fromPairs(n, gnpPairs(n, p, rng));

/** G(N, L): exactly L links placed uniformly at random among the N(N−1)/2 pairs. */
export function gnmPairs(n, m, rng) {
  const max = (n * (n - 1)) / 2;
  m = Math.min(m, max);
  const seen = new Set(), out = [];
  if (m > max / 2) {
    // dense: choose which pairs to leave out
    const drop = new Set();
    while (drop.size < max - m) {
      const u = rng.int(n), v = rng.int(n);
      if (u !== v) drop.add(pairIndex(u, v, n));
    }
    for (let u = 0; u < n; u++) for (let v = u + 1; v < n; v++) if (!drop.has(u * n + v)) out.push(u, v);
    return Int32Array.from(out);
  }
  while (out.length < 2 * m) {
    const u = rng.int(n), v = rng.int(n);
    if (u === v) continue;
    const k = edgeKey(u, v);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(u, v);
  }
  return Int32Array.from(out);
}
function pairIndex(u, v, n) {
  return u < v ? u * n + v : v * n + u;
}
export const gnm = (n, m, rng) => pairsToGraph(n, gnmPairs(n, m, rng));

export function pairsToGraph(n, pairs) {
  const g = new Graph(n);
  for (let i = 0; i < pairs.length; i += 2) g.addEdge(pairs[i], pairs[i + 1]);
  return g;
}

/**
 * Power-law degree sequence p_k ∝ k^−γ, k ≥ kmin (the notebook's powerlaw_degree_sequence), capped at
 * N − 1, total made even. Sampled exactly (see stats.samplePowerLaw for why the notebook's rounding
 * shortcut is biased at small kmin).
 */
export function powerlawSequence(n, gamma, kmin, rng, kmax = n - 1, method = "exact") {
  const k = samplePowerLaw(n, gamma, kmin, rng, { kmax, method });
  let sum = 0;
  for (const x of k) sum += x;
  if (sum % 2) k[rng.int(n)] += 1;
  return k;
}

/** Poisson degree sequence with mean ⟨k⟩ (even total). */
export function poissonSequence(n, avgk, rng) {
  const k = new Int32Array(n);
  let sum = 0;
  for (let i = 0; i < n; i++) { k[i] = rng.poisson(avgk); sum += k[i]; }
  if (sum % 2) k[rng.int(n)] += 1;
  return k;
}

/**
 * Configuration model (Section 4.8): node i gets k_i stubs; the stubs are shuffled and paired.
 * Returns the raw stub pairing and the simple graph (self-loops dropped, multi-links collapsed).
 */
export function configurationModel(degrees, rng) {
  let total = 0;
  for (const d of degrees) total += d;
  const stubs = new Int32Array(total);
  let p = 0;
  for (let i = 0; i < degrees.length; i++) for (let j = 0; j < degrees[i]; j++) stubs[p++] = i;
  rng.shuffle(stubs);
  const raw = stubs.subarray(0, total - (total % 2));
  const { pairs, selfLoops, multiLinks } = simplifyPairs(raw);
  return { raw, pairs, selfLoops, multiLinks, n: degrees.length };
}
export const configurationGraph = (degrees, rng) => pairsToGraph(degrees.length, configurationModel(degrees, rng).pairs);
export const configurationCSR = (degrees, rng) => CSRGraph.fromPairs(degrees.length, configurationModel(degrees, rng).pairs);

/**
 * Barabási–Albert growth (Ch 5): start from a clique of m+1 nodes; each new node brings m links.
 * attachment: "preferential" (Π ∝ k) or "uniform" (Model A of Section 5.6, growth only).
 * onNode(graph, node, targets) is called after each new node, for animations.
 */
export function barabasiAlbert(n, m, rng, { attachment = "preferential", onNode = null, m0 = m + 1 } = {}) {
  const g = new Graph(Math.min(n, m0));
  const repeated = [];
  for (let u = 0; u < g.n; u++) for (let v = u + 1; v < g.n; v++) { g.addEdge(u, v); repeated.push(u, v); }
  for (let v = g.n; v < n; v++) {
    g.addNode();
    const targets = new Set();
    const pool = v;
    while (targets.size < Math.min(m, pool)) {
      const t = attachment === "preferential" && repeated.length ? repeated[rng.int(repeated.length)] : rng.int(pool);
      targets.add(t);
    }
    for (const t of targets) { g.addEdge(v, t); repeated.push(v, t); }
    if (onNode) onNode(g, v, [...targets]);
  }
  return g;
}

/** Watts–Strogatz small-world model: ring lattice (k neighbours) with each link rewired with probability p. */
export function wattsStrogatz(n, k, p, rng) {
  const g = new Graph(n);
  const half = Math.floor(k / 2);
  for (let j = 1; j <= half; j++) for (let u = 0; u < n; u++) g.addEdge(u, (u + j) % n);
  if (p <= 0) return g;
  for (let j = 1; j <= half; j++) {
    for (let u = 0; u < n; u++) {
      const v = (u + j) % n;
      if (rng.random() < p && g.hasEdge(u, v) && g.degree(u) < n - 1) {
        let w;
        do { w = rng.int(n); } while (w === u || g.hasEdge(u, w));
        g.removeEdge(u, v);
        g.addEdge(u, w);
      }
    }
  }
  return g;
}

/** Random geometric graph: N points in the unit square, linked when closer than r. Returns {graph, pos}. */
export function randomGeometric(n, r, rng) {
  const pos = [];
  for (let i = 0; i < n; i++) pos.push([rng.random(), rng.random()]);
  const g = new Graph(n);
  const cells = Math.max(1, Math.floor(1 / r));
  const grid = new Map();
  pos.forEach(([x, y], i) => {
    const key = Math.min(cells - 1, Math.floor(x * cells)) * cells + Math.min(cells - 1, Math.floor(y * cells));
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(i);
  });
  const r2 = r * r;
  pos.forEach(([x, y], i) => {
    const cx = Math.min(cells - 1, Math.floor(x * cells)), cy = Math.min(cells - 1, Math.floor(y * cells));
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const list = grid.get((cx + dx) * cells + (cy + dy));
      if (!list || cx + dx < 0 || cy + dy < 0 || cx + dx >= cells || cy + dy >= cells) continue;
      for (const j of list) if (j > i && (pos[j][0] - x) ** 2 + (pos[j][1] - y) ** 2 <= r2) g.addEdge(i, j);
    }
  });
  return { graph: g, pos };
}

/** Holme–Kim model (NetworkX's powerlaw_cluster_graph): preferential attachment plus triad formation. */
export function holmeKim(n, m, pTriad, rng) {
  const g = new Graph(n);
  const repeated = [];
  for (let i = 0; i < m; i++) repeated.push(i);
  for (let source = m; source < n; source++) {
    const targets = randomSubset(repeated, m, rng);
    let target = targets.pop();
    g.addEdge(source, target);
    repeated.push(target);
    let count = 1;
    while (count < m) {
      if (rng.random() < pTriad) {
        const hood = g.neighbors(target).filter((x) => x !== source && !g.hasEdge(source, x));
        if (hood.length) {
          const x = rng.pick(hood);
          g.addEdge(source, x);
          repeated.push(x);
          count++;
          continue;
        }
      }
      target = targets.pop();
      if (target === undefined) break;
      if (g.addEdge(source, target)) repeated.push(target);
      count++;
    }
    for (let i = 0; i < m; i++) repeated.push(source);
  }
  return g;
}
function randomSubset(seq, m, rng) {
  const s = new Set();
  while (s.size < m) s.add(seq[rng.int(seq.length)]);
  return [...s];
}

// small deterministic graphs
export function ringLattice(n, k = 2) {
  const g = new Graph(n);
  for (let j = 1; j <= Math.floor(k / 2); j++) for (let u = 0; u < n; u++) g.addEdge(u, (u + j) % n);
  return g;
}
export function grid2d(rows, cols) {
  const g = new Graph(rows * cols);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const v = r * cols + c;
    if (c + 1 < cols) g.addEdge(v, v + 1);
    if (r + 1 < rows) g.addEdge(v, v + cols);
  }
  return g;
}
export function complete(n) {
  const g = new Graph(n);
  for (let u = 0; u < n; u++) for (let v = u + 1; v < n; v++) g.addEdge(u, v);
  return g;
}
export function star(n) {
  const g = new Graph(n);
  for (let v = 1; v < n; v++) g.addEdge(0, v);
  return g;
}
export function pathGraph(n) {
  const g = new Graph(n);
  for (let v = 1; v < n; v++) g.addEdge(v - 1, v);
  return g;
}
/** Friendship (windmill) graph: t triangles sharing node 0. Large ⟨C⟩, small transitivity. */
export function windmill(t) {
  const g = new Graph(2 * t + 1);
  for (let i = 0; i < t; i++) {
    const a = 1 + 2 * i, b = 2 + 2 * i;
    g.addEdge(0, a); g.addEdge(0, b); g.addEdge(a, b);
  }
  return g;
}
export function balancedTree(branching, depth) {
  const g = new Graph(1);
  let level = [0];
  for (let d = 0; d < depth; d++) {
    const next = [];
    for (const p of level) for (let b = 0; b < branching; b++) { const v = g.addNode(); g.addEdge(p, v); next.push(v); }
    level = next;
  }
  return g;
}

// ===================================================================== traversal & distances (Section 2.8)

/** Breadth-first search from s: distances (−1 = unreachable), visit order, and optionally path counts σ. */
export function bfs(g, s, { sigma = false } = {}) {
  const { n, off, nbr } = g.csr();
  const dist = new Int32Array(n).fill(-1);
  const order = new Int32Array(n);
  const sg = sigma ? new Float64Array(n) : null;
  dist[s] = 0;
  if (sg) sg[s] = 1;
  order[0] = s;
  let head = 0, tail = 1;
  while (head < tail) {
    const u = order[head++], du = dist[u] + 1;
    for (let j = off[u]; j < off[u + 1]; j++) {
      const v = nbr[j];
      if (dist[v] < 0) { dist[v] = du; order[tail++] = v; }
      if (sg && dist[v] === du) sg[v] += sg[u];
    }
  }
  return { dist, order: order.subarray(0, tail), sigma: sg };
}

/** BFS layers from s: [[s], [distance-1 nodes], [distance-2 nodes], …] (for animations). */
export function bfsLayers(g, s) {
  const { dist, order } = bfs(g, s);
  const layers = [];
  for (const v of order) (layers[dist[v]] ||= []).push(v);
  return layers;
}

/** One shortest path s → t as a node list (or null). */
export function shortestPath(g, s, t) {
  const { dist } = bfs(g, s);
  if (dist[t] < 0) return null;
  const { off, nbr } = g.csr();
  const path = [t];
  let v = t;
  while (v !== s) {
    for (let j = off[v]; j < off[v + 1]; j++) if (dist[nbr[j]] === dist[v] - 1) { v = nbr[j]; break; }
    path.push(v);
  }
  return path.reverse();
}

/** All shortest paths s → t (up to `limit`), and their total number σ_st. */
export function allShortestPaths(g, s, t, limit = 200) {
  const { dist, sigma } = bfs(g, s, { sigma: true });
  if (dist[t] < 0) return { count: 0, paths: [] };
  const { off, nbr } = g.csr();
  const paths = [];
  const stack = [[t]];
  while (stack.length && paths.length < limit) {
    const p = stack.pop();
    const v = p[p.length - 1];
    if (v === s) { paths.push(p.slice().reverse()); continue; }
    for (let j = off[v]; j < off[v + 1]; j++) if (dist[nbr[j]] === dist[v] - 1) stack.push([...p, nbr[j]]);
  }
  return { count: sigma[t], paths };
}

/** Histogram of distances from the given sources: counts[d] = number of (source, target) pairs at distance d ≥ 1. */
export function distanceCounts(g, sources) {
  const counts = [];
  for (const s of sources) {
    const { dist, order } = bfs(g, s);
    for (let i = 1; i < order.length; i++) {
      const d = dist[order[i]];
      counts[d] = (counts[d] || 0) + 1;
    }
  }
  for (let i = 0; i < counts.length; i++) counts[i] ||= 0;
  return counts;
}
export function countsMean(counts) {
  let s = 0, n = 0;
  counts.forEach((c, d) => { s += c * d; n += c; });
  return n ? s / n : NaN;
}

/** The notebook's distance_sample(): BFS from random sources inside the giant component. */
export function distanceSample(g, nSources, rng) {
  const comp = components(g);
  const gc = [];
  for (let v = 0; v < comp.label.length; v++) if (comp.label[v] === comp.giant) gc.push(v);
  const src = rng.sample(gc.length, Math.min(nSources, gc.length)).map((i) => gc[i]);
  const counts = distanceCounts(g, src);
  return { counts, mean: countsMean(counts), max: counts.length - 1 };
}

/** Exact distance statistics (small graphs): diameter and ⟨d⟩ over connected pairs. */
export function distanceStats(g) {
  const n = g.csr().n;
  let sum = 0, pairs = 0, diameter = 0;
  const counts = [];
  for (let s = 0; s < n; s++) {
    const { dist, order } = bfs(g, s);
    for (let i = 1; i < order.length; i++) {
      const d = dist[order[i]];
      sum += d; pairs++;
      if (d > diameter) diameter = d;
      counts[d] = (counts[d] || 0) + 1;
    }
  }
  for (let i = 0; i < counts.length; i++) counts[i] ||= 0;
  return { diameter, avg: pairs ? sum / pairs : NaN, counts, pairs: pairs / 2 };
}

/** All-pairs distance matrix (small graphs). */
export function distanceMatrix(g) {
  const n = g.csr().n;
  const out = [];
  for (let s = 0; s < n; s++) out.push(bfs(g, s).dist);
  return out;
}

/** Dijkstra on a weighted graph, weights given by w(u, v). Returns distances and predecessors. */
export function dijkstra(g, s, w) {
  const { n, off, nbr } = g.csr();
  const dist = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), done = new Uint8Array(n);
  dist[s] = 0;
  const heap = [[0, s]];
  while (heap.length) {
    const [d, u] = heapPop(heap);
    if (done[u]) continue;
    done[u] = 1;
    for (let j = off[u]; j < off[u + 1]; j++) {
      const v = nbr[j], nd = d + w(u, v);
      if (nd < dist[v]) { dist[v] = nd; prev[v] = u; heapPush(heap, [nd, v]); }
    }
  }
  return { dist, prev };
}
function heapPush(h, x) {
  h.push(x);
  let i = h.length - 1;
  while (i > 0) { const p = (i - 1) >> 1; if (h[p][0] <= h[i][0]) break; [h[p], h[i]] = [h[i], h[p]]; i = p; }
}
function heapPop(h) {
  const top = h[0], last = h.pop();
  if (h.length) {
    h[0] = last;
    let i = 0;
    for (;;) {
      const l = 2 * i + 1, r = l + 1;
      let m = i;
      if (l < h.length && h[l][0] < h[m][0]) m = l;
      if (r < h.length && h[r][0] < h[m][0]) m = r;
      if (m === i) break;
      [h[m], h[i]] = [h[i], h[m]]; i = m;
    }
  }
  return top;
}

// ===================================================================== connectedness (Section 2.9)

/** Connected components: label per node, size per label, and the label of the largest one. */
export function components(g) {
  const { n, off, nbr } = g.csr();
  const label = new Int32Array(n).fill(-1);
  const sizes = [];
  const queue = new Int32Array(n);
  for (let s = 0; s < n; s++) {
    if (label[s] >= 0) continue;
    const c = sizes.length;
    let head = 0, tail = 1, size = 0;
    queue[0] = s; label[s] = c;
    while (head < tail) {
      const u = queue[head++]; size++;
      for (let j = off[u]; j < off[u + 1]; j++) if (label[nbr[j]] < 0) { label[nbr[j]] = c; queue[tail++] = nbr[j]; }
    }
    sizes.push(size);
  }
  let giant = 0;
  for (let c = 1; c < sizes.length; c++) if (sizes[c] > sizes[giant]) giant = c;
  const sorted = sizes.slice().sort((a, b) => b - a);
  return { label, sizes, giant, count: sizes.length, giantSize: sizes[giant] || 0, second: sorted[1] || 0, sorted };
}

/** Union–find with component sizes; tracks the largest component as links are added. */
export class UnionFind {
  constructor(n) {
    this.parent = new Int32Array(n);
    this.size = new Int32Array(n).fill(1);
    for (let i = 0; i < n; i++) this.parent[i] = i;
    this.count = n;
    this.largest = n ? 1 : 0;
    this.sizeCount = new Int32Array(n + 1);
    this.sizeCount[1] = n;
  }
  find(x) {
    const p = this.parent;
    while (p[x] !== x) { p[x] = p[p[x]]; x = p[x]; }
    return x;
  }
  union(a, b) {
    a = this.find(a); b = this.find(b);
    if (a === b) return false;
    if (this.size[a] < this.size[b]) [a, b] = [b, a];
    this.sizeCount[this.size[a]]--; this.sizeCount[this.size[b]]--;
    this.parent[b] = a;
    this.size[a] += this.size[b];
    this.sizeCount[this.size[a]]++;
    if (this.size[a] > this.largest) this.largest = this.size[a];
    this.count--;
    return true;
  }
  /** Size of the second-largest component (O(N) scan; call sparingly). */
  second() {
    let seenLargest = false;
    for (let s = this.largest; s >= 1; s--) {
      const c = this.sizeCount[s];
      if (!c) continue;
      if (!seenLargest) { seenLargest = true; if (c > 1) return s; continue; }
      return s;
    }
    return 0;
  }
}

/** Bridges (links whose removal disconnects the graph) and articulation points (iterative Tarjan). */
export function bridgesAndCutNodes(g) {
  const { n, off, nbr } = g.csr();
  const disc = new Int32Array(n).fill(-1), low = new Int32Array(n), parent = new Int32Array(n).fill(-1);
  const it = new Int32Array(n);
  const bridges = [], cut = new Set();
  let time = 0;
  for (let r = 0; r < n; r++) {
    if (disc[r] >= 0) continue;
    const stack = [r];
    disc[r] = low[r] = time++;
    it[r] = off[r];
    let rootChildren = 0;
    while (stack.length) {
      const u = stack[stack.length - 1];
      if (it[u] < off[u + 1]) {
        const v = nbr[it[u]++];
        if (disc[v] < 0) {
          parent[v] = u;
          disc[v] = low[v] = time++;
          it[v] = off[v];
          stack.push(v);
          if (u === r) rootChildren++;
        } else if (v !== parent[u]) {
          low[u] = Math.min(low[u], disc[v]);
        }
      } else {
        stack.pop();
        const p = parent[u];
        if (p >= 0) {
          low[p] = Math.min(low[p], low[u]);
          if (low[u] > disc[p]) bridges.push([Math.min(p, u), Math.max(p, u)]);
          if (p !== r && low[u] >= disc[p]) cut.add(p);
        }
      }
    }
    if (rootChildren > 1) cut.add(r);
  }
  return { bridges, cutNodes: [...cut] };
}

/** Induced subgraph on `nodes`; returns {graph, map: old → new, nodes: new → old}. */
export function subgraph(g, nodes) {
  const map = new Map();
  nodes.forEach((v, i) => map.set(v, i));
  const h = new Graph(nodes.length);
  const { off, nbr } = g.csr();
  nodes.forEach((u, i) => {
    for (let j = off[u]; j < off[u + 1]; j++) {
      const k = map.get(nbr[j]);
      if (k !== undefined && i < k) h.addEdge(i, k);
    }
  });
  return { graph: h, map, nodes };
}

/** The largest connected component as its own graph. */
export function giantComponent(g) {
  const c = components(g);
  const nodes = [];
  for (let v = 0; v < c.label.length; v++) if (c.label[v] === c.giant) nodes.push(v);
  return subgraph(g, nodes);
}

// ===================================================================== clustering (Section 2.10)

/** Number of triangles through every node (degree-ordered enumeration, each triangle found once). */
export function triangles(g) {
  const { n, off, nbr } = g.csr();
  const rank = new Int32Array(n);
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => (off[a + 1] - off[a]) - (off[b + 1] - off[b]) || a - b);
  order.forEach((v, i) => { rank[v] = i; });
  // forward adjacency: neighbours of higher rank
  const fo = new Int32Array(n + 1);
  for (let u = 0; u < n; u++) for (let j = off[u]; j < off[u + 1]; j++) if (rank[nbr[j]] > rank[u]) fo[u + 1]++;
  for (let u = 0; u < n; u++) fo[u + 1] += fo[u];
  const fn = new Int32Array(fo[n]), fill = fo.slice(0, n);
  for (let u = 0; u < n; u++) for (let j = off[u]; j < off[u + 1]; j++) if (rank[nbr[j]] > rank[u]) fn[fill[u]++] = nbr[j];
  const t = new Int32Array(n), mark = new Int32Array(n).fill(-1);
  for (let u = 0; u < n; u++) {
    for (let j = fo[u]; j < fo[u + 1]; j++) mark[fn[j]] = u;
    for (let j = fo[u]; j < fo[u + 1]; j++) {
      const v = fn[j];
      for (let q = fo[v]; q < fo[v + 1]; q++) {
        const w = fn[q];
        if (mark[w] === u) { t[u]++; t[v]++; t[w]++; }
      }
    }
  }
  return t;
}

/** Local clustering C_i = 2 L_i / (k_i (k_i − 1)), with C_i = 0 when k_i < 2 (as NetworkX). */
export function localClustering(g, tri = triangles(g)) {
  const { n, off } = g.csr();
  const C = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const k = off[i + 1] - off[i];
    C[i] = k < 2 ? 0 : (2 * tri[i]) / (k * (k - 1));
  }
  return C;
}

/** Clustering summaries: ⟨C⟩ (book Eq. 2.16), global C_Δ (transitivity), triangle count. */
export function clusteringSummary(g) {
  const tri = triangles(g);
  const C = localClustering(g, tri);
  const { n, off } = g.csr();
  let sumC = 0, sumT = 0, triples = 0;
  for (let i = 0; i < n; i++) {
    const k = off[i + 1] - off[i];
    sumC += C[i]; sumT += tri[i]; triples += (k * (k - 1)) / 2;
  }
  return { local: C, triangles: tri, avg: n ? sumC / n : 0, transitivity: triples ? sumT / triples : 0, triangleCount: sumT / 3 };
}

/** Average C_i of the nodes with degree k: [[k, C(k), count], …] for k ≥ 2. */
export function clusteringByDegree(g, C = localClustering(g)) {
  const { n, off } = g.csr();
  const acc = new Map();
  for (let i = 0; i < n; i++) {
    const k = off[i + 1] - off[i];
    if (k < 2) continue;
    const a = acc.get(k) || [0, 0];
    a[0] += C[i]; a[1]++;
    acc.set(k, a);
  }
  return [...acc.entries()].sort((a, b) => a[0] - b[0]).map(([k, [s, c]]) => [k, s / c, c]);
}

// ===================================================================== degree correlations (Ch 7 preview)

/** Degree assortativity coefficient r (Newman 2002): Pearson correlation of the degrees at the two ends of a link. */
export function assortativity(g) {
  const { n, off, nbr } = g.csr();
  let m = 0, sjk = 0, sjpk = 0, sj2k2 = 0;
  for (let u = 0; u < n; u++) {
    const ku = off[u + 1] - off[u];
    for (let j = off[u]; j < off[u + 1]; j++) {
      const v = nbr[j];
      if (v < u) continue;
      const kv = off[v + 1] - off[v];
      m++; sjk += ku * kv; sjpk += (ku + kv) / 2; sj2k2 += (ku * ku + kv * kv) / 2;
    }
  }
  if (!m) return NaN;
  const a = sjpk / m;
  const den = sj2k2 / m - a * a;
  return den === 0 ? NaN : (sjk / m - a * a) / den;
}

/** Average degree of the neighbours of each node, and its average k_nn(k) over nodes of degree k. */
export function neighborDegree(g) {
  const { n, off, nbr } = g.csr();
  const knn = new Float64Array(n);
  for (let u = 0; u < n; u++) {
    const k = off[u + 1] - off[u];
    if (!k) continue;
    let s = 0;
    for (let j = off[u]; j < off[u + 1]; j++) s += off[nbr[j] + 1] - off[nbr[j]];
    knn[u] = s / k;
  }
  const acc = new Map();
  for (let u = 0; u < n; u++) {
    const k = off[u + 1] - off[u];
    if (!k) continue;
    const a = acc.get(k) || [0, 0];
    a[0] += knn[u]; a[1]++;
    acc.set(k, a);
  }
  return { knn, byDegree: [...acc.entries()].sort((a, b) => a[0] - b[0]).map(([k, [s, c]]) => [k, s / c, c]) };
}

// ===================================================================== centralities (for the network lab)

/** Betweenness centrality (Brandes 2001), normalised like NetworkX for undirected graphs. */
export function betweenness(g, { normalized = true } = {}) {
  const { n, off, nbr } = g.csr();
  const CB = new Float64Array(n);
  const dist = new Int32Array(n), sigma = new Float64Array(n), delta = new Float64Array(n), stack = new Int32Array(n);
  const queue = new Int32Array(n);
  for (let s = 0; s < n; s++) {
    dist.fill(-1); sigma.fill(0); delta.fill(0);
    dist[s] = 0; sigma[s] = 1;
    let head = 0, tail = 1, sp = 0;
    queue[0] = s;
    while (head < tail) {
      const u = queue[head++];
      stack[sp++] = u;
      for (let j = off[u]; j < off[u + 1]; j++) {
        const v = nbr[j];
        if (dist[v] < 0) { dist[v] = dist[u] + 1; queue[tail++] = v; }
        if (dist[v] === dist[u] + 1) sigma[v] += sigma[u];
      }
    }
    while (sp > 0) {
      const w = stack[--sp];
      for (let j = off[w]; j < off[w + 1]; j++) {
        const v = nbr[j];
        if (dist[v] === dist[w] - 1) delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w]);
      }
      if (w !== s) CB[w] += delta[w];
    }
  }
  const scale = normalized ? (n > 2 ? 1 / ((n - 1) * (n - 2)) : 1) : 0.5;
  for (let i = 0; i < n; i++) CB[i] *= scale;
  return CB;
}

/** Closeness centrality with the Wasserman–Faust correction for disconnected graphs (NetworkX default). */
export function closeness(g) {
  const n = g.csr().n;
  const out = new Float64Array(n);
  for (let u = 0; u < n; u++) {
    const { dist, order } = bfs(g, u);
    let tot = 0;
    for (const v of order) tot += dist[v];
    const r = order.length - 1;
    out[u] = tot > 0 && n > 1 ? (r / tot) * (r / (n - 1)) : 0;
  }
  return out;
}

/** Eigenvector centrality by power iteration on A + I (as NetworkX), unit Euclidean norm. */
export function eigenvector(g, { iters = 1000, tol = 1e-8 } = {}) {
  const { n, off, nbr } = g.csr();
  let x = new Float64Array(n).fill(1 / n);
  for (let it = 0; it < iters; it++) {
    const y = Float64Array.from(x);
    for (let u = 0; u < n; u++) for (let j = off[u]; j < off[u + 1]; j++) y[nbr[j]] += x[u];
    let norm = 0;
    for (const v of y) norm += v * v;
    norm = Math.sqrt(norm) || 1;
    let diff = 0;
    for (let i = 0; i < n; i++) { y[i] /= norm; diff += Math.abs(y[i] - x[i]); }
    x = y;
    if (diff < n * tol) break;
  }
  return x;
}

/** PageRank with damping α; dangling nodes redistribute uniformly. */
export function pagerank(g, alpha = 0.85, { iters = 200, tol = 1e-10 } = {}) {
  const { n, off, nbr } = g.csr();
  let x = new Float64Array(n).fill(1 / n);
  for (let it = 0; it < iters; it++) {
    const y = new Float64Array(n);
    let dangling = 0;
    for (let u = 0; u < n; u++) {
      const k = off[u + 1] - off[u];
      if (!k) { dangling += x[u]; continue; }
      const share = (alpha * x[u]) / k;
      for (let j = off[u]; j < off[u + 1]; j++) y[nbr[j]] += share;
    }
    const base = (1 - alpha) / n + (alpha * dangling) / n;
    let diff = 0;
    for (let i = 0; i < n; i++) { y[i] += base; diff += Math.abs(y[i] - x[i]); }
    x = y;
    if (diff < n * tol) break;
  }
  return x;
}

/** k-core numbers (Batagelj & Zaversnik 2003). */
export function coreNumbers(g) {
  const { n, off, nbr } = g.csr();
  const deg = new Int32Array(n);
  let maxd = 0;
  for (let i = 0; i < n; i++) { deg[i] = off[i + 1] - off[i]; if (deg[i] > maxd) maxd = deg[i]; }
  const bin = new Int32Array(maxd + 1);
  for (let i = 0; i < n; i++) bin[deg[i]]++;
  let start = 0;
  for (let d = 0; d <= maxd; d++) { const c = bin[d]; bin[d] = start; start += c; }
  const pos = new Int32Array(n), vert = new Int32Array(n);
  for (let v = 0; v < n; v++) { pos[v] = bin[deg[v]]; vert[pos[v]] = v; bin[deg[v]]++; }
  for (let d = maxd; d > 0; d--) bin[d] = bin[d - 1];
  bin[0] = 0;
  for (let i = 0; i < n; i++) {
    const v = vert[i];
    for (let j = off[v]; j < off[v + 1]; j++) {
      const u = nbr[j];
      if (deg[u] > deg[v]) {
        const du = deg[u], pu = pos[u], pw = bin[du], w = vert[pw];
        if (u !== w) { pos[u] = pw; vert[pu] = w; pos[w] = pu; vert[pw] = u; }
        bin[du]++; deg[u]--;
      }
    }
  }
  return deg;
}

/** Label propagation communities (Raghavan et al. 2007), asynchronous with random order. */
export function labelPropagation(g, rng, maxIter = 100) {
  const { n, off, nbr } = g.csr();
  const label = Int32Array.from({ length: n }, (_, i) => i);
  const order = Array.from({ length: n }, (_, i) => i);
  for (let it = 0; it < maxIter; it++) {
    rng.shuffle(order);
    let changed = false;
    for (const u of order) {
      if (off[u + 1] === off[u]) continue;
      const cnt = new Map();
      let best = 0;
      for (let j = off[u]; j < off[u + 1]; j++) {
        const l = label[nbr[j]], c = (cnt.get(l) || 0) + 1;
        cnt.set(l, c);
        if (c > best) best = c;
      }
      const top = [...cnt.entries()].filter(([, c]) => c === best).map(([l]) => l);
      if (!top.includes(label[u])) { label[u] = rng.pick(top); changed = true; }
    }
    if (!changed) break;
  }
  const remap = new Map();
  return Int32Array.from(label, (l) => { if (!remap.has(l)) remap.set(l, remap.size); return remap.get(l); });
}

/** Modularity Q of a partition (Ch 9). */
export function modularity(g, labels) {
  const { n, off, nbr } = g.csr();
  const m = off[n] / 2;
  if (!m) return 0;
  const inside = new Map(), degSum = new Map();
  for (let u = 0; u < n; u++) {
    const l = labels[u];
    degSum.set(l, (degSum.get(l) || 0) + (off[u + 1] - off[u]));
    for (let j = off[u]; j < off[u + 1]; j++) if (labels[nbr[j]] === l) inside.set(l, (inside.get(l) || 0) + 1);
  }
  let Q = 0;
  for (const [l, ds] of degSum) Q += (inside.get(l) || 0) / (2 * m) - (ds / (2 * m)) ** 2;
  return Q;
}

// ===================================================================== randomisation (Section 4.8)

/**
 * Degree-preserving randomisation: repeatedly pick links A–B and C–D and rewire them to A–D and C–B,
 * unless that would create a self-loop or a repeated link. Every node keeps its degree.
 * Mutates g. Returns {swaps, tries}. `edges` (optional) is the edge list kept in sync for fast sampling.
 */
export function doubleEdgeSwap(g, nswap, rng, { maxTries = nswap * 20, edges = g.edges(), onSwap = null } = {}) {
  let swaps = 0, tries = 0;
  while (swaps < nswap && tries < maxTries) {
    tries++;
    const s = trySwap(g, edges, rng);
    if (s) { swaps++; if (onSwap) onSwap(s); }
  }
  return { swaps, tries, edges };
}
/** One swap attempt; returns {i, j, removed: [[a,b],[c,d]], added: [[a,d],[c,b]]} or null. */
export function trySwap(g, edges, rng) {
  if (edges.length < 2) return null;
  const i = rng.int(edges.length);
  let j = rng.int(edges.length - 1);
  if (j >= i) j++;
  let [a, b] = edges[i];
  let [c, d] = edges[j];
  if (rng.random() < 0.5) [a, b] = [b, a];
  if (a === d || c === b || a === c || b === d) return null;
  if (g.hasEdge(a, d) || g.hasEdge(c, b)) return null;
  g.removeEdge(a, b); g.removeEdge(c, d);
  g.addEdge(a, d); g.addEdge(c, b);
  edges[i] = [a, d]; edges[j] = [c, b];
  return { i, j, removed: [[a, b], [c, d]], added: [[a, d], [c, b]] };
}

// ===================================================================== robustness (Ch 8 preview)

/**
 * Size of the giant component as nodes are removed in `order` (first element removed first).
 * Computed backwards with union–find: O(L α(N)). Returns Float64Array giant[f] for f = 0..N removed.
 */
export function removalCurve(g, order) {
  const { n, off, nbr } = g.csr();
  const uf = new UnionFind(n);
  const present = new Uint8Array(n);
  const out = new Float64Array(n + 1);
  out[n] = 0;
  let largest = 0;
  for (let i = n - 1; i >= 0; i--) {
    const v = order[i];
    present[v] = 1;
    for (let j = off[v]; j < off[v + 1]; j++) if (present[nbr[j]]) uf.union(v, nbr[j]);
    largest = Math.max(largest, uf.size[uf.find(v)]);
    out[i] = largest;
  }
  return out;
}

// ===================================================================== layouts

export function circularLayout(n, r = 1) {
  return Array.from({ length: n }, (_, i) => [r * Math.cos((2 * Math.PI * i) / n - Math.PI / 2), r * Math.sin((2 * Math.PI * i) / n - Math.PI / 2)]);
}

/** Degree statistics of any graph. */
export function degreeStats(g) {
  const d = g.degrees ? g.degrees() : g.csr().degrees();
  let s = 0, s2 = 0, max = 0, min = Infinity;
  for (const k of d) { s += k; s2 += k * k; if (k > max) max = k; if (k < min) min = k; }
  const n = d.length;
  return { n, m: s / 2, avg: n ? s / n : 0, k2: n ? s2 / n : 0, max, min: n ? min : 0, degrees: d };
}
