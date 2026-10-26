// Statistics checked against SciPy and against the powerlaw package's fits of the book's data.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ref, close, readJSON } from "./helpers.mjs";
import * as S from "../site/js/lib/stats.js";
import { RNG } from "../site/js/lib/rng.js";

const R = ref.stats;

test("Poisson and binomial laws match SciPy", () => {
  for (const [k, lam, p] of R.poissonPmf) close(S.poissonPmf(k, lam), p, 1e-12 + 1e-9 * p, `pmf(${k})`);
  for (const [k, lam, p] of R.poissonSf) close(S.poissonSf(k, lam) / p, 1, 1e-6, `sf(${k})`);
  for (const [q, lam, k] of R.poissonIsf) assert.equal(S.poissonIsf(q, lam), k);
  for (const [k, n, p, v] of R.binomPmf) close(S.binomPmf(k, n, p) / v, 1, 1e-8, `binom(${k})`);
});

test("Hurwitz zeta matches SciPy", () => {
  for (const [s, q, v] of R.hurwitz) close(S.hurwitzZeta(s, q) / v, 1, 1e-11, `zeta(${s}, ${q})`);
});

test("erfc keeps relative precision in the tail", () => {
  close(S.erfc(0), 1, 1e-7);
  close(S.erfc(5) / 1.5374597944280349e-12, 1, 1e-6);
  close(S.normalCdf(1.96), 0.9750021048517795, 1e-7);
});

test("log-binning reproduces the notebook's pk_logbinned on a simple case", () => {
  const h = { k: [1, 2, 3, 4, 10, 20, 100], count: [50, 20, 10, 8, 4, 2, 1] };
  const lb = S.pkLogBinned(h, 6);
  let mass = 0;
  for (const [, p, info] of lb) mass += p * (info.hi - info.lo + 1);
  close(mass, 1, 1e-12, "normalised");
  const cc = S.ccdf(h);
  assert.equal(cc[0][1], 1);
  close(cc[cc.length - 1][1], 1 / 95, 1e-12);
});

test("exact discrete power-law sampler: right p_k and the MLE recovers γ", () => {
  const rng = new RNG(2026);
  for (const [gamma, kmin] of [[2.5, 1], [2.1, 1], [3.5, 2]]) {
    const x = S.samplePowerLaw(40000, gamma, kmin, rng);
    const h = S.histogram(x);
    close(h.count[0] / 40000, Math.pow(kmin, -gamma) / S.hurwitzZeta(gamma, kmin), 0.008, `p(kmin) γ=${gamma}`);
    close(S.powerLawMLE(h, kmin).gamma, gamma, 0.03, `MLE γ=${gamma}`);
  }
  const h = S.histogram(S.samplePowerLaw(40000, 2.5, 1, rng));
  close(S.powerLawClosedForm(S.histTail(h, 6), 6), 2.5, 0.12, "closed form on k ≥ 6");
});

test("the notebook's rounding sampler is biased at small k_min (verified against powerlaw in Python)", () => {
  const rng = new RNG(1);
  const h = S.histogram(S.samplePowerLaw(200000, 2.5, 1, rng, { method: "round" }));
  close(S.powerLawMLE(h, 1).gamma, 2.759, 0.02, "biased MLE");
  close(h.count[0] / 200000, 0.808, 0.004, "P(k=1)");
});

test("CSN fit matches powerlaw on the book's networks", () => {
  const { networks } = readJSON("site", "data", "networks.json");
  for (const name of ["internet", "collaboration", "protein", "metabolic", "powergrid", "phonecalls", "email", "www"]) {
    const pl = networks[name].powerlaw;
    const fit = S.fitPowerLaw(networks[name].degreeHist);
    assert.equal(fit.kmin, pl.kmin, `${name} kmin`);
    close(fit.gamma, pl.gamma, 0.01, `${name} gamma`);
    close(fit.D, pl.D, 0.003, `${name} D`);
  }
});

test("k_min scan for the Internet matches powerlaw", () => {
  const { networks } = readJSON("site", "data", "networks.json");
  const { scan } = networks.internet.powerlaw;
  const fit = S.fitPowerLaw(networks.internet.degreeHist, { maxCandidates: 80 });
  for (let i = 0; i < 40; i++) {
    close(fit.scan[i].gamma, scan.gamma[i], 0.01, `gamma at kmin=${scan.kmin[i]}`);
    close(fit.scan[i].D, scan.D[i], 0.003, `D at kmin=${scan.kmin[i]}`);
  }
});

test("likelihood ratio vs exponential agrees in sign and significance", () => {
  const { networks } = readJSON("site", "data", "networks.json");
  for (const name of ["internet", "email", "www", "powergrid"]) {
    const pl = networks[name].powerlaw;
    const tail = S.histTail(networks[name].degreeHist, pl.kmin);
    const c = S.compareWithExponential(tail, pl.kmin, pl.gamma);
    close(c.R, pl.compare.exponential.R, 0.35, `${name} R`);
    assert.equal(c.p < 0.1, pl.compare.exponential.p < 0.1, `${name} significance`);
  }
});

test("giant component fixed point", () => {
  assert.equal(S.giantComponentFraction(0.5), 0);
  close(S.giantComponentFraction(2), 0.7968121300200199, 1e-10);
  const S3 = S.giantComponentFraction(3);
  close(S3, 1 - Math.exp(-3 * S3), 1e-12);
});

test("RNG samplers have the right means", () => {
  const rng = new RNG(11);
  let s = 0;
  for (let i = 0; i < 20000; i++) s += rng.poisson(4.2);
  close(s / 20000, 4.2, 0.06, "Poisson small");
  s = 0;
  for (let i = 0; i < 20000; i++) s += rng.poisson(40);
  close(s / 20000, 40, 0.25, "Poisson large");
  s = 0;
  for (let i = 0; i < 5000; i++) s += rng.binomial(19900, 0.05);
  close(s / 5000, 995, 2, "binomial");
  assert.equal(new Set(rng.sample(100, 30)).size, 30);
});
