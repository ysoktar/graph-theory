// Calibration of the bootstrap goodness-of-fit test.
// Null: data sets drawn from the very model the test assumes (empirical body below kmin + exact power-law
// tail), shaped like the E. coli metabolic network (n = 1039, kmin = 5, γ = 2.714, tail share 0.621).
// A correct test gives p-values uniform on [0, 1]: about 10% of them below 0.1.
// Power: data whose tail is NOT a power law (power law with an exponential cutoff) should be rejected often.
import { readFileSync } from "node:fs";
const here = new URL(".", import.meta.url).pathname;
import * as S from "../../site/js/lib/stats.js";
import { RNG } from "../../site/js/lib/rng.js";

const { networks } = JSON.parse(readFileSync(here + "../../site/data/networks.json"));
const H = networks.metabolic.degreeHist;
const fit0 = S.fitPowerLaw(H);
const body = [];
H.k.forEach((k, i) => { if (k < fit0.kmin) for (let j = 0; j < H.count[i]; j++) body.push(k); });
const n = H.count.reduce((a, b) => a + b, 0), pTail = fit0.ntail / n;

function pValue(hist, rng, reps) {
  const f = S.fitPowerLaw(hist, { minTailCount: 10 });
  const it = S.goodnessOfFit(hist, f, rng, { reps });
  let s = it.next(); while (!s.done) s = it.next();
  return s.value.p;
}
function dataset(rng, tailDraw, size = n) {
  const m = new Map();
  for (let i = 0; i < size; i++) {
    const k = rng.random() < pTail ? tailDraw(rng) : body[rng.int(body.length)];
    m.set(k, (m.get(k) || 0) + 1);
  }
  const ks = [...m.keys()].sort((a, b) => a - b);
  return { k: ks, count: ks.map((k) => m.get(k)) };
}
const rng = new RNG(12345);
const DATASETS = +process.argv[2] || 200, REPS = +process.argv[3] || 100;

// null calibration
const plDraw = S.discretePowerLawSampler(fit0.gamma, fit0.kmin);
const ps = [];
const t0 = Date.now();
for (let d = 0; d < DATASETS; d++) ps.push(pValue(dataset(rng, plDraw), rng, REPS));
ps.sort((a, b) => a - b);
const below = (q) => ps.filter((p) => p < q).length / ps.length;
// KS distance of the p-values from Uniform(0,1)
let ks = 0; ps.forEach((p, i) => { ks = Math.max(ks, Math.abs((i + 1) / ps.length - p), Math.abs(i / ps.length - p)); });
console.log(`NULL (true power-law tail): ${DATASETS} data sets × ${REPS} bootstrap replicates, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
console.log(`  share p < 0.05: ${below(0.05).toFixed(3)}  (expected 0.05)`);
console.log(`  share p < 0.10: ${below(0.10).toFixed(3)}  (expected 0.10)`);
console.log(`  share p < 0.50: ${below(0.50).toFixed(3)}  (expected 0.50)`);
console.log(`  mean p: ${(ps.reduce((a, b) => a + b, 0) / ps.length).toFixed(3)}  (expected 0.5);  KS distance from uniform: ${ks.toFixed(3)} (5% critical value ≈ ${(1.36 / Math.sqrt(DATASETS)).toFixed(3)})`);

// power: tail = power law with exponential cutoff, p_k ∝ k^-γ e^{-k/κ}, by rejection from the power law
for (const kappa of [200, 50]) {
  const cutDraw = (r) => { for (;;) { const k = plDraw(r); if (r.random() < Math.exp(-(k - fit0.kmin) / kappa)) return k; } };
  for (const size of [1039, 10000]) {
    const p2 = [];
    const D = Math.max(20, DATASETS / 5);
    for (let d = 0; d < D; d++) p2.push(pValue(dataset(rng, cutDraw, size), rng, Math.min(REPS, 100)));
    console.log(`POWER (cutoff κ = ${kappa}, n = ${size}): rejected (p < 0.1) in ${(p2.filter((p) => p < 0.1).length / p2.length).toFixed(2)} of ${D} data sets`);
  }
}
