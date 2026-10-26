// Why is the bootstrap conservative under the null? Three variants, each on null data sets.
//  A  full CSN (kmin re-estimated), no shortcut          (minTailCount = 0, as in the original method)
//  B  full CSN with the site's shortcut                   (minTailCount = 10)
//  C  kmin known and fixed, only gamma refitted           (classic parametric bootstrap)
//  D  pure power law, kmin = 1 known, no body             (simplest possible case)
import { readFileSync } from "node:fs";
const here = new URL(".", import.meta.url).pathname;
import * as S from "../../site/js/lib/stats.js";
import { RNG } from "../../site/js/lib/rng.js";

const { networks } = JSON.parse(readFileSync(here + "../../site/data/networks.json"));
const H = networks.metabolic.degreeHist;
const fit0 = S.fitPowerLaw(H);
const body0 = [];
H.k.forEach((k, i) => { if (k < fit0.kmin) for (let j = 0; j < H.count[i]; j++) body0.push(k); });
const n = H.count.reduce((a, b) => a + b, 0), pTail0 = fit0.ntail / n;
const toHist = (m) => { const ks = [...m.keys()].sort((a, b) => a - b); return { k: ks, count: ks.map((k) => m.get(k)) }; };

function draws(rng, size, pTail, tail, body) {
  const m = new Map();
  for (let i = 0; i < size; i++) {
    const k = rng.random() < pTail || !body.length ? tail(rng) : body[rng.int(body.length)];
    m.set(k, (m.get(k) || 0) + 1);
  }
  return toHist(m);
}
function pValue(h, rng, reps, { fixedKmin = null, minTailCount = 0 }) {
  const fit = S.fitPowerLaw(h, { kmin: fixedKmin, minTailCount });
  const body = [];
  h.k.forEach((k, i) => { if (k < fit.kmin) for (let j = 0; j < h.count[i]; j++) body.push(k); });
  const tot = h.count.reduce((a, b) => a + b, 0);
  const tail = S.discretePowerLawSampler(fit.gamma, fit.kmin);
  let exceed = 0;
  for (let r = 0; r < reps; r++) {
    const syn = draws(rng, tot, fit.ntail / tot, tail, body);
    const f2 = S.fitPowerLaw(syn, { kmin: fixedKmin, minTailCount });
    if (f2.D >= fit.D) exceed++;
  }
  return exceed / reps;
}
function summarise(label, ps) {
  ps.sort((a, b) => a - b);
  let ks = 0; ps.forEach((p, i) => { ks = Math.max(ks, Math.abs((i + 1) / ps.length - p), Math.abs(i / ps.length - p)); });
  const lt = (q) => (ps.filter((p) => p < q).length / ps.length).toFixed(3);
  console.log(`${label}: P(p<0.05)=${lt(0.05)} P(p<0.1)=${lt(0.1)} P(p<0.5)=${lt(0.5)} mean=${(ps.reduce((a, b) => a + b, 0) / ps.length).toFixed(3)} KS=${ks.toFixed(3)} (crit ${(1.36 / Math.sqrt(ps.length)).toFixed(3)})`);
}
const DS = +process.argv[2] || 200, REPS = +process.argv[3] || 100;
const rng = new RNG(777);
const tail0 = S.discretePowerLawSampler(fit0.gamma, fit0.kmin);
const variants = {
  "A full CSN, all kmin candidates": () => pValue(draws(rng, n, pTail0, tail0, body0), rng, REPS, {}),
  "B full CSN, candidates with ≥10 tail points": () => pValue(draws(rng, n, pTail0, tail0, body0), rng, REPS, { minTailCount: 10 }),
  "C kmin known (= 5), gamma refitted": () => pValue(draws(rng, n, pTail0, tail0, body0), rng, REPS, { fixedKmin: fit0.kmin }),
  "D pure power law, kmin = 1 known": () => { const t = S.discretePowerLawSampler(2.5, 1); return pValue(draws(rng, 1000, 1, t, []), rng, REPS, { fixedKmin: 1 }); },
};
for (const [label, fn] of Object.entries(variants)) {
  const t0 = Date.now();
  const ps = Array.from({ length: DS }, fn);
  summarise(`${label} [${DS}×${REPS}, ${((Date.now() - t0) / 1000).toFixed(0)}s]`, ps);
}
