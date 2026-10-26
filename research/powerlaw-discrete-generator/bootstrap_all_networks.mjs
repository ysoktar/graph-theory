// Bootstrap goodness-of-fit p-values for the book's eight networks (Clauset–Shalizi–Newman, step 2).
//   node bootstrap_all_networks.mjs [replicates=1000]
import { readFileSync } from "node:fs";
import * as S from "../../site/js/lib/stats.js";
import { RNG } from "../../site/js/lib/rng.js";
const here = new URL(".", import.meta.url).pathname;
const nets = Object.fromEntries(Object.entries(JSON.parse(readFileSync(here + "../../site/data/networks.json")).networks).map(([k, v]) => [k, { ...v, powerlawPackageFit: v.powerlaw }]));
const reps = +process.argv[2] || 1000;
for (const [name, net] of Object.entries(nets)) {
  const fit = S.fitPowerLaw(net.degreeHist);
  const it = S.goodnessOfFit(net.degreeHist, fit, new RNG(7), { reps });
  let s = it.next(); while (!s.done) s = it.next();
  console.log(`${name.padEnd(14)} kmin=${String(fit.kmin).padStart(3)} gamma=${fit.gamma.toFixed(3)} D=${fit.D.toFixed(4)}  p=${s.value.p.toFixed(3)}  (${reps} replicates; powerlaw package: kmin=${net.powerlawPackageFit.kmin}, gamma=${net.powerlawPackageFit.gamma.toFixed(3)})`);
}
