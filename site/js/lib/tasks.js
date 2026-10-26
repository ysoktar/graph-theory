// Heavier simulations, written as generators that yield progress. They run inside a Web Worker
// (see workers/compute.js) so the page stays responsive, and can also run directly (tests, fallback).
import * as G from "./graph.js";
import * as S from "./stats.js";
import { RNG } from "./rng.js";

const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;

function buildModel(model, N, rng, memo) {
  if (model.kind === "er") {
    const k = model.matchTo ? memo.get(model.matchTo + "|" + N) : model.avgk;
    return G.gnpCSR(N, Math.min(1, k / (N - 1)), rng);
  }
  if (model.kind === "pl") {
    const seq = G.powerlawSequence(N, model.gamma, model.kmin, rng);
    return G.configurationCSR(seq, rng);
  }
  throw new Error("unknown model " + model.kind);
}

/** ⟨d⟩ versus N for random (ER) and configuration-model power-law networks (book Fig. 4.12, notebook III.7). */
export function* distanceVsN({ models, Ns, reps = 2, sources = 60, seed = 2026 }) {
  const rng = new RNG(seed);
  const memo = new Map();
  const rows = [];
  // power-law models first, so that "matched" ER models can use their realised ⟨k⟩
  const ordered = [...models].sort((a, b) => (a.kind === "pl" ? -1 : 0) - (b.kind === "pl" ? -1 : 0));
  for (const model of ordered) {
    for (const N of Ns) {
      const ds = [], ks = [];
      for (let r = 0; r < reps; r++) {
        const g = buildModel(model, N, rng, memo);
        ks.push((2 * g.m) / N);
        ds.push(G.distanceSample(g, sources, rng).mean);
      }
      const row = { label: model.label, N, d: avg(ds), avgk: avg(ks) };
      memo.set(model.label + "|" + N, row.avgk);
      rows.push(row);
      yield row;
    }
  }
  return rows;
}

/** Largest of N draws: power law vs. exponential with the same mean (notebook III.4). */
export function* kmaxVsN({ gamma, kmin = 1, Ns, reps = 50, seed = 2026 }) {
  const rng = new RNG(seed);
  const meanK = (kmin * (gamma - 1)) / (gamma - 2);
  const lam = 1 / (meanK - kmin);
  const rows = [];
  const e = -1 / (gamma - 1);
  for (const N of Ns) {
    const pl = [], ex = [];
    for (let r = 0; r < reps; r++) {
      let mp = 0, me = 0;
      for (let i = 0; i < N; i++) {
        const a = kmin * Math.pow(1 - rng.random(), e);
        if (a > mp) mp = a;
        const b = kmin - Math.log(1 - rng.random()) / lam;
        if (b > me) me = b;
      }
      pl.push(mp); ex.push(me);
    }
    // Poisson with the same mean: exact median of the maximum, P(max ≤ k) = F(k)^N
    let k = 0, F = 0;
    for (;; k++) { F += S.poissonPmf(k, meanK); if (Math.pow(F, N) >= 0.5) break; }
    const row = { N, pl: S.median(pl), exp: S.median(ex), poisson: k, meanK, lambda: lam };
    rows.push(row);
    yield row;
  }
  return rows;
}

/** Sample moments ⟨k⟩ and ⟨k²⟩ versus N for a power law and a Poisson law with the same mean (III.5). */
export function* momentsVsN({ gamma, kmin = 1, Ns, reps = 30, seed = 2026 }) {
  const rng = new RNG(seed);
  const meanK = gamma > 2 ? (kmin * (gamma - 1)) / (gamma - 2) : 3;
  const e = -1 / (gamma - 1);
  const rows = [];
  for (const N of Ns) {
    const m1p = [], m2p = [], m1q = [], m2q = [];
    for (let r = 0; r < reps; r++) {
      let s1 = 0, s2 = 0, t1 = 0, t2 = 0;
      for (let i = 0; i < N; i++) {
        const a = kmin * Math.pow(1 - rng.random(), e);
        s1 += a; s2 += a * a;
        const b = rng.poisson(meanK);
        t1 += b; t2 += b * b;
      }
      m1p.push(s1 / N); m2p.push(s2 / N); m1q.push(t1 / N); m2q.push(t2 / N);
    }
    const row = { N, m1pl: S.median(m1p), m2pl: S.median(m2p), m1po: S.median(m1q), m2po: S.median(m2q), meanK };
    rows.push(row);
    yield row;
  }
  return rows;
}

