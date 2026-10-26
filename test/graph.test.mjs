// Graph algorithms checked against NetworkX on Zachary's karate club (values in test/fixtures/reference.json).
import { test } from "node:test";
import assert from "node:assert/strict";
import { karate, ref, close, readJSON, root } from "./helpers.mjs";
import * as G from "../site/js/lib/graph.js";
import { RNG } from "../site/js/lib/rng.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const R = ref.karate;

test("karate club: size and degrees", () => {
  const g = karate();
  assert.equal(g.n, R.n);
  assert.equal(g.m, R.m);
  const d = g.degrees();
  assert.equal(d[33], 17);
  assert.equal(d[0], 16);
  close(G.degreeStats(g).avg, (2 * 78) / 34, 1e-12);
});

test("triangles and clustering match NetworkX", () => {
  const g = karate();
  const c = G.clusteringSummary(g);
  assert.deepEqual(Array.from(c.triangles), R.triangles);
  c.local.forEach((x, i) => close(x, R.clustering[i], 1e-12, `C_${i}`));
  close(c.avg, R.avgClustering, 1e-12, "<C>");
  close(c.transitivity, R.transitivity, 1e-12, "transitivity");
  assert.equal(c.triangleCount, 45);
});

test("distances: diameter, average distance, shortest-path counts", () => {
  const g = karate();
  const s = G.distanceStats(g);
  assert.equal(s.diameter, R.diameter);
  close(s.avg, R.avgDistance, 1e-12, "<d>");
  assert.equal(G.allShortestPaths(g, 14, 16).count, R.shortestPaths_14_16);
  assert.equal(G.allShortestPaths(g, 14, 16).paths.length, R.shortestPaths_14_16);
  const p = G.shortestPath(g, 14, 16);
  assert.equal(p.length - 1, 5);
  for (let i = 1; i < p.length; i++) assert.ok(g.hasEdge(p[i - 1], p[i]));
});

test("assortativity and k_nn(k)", () => {
  const g = karate();
  close(G.assortativity(g), R.assortativity, 1e-12, "r");
  const { byDegree } = G.neighborDegree(g);
  for (const [k, knn] of byDegree) close(knn, R.knn[String(k)], 1e-12, `knn(${k})`);
});

test("centralities match NetworkX", () => {
  const g = karate();
  G.betweenness(g).forEach((x, i) => close(x, R.betweenness[i], 1e-12, `betweenness ${i}`));
  G.closeness(g).forEach((x, i) => close(x, R.closeness[i], 1e-12, `closeness ${i}`));
  G.eigenvector(g, { tol: 1e-12 }).forEach((x, i) => close(x, R.eigenvector[i], 1e-5, `eigenvector ${i}`));
  G.pagerank(g).forEach((x, i) => close(x, R.pagerank[i], 1e-6, `pagerank ${i}`));
  assert.deepEqual(Array.from(G.coreNumbers(g)), R.core);
});

test("bridges, articulation points, components", () => {
  const g = karate();
  const { bridges, cutNodes } = G.bridgesAndCutNodes(g);
  assert.deepEqual(bridges.sort(), R.bridges);
  assert.deepEqual(cutNodes.sort((a, b) => a - b), R.articulation);
  g.removeEdge(0, 11);
  const c = G.components(g);
  assert.equal(c.count, 2);
  assert.equal(c.giantSize, 33);
});

test("modularity of the observed split", () => {
  const { karate: K } = readJSON("site", "data", "classic.json");
  const g = karate();
  const labels = K.nodes.map((v) => (v.club === "Mr. Hi" ? 0 : 1));
  close(G.modularity(g, labels), R.modularityClub, 1e-12, "Q");
});

test("Les Misérables: betweenness and clustering", () => {
  const { lesmis } = readJSON("site", "data", "classic.json");
  const g = G.Graph.fromEdges(lesmis.names.length, lesmis.edges);
  close(Math.max(...G.betweenness(g)), ref.karate.lesmis.betweenness_max, 1e-12);
  close(G.clusteringSummary(g).transitivity, ref.karate.lesmis.transitivity, 1e-12);
  close(G.clusteringSummary(g).avg, ref.karate.lesmis.avgClustering, 1e-12);
});

