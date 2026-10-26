// Deterministic validation of the exact discrete power-law sampler against the exact CDF.
// Instead of random draws, the sampler is fed M evenly spaced quantiles u_i = (i + ½)/M, so the
// generated distribution can be compared with the exact one without sampling noise:
// the maximal CDF error should be ≤ 1/M if the inversion is exact.
import { discretePowerLawSampler, hurwitzZeta } from "../../site/js/lib/stats.js";

const M = 200000;
const rows = [];
let worst = 0;
for (const table of [20000, 50]) { // table = 50 forces most of the mass through the tail approximation
  for (const gamma of [1.5, 2.1, 2.5, 3.0, 3.5]) {
    for (const kmin of [1, 2, 3, 4, 5, 6, 10, 20, 50, 100]) {
      const draw = discretePowerLawSampler(gamma, kmin, { table });
      const counts = new Map();
      for (let i = 0; i < M; i++) {
        const u = (i + 0.5) / M;
        const k = draw({ random: () => 1 - u }); // the sampler uses u = 1 − random()
        counts.set(k, (counts.get(k) || 0) + 1);
      }
      // compare CDFs on k = kmin … kmin + 5000
      const z0 = hurwitzZeta(gamma, kmin);
      let cum = 0, maxErr = 0, maxRel = 0;
      for (let k = kmin; k < kmin + 5000; k++) {
        cum += counts.get(k) || 0;
        const exact = 1 - hurwitzZeta(gamma, k + 1) / z0;
        maxErr = Math.max(maxErr, Math.abs(cum / M - exact));
        if (k < kmin + 5) { const pe = Math.pow(k, -gamma) / z0, pg = (counts.get(k) || 0) / M; maxRel = Math.max(maxRel, Math.abs(pg - pe) / pe); }
      }
      worst = Math.max(worst, table === 20000 ? maxErr : 0);
      rows.push({ table, gamma, kmin, maxCdfError: +maxErr.toExponential(2), maxRelErrFirst5: +maxRel.toExponential(2) });
    }
  }
}
console.table(rows.filter((r) => r.table === 20000));
console.log("tail-path stress test (table = 50): worst CDF error", Math.max(...rows.filter((r) => r.table === 50).map((r) => r.maxCdfError)).toExponential(2));
console.log(`worst CDF error with the default table: ${worst.toExponential(2)} (bound for exact inversion: 1/M = ${(1 / M).toExponential(2)})`);