/** The five estimators of notebook III.3 on one sample. */
export function estimators(x) {
  const h = S.histogram(x);
  const lin = S.pkLinear(h);
  const lb = S.pkLogBinned(h);
  const cc = S.ccdf(h);
  const f1 = S.logLogFit(lin.map((d) => d[0]), lin.map((d) => d[1]));
  const f2 = S.logLogFit(lb.map((d) => d[0]), lb.map((d) => d[1]));
  const f3 = S.logLogFit(cc.map((d) => d[0]), cc.map((d) => d[1]));
  const tail6 = S.histTail(h, 6);
  return {
    lsLinear: -f1.slope, lsLog: -f2.slope, lsCcdf: 1 - f3.slope,
    closedForm: tail6.k.length ? S.powerLawClosedForm(tail6, 6) : NaN,
    mle: S.powerLawMLE(h, h.k[0] >= 1 ? 1 : 1).gamma,
    fits: { f1, f2, f3 }, h, lin, lb, cc,
  };
}

/** Repeat the controlled experiment many times to expose each estimator's bias and spread. */
export function* estimatorTrials({ gamma, n, trials = 200, seed = 2026 }) {
  const rng = new RNG(seed);
  const out = { lsLinear: [], lsLog: [], lsCcdf: [], closedForm: [], mle: [] };
  for (let t = 0; t < trials; t++) {
    const e = estimators(S.samplePowerLaw(n, gamma, 1, rng));
    for (const k of Object.keys(out)) out[k].push(e[k]);
    if (t % 10 === 9 || t === trials - 1) yield { done: t + 1, trials };
  }
  return out;
}

/** Erdős–Rényi process: fraction in the largest and size of the 2nd-largest component versus ⟨k⟩. */
export function* giantVsK({ N, kMax = 6, points = 120, reps = 1, seed = 2026 }) {
  const rng = new RNG(seed);
  const acc = Array.from({ length: points + 1 }, (_, i) => ({ k: (kMax * i) / points, S1: 0, S2: 0 }));
  for (let r = 0; r < reps; r++) {
    const uf = new G.UnionFind(N);
    const seen = new Set();
    let L = 0, p = 0;
    const Lmax = (N * (N - 1)) / 2;
    while (p <= points) {
      const target = Math.min(Lmax, Math.round((acc[p].k * N) / 2));
      while (L < target) {
        const u = rng.int(N), v = rng.int(N);
        if (u === v) continue;
        const key = G.edgeKey(u, v);
        if (seen.has(key)) continue;
        seen.add(key);
        uf.union(u, v);
        L++;
      }
      acc[p].S1 += uf.largest / N / reps;
      acc[p].S2 += uf.second() / reps;
      p++;
    }
    yield { rep: r + 1, reps };
  }
  return acc;
}

/** Largest-component size N_G versus N at fixed ⟨k⟩ (Advanced Topic 3.D). */
export function* giantScaling({ Ns, ks, reps = 3, seed = 2026 }) {
  const rng = new RNG(seed);
  const rows = [];
  for (const k of ks) {
    for (const N of Ns) {
      const vals = [];
      for (let r = 0; r < reps; r++) {
        const uf = new G.UnionFind(N);
        const pairs = G.gnpPairs(N, k / (N - 1), rng);
        for (let i = 0; i < pairs.length; i += 2) uf.union(pairs[i], pairs[i + 1]);
        vals.push(uf.largest);
      }
      const row = { k, N, NG: avg(vals) };
      rows.push(row);
      yield row;
    }
  }
  return rows;
}

/** Watts–Strogatz: C(p)/C(0) and ⟨d⟩(p)/⟨d⟩(0). */
export function* wattsStrogatzSweep({ N = 500, k = 6, ps, reps = 2, sources = 80, seed = 2026 }) {
  const rng = new RNG(seed);
  const base = G.wattsStrogatz(N, k, 0, rng);
  const C0 = G.clusteringSummary(base).avg, d0 = G.distanceSample(base, sources, rng).mean;
  const rows = [];
  for (const p of ps) {
    const cs = [], ds = [];
    for (let r = 0; r < reps; r++) {
      const g = G.wattsStrogatz(N, k, p, rng);
      cs.push(G.clusteringSummary(g).avg);
      ds.push(G.distanceSample(g, sources, rng).mean);
    }
    const row = { p, C: avg(cs) / C0, d: avg(ds) / d0, C0, d0 };
    rows.push(row);
    yield row;
  }
  return rows;
}

function graphStats(g, rng, sources = 100) {
  const c = G.clusteringSummary(g);
  const comp = G.components(g);
  return {
    C: c.avg, transitivity: c.transitivity, r: G.assortativity(g),
    giant: comp.giantSize / g.n, d: G.distanceSample(g, sources, rng).mean,
    Ck: G.clusteringByDegree(g, c.local).map(([k, C]) => [k, C]),
  };
}

