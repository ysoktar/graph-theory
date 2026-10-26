// The worker tasks run in Node too; check they produce sensible numbers.
import { test } from "node:test";
import assert from "node:assert/strict";
import { close } from "./helpers.mjs";
import { TASKS } from "../site/js/lib/tasks.js";
import { giantComponentFraction } from "../site/js/lib/stats.js";

const drain = (it) => { let s = it.next(); const prog = []; while (!s.done) { prog.push(s.value); s = it.next(); } return { value: s.value, prog }; };

test("ER giant component follows S = 1 − exp(−⟨k⟩S)", () => {
  const { value } = drain(TASKS.giantVsK({ N: 20000, kMax: 4, points: 8 }));
  for (const row of value) if (row.k >= 1.5) close(row.S1, giantComponentFraction(row.k), 0.02, `S(${row.k})`);
  assert.ok(value[0].S1 <= 1 / 20000 + 1e-12);
});

test("distances grow like ln N for ER and are shorter for heavy tails", () => {
  const { value } = drain(TASKS.distanceVsN({
    models: [{ label: "pl", kind: "pl", gamma: 2.5, kmin: 2 }, { label: "er", kind: "er", avgk: 3 }, { label: "erm", kind: "er", matchTo: "pl" }],
    Ns: [1000, 8000], reps: 1, sources: 40,
  }));
  const get = (l, N) => value.find((r) => r.label === l && r.N === N);
  assert.ok(get("er", 8000).d > get("er", 1000).d + 1);
  assert.ok(get("pl", 8000).d < get("er", 8000).d);
  close(get("erm", 8000).avgk, get("pl", 8000).avgk, 0.3, "matched <k>");
});

test("k_max of a power law outgrows the exponential", () => {
  const { value } = drain(TASKS.kmaxVsN({ gamma: 2.5, Ns: [100, 100000], reps: 9 }));
  assert.ok(value[1].pl / value[0].pl > 50);
  assert.ok(value[1].exp - value[0].exp < 15);
});

test("estimators: exact MLE is unbiased, linear-bin least squares is not", () => {
  const { value } = drain(TASKS.estimatorTrials({ gamma: 2.5, n: 5000, trials: 20 }));
  const m = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  close(m(value.mle), 2.5, 0.03, "MLE");
  assert.ok(m(value.lsLinear) < 2.1);
});

test("degree-preserving randomisation keeps degrees and kills clustering", () => {
  const pairs = [];
  // a ring of 60 triangles linked in a chain: high clustering
  for (let t = 0; t < 60; t++) { const a = 3 * t; pairs.push(a, a + 1, a + 1, a + 2, a, a + 2); if (t) pairs.push(a - 1, a); }
  const { value } = drain(TASKS.randomize({ n: 180, pairs: Int32Array.from(pairs), factor: 5, sources: 20 }));
  assert.ok(value.degreesPreserved);
  assert.ok(value.after.C < value.before.C / 2);
});

test("SIR outbreak grows with transmissibility", () => {
  const pairs = [];
  for (let i = 0; i < 2000; i++) pairs.push(i, (i + 1) % 2000, i, (i + 7) % 2000);
  const { value } = drain(TASKS.sirSweep({ graphs: [{ label: "g", n: 2000, pairs: Int32Array.from(pairs) }], betas: [0.05, 0.9], reps: 10 }));
  assert.ok(value.g[1][1] > value.g[0][1]);
});
