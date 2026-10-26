// Bootstrap goodness-of-fit p-values (Clauset, Shalizi & Newman 2009, step 2) for the eight networks,
// computed with the site's own implementation (site/js/lib/stats.js) and written to site/data/gof.json.
//   node tools/gof.mjs [replicates=1000]          (about 7 minutes; the WWW takes most of it)
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { TASKS } from "../site/js/lib/tasks.js";
import * as S from "../site/js/lib/stats.js";

const root = join(import.meta.dirname, "..");
const { networks } = JSON.parse(readFileSync(join(root, "site", "data", "networks.json"), "utf8"));
const reps = +process.argv[2] || 1000;
const out = {};
for (const name of ["metabolic", "protein", "powergrid", "collaboration", "phonecalls", "email", "internet", "www"]) {
  const t0 = Date.now();
  const fit = S.fitPowerLaw(networks[name].degreeHist);
  const it = TASKS.powerLawGoF({ hist: networks[name].degreeHist, fit, reps, seed: 7 });
  let s = it.next();
  while (!s.done) s = it.next();
  out[name] = { p: s.value.p, reps, kmin: fit.kmin, gamma: +fit.gamma.toFixed(4), D: +fit.D.toFixed(5) };
  console.log(name, JSON.stringify(out[name]), ((Date.now() - t0) / 1000).toFixed(1) + "s");
}
writeFileSync(join(root, "site", "data", "gof.json"), JSON.stringify(out, null, 1));