/** Degree-preserving randomisation of a network given as flat pairs; reports before/after statistics. */
export function* randomize({ n, pairs, factor = 2, seed = 2026, sources = 100, checkpoints = 10 }) {
  const rng = new RNG(seed);
  const g = G.pairsToGraph(n, pairs);
  const degBefore = g.degrees();
  const before = graphStats(g, rng, sources);
  yield { phase: "before", stats: before };
  const total = Math.round(factor * g.m);
  const edges = g.edges();
  const curve = [{ swaps: 0, C: before.C, r: before.r }];
  let done = 0;
  for (let c = 1; c <= checkpoints; c++) {
    const target = Math.round((total * c) / checkpoints);
    const res = G.doubleEdgeSwap(g, target - done, rng, { edges });
    done += res.swaps;
    const cs = G.clusteringSummary(g);
    curve.push({ swaps: done, C: cs.avg, r: G.assortativity(g) });
    yield { phase: "swapping", done, total, curve };
  }
  const after = graphStats(g, rng, sources);
  const degAfter = g.degrees();
  let same = degAfter.length === degBefore.length;
  for (let i = 0; same && i < degAfter.length; i++) same = degAfter[i] === degBefore[i];
  return { before, after, curve, swaps: done, degreesPreserved: same };
}

/** SIR outbreak size versus transmissibility on several networks (Reed–Frost: infectious for one step). */
export function* sirSweep({ graphs, betas, reps = 20, seed = 2026 }) {
  const rng = new RNG(seed);
  const out = {};
  for (const gdef of graphs) {
    const g = G.CSRGraph.fromPairs(gdef.n, gdef.pairs);
    const rows = [];
    for (const beta of betas) {
      let tot = 0;
      for (let r = 0; r < reps; r++) tot += sirRun(g, beta, rng, gdef.immune).size;
      rows.push([beta, tot / reps / g.n]);
    }
    out[gdef.label] = rows;
    yield { label: gdef.label };
  }
  return out;
}

/** One SIR run: each newly infected node transmits to each susceptible neighbour with probability beta, once. */
export function sirRun(g, beta, rng, immune = null, seedNode = -1) {
  const { n, off, nbr } = g.csr();
  const state = new Uint8Array(n); // 0 S, 1 I, 2 R, 3 immune
  if (immune) for (const v of immune) state[v] = 3;
  let s = seedNode;
  if (s < 0) { let tries = 0; do { s = rng.int(n); } while (state[s] !== 0 && ++tries < 10 * n); }
  if (state[s] !== 0) return { size: 0, steps: 0 };
  state[s] = 1;
  let frontier = [s], size = 1, steps = 0;
  while (frontier.length) {
    const next = [];
    for (const u of frontier) {
      for (let j = off[u]; j < off[u + 1]; j++) {
        const v = nbr[j];
        if (state[v] === 0 && rng.random() < beta) { state[v] = 1; next.push(v); size++; }
      }
      state[u] = 2;
    }
    frontier = next;
    steps++;
  }
  return { size, steps };
}

/** Barabási–Albert degree statistics for a large network (Ch 5 preview). */
export function* baDegrees({ N, m, attachment = "preferential", seed = 2026 }) {
  const rng = new RNG(seed);
  const tracked = [10, 100, 1000].filter((t) => t < N);
  const traj = tracked.map(() => []);
  const g = G.barabasiAlbert(N, m, rng, {
    attachment,
    onNode: (gr, v) => {
      if (v % Math.max(1, Math.floor(N / 200)) === 0) tracked.forEach((t, i) => { if (t < v) traj[i].push([v, gr.degree(t)]); });
    },
  });
  yield { phase: "built" };
  const d = g.degrees();
  return { hist: S.histogram(d), kmax: S.arrMax(d), tracked, traj };
}

/** Self-loops and multi-links the configuration model creates, as a function of γ (Section 4.7). */
export function* multiLinkFraction({ N, kmin = 1, gammas, reps = 3, seed = 2026 }) {
  const rng = new RNG(seed);
  const rows = [];
  for (const gamma of gammas) {
    let f = 0, kmaxS = 0;
    for (let r = 0; r < reps; r++) {
      const seq = G.powerlawSequence(N, gamma, kmin, rng, 20 * N);
      const cm = G.configurationModel(seq, rng);
      f += (cm.selfLoops + cm.multiLinks) / (cm.raw.length / 2) / reps;
      kmaxS += S.arrMax(seq) / reps;
    }
    const row = { gamma, fraction: f, kmax: kmaxS };
    rows.push(row);
    yield row;
  }
  return rows;
}

/** Bootstrap goodness-of-fit p-value of the power-law fit of a degree histogram. */
export function* powerLawGoF({ hist, fit, reps = 200, seed = 2026, maxGamma = 10 }) {
  const rng = new RNG(seed);
  const best = fit || S.fitPowerLaw(hist, { maxGamma });
  const it = S.goodnessOfFit(hist, best, rng, { reps, maxGamma });
  let step = it.next();
  while (!step.done) { yield step.value; step = it.next(); }
  return { ...step.value, fit: { kmin: best.kmin, gamma: best.gamma, D: best.D, ntail: best.ntail } };
}

export const TASKS = { powerLawGoF,  distanceVsN, kmaxVsN, momentsVsN, estimatorTrials, giantVsK, giantScaling, wattsStrogatzSweep, randomize, sirSweep, baDegrees, multiLinkFraction };