test("G(N, p) has the right number of links on average", () => {
  const rng = new RNG(1);
  const N = 200, p = 0.05, R_ = 300;
  let sum = 0;
  for (let r = 0; r < R_; r++) sum += G.gnpPairs(N, p, rng).length / 2;
  close(sum / R_, (p * N * (N - 1)) / 2, 6, "<L>");
  const g = G.gnp(N, p, rng);
  for (const [u, v] of g.edges()) assert.ok(u !== v);
});

test("G(N, L), configuration model and swaps preserve what they should", () => {
  const rng = new RNG(7);
  assert.equal(G.gnmPairs(100, 300, rng).length, 600);
  assert.equal(G.gnmPairs(20, 180, rng).length, 360);
  const k = G.powerlawSequence(2000, 2.5, 2, rng);
  assert.equal(k.reduce((a, b) => a + b, 0) % 2, 0);
  const cm = G.configurationModel(k, rng);
  assert.equal(cm.pairs.length / 2 + cm.selfLoops + cm.multiLinks, cm.raw.length / 2);
  const g = karate();
  const before = Array.from(g.degrees());
  const res = G.doubleEdgeSwap(g, 200, rng);
  assert.ok(res.swaps === 200);
  assert.deepEqual(Array.from(g.degrees()), before);
  assert.equal(g.m, 78);
});

test("generators: BA, Watts–Strogatz, Holme–Kim, geometric", () => {
  const rng = new RNG(3);
  const ba = G.barabasiAlbert(500, 2, rng);
  assert.equal(ba.n, 500);
  assert.equal(ba.m, 3 + 497 * 2);
  const ws = G.wattsStrogatz(100, 4, 0.1, rng);
  assert.equal(ws.m, 200);
  const hk = G.holmeKim(300, 3, 0.7, rng);
  assert.ok(G.clusteringSummary(hk).avg > 0.2);
  const { graph } = G.randomGeometric(300, 0.1, rng);
  assert.ok(graph.m > 0);
  assert.equal(G.windmill(5).m, 15);
});

test("union-find tracks the giant component", () => {
  const uf = new G.UnionFind(10);
  uf.union(0, 1); uf.union(1, 2); uf.union(5, 6);
  assert.equal(uf.largest, 3);
  assert.equal(uf.second(), 2);
  assert.equal(uf.count, 7);
});

test("removal curve equals recomputing components", () => {
  const g = karate();
  const order = Array.from({ length: 34 }, (_, i) => i).sort((a, b) => g.degree(b) - g.degree(a));
  const curve = G.removalCurve(g, order);
  for (const f of [0, 1, 2, 5, 10]) {
    const h = g.clone();
    for (const v of order.slice(0, f)) h.isolate(v);
    const c = G.components(h);
    const removed = new Set(order.slice(0, f));
    let best = 0;
    c.sizes.forEach((s, lab) => {
      // isolated removed nodes form singleton components; ignore them
      let real = 0;
      for (let v = 0; v < 34; v++) if (c.label[v] === lab && !removed.has(v)) real++;
      best = Math.max(best, real);
    });
    assert.equal(curve[f], best, `after removing ${f}`);
  }
});

test("real networks: CSR loading reproduces the precomputed summaries", () => {
  const { networks } = readJSON("site", "data", "networks.json");
  for (const name of ["protein", "powergrid", "collaboration"]) {
    const meta = networks[name];
    const buf = readFileSync(join(root, "site", "data", meta.edgeFile));
    const pairs = new Uint16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2);
    const g = G.CSRGraph.fromPairs(meta.N, Int32Array.from(pairs));
    assert.equal(g.m, meta.L);
    const c = G.components(g);
    assert.equal(c.count, meta.components.count);
    const cl = G.clusteringSummary(g);
    close(cl.avg, meta.clustering.avg, 1e-5, `${name} <C>`);
    close(cl.transitivity, meta.clustering.transitivity, 1e-5, `${name} transitivity`);
    close(G.assortativity(g), meta.assortativity, 1e-5, `${name} r`);
  }
});
