import "../layout.js";
import { h, dataTable } from "../lib/ui.js";
import { fmt, poissonIsf } from "../lib/stats.js";
import { loadNetworks, loadJSON, NETWORK_ORDER } from "../lib/data.js";

const yes = (ok, text) => h("span", { class: "verdict " + (ok ? "ok" : "no") }, text);

(async () => {
  const [{ networks }, gof] = await Promise.all([loadNetworks(), loadJSON("data/gof.json")]);
  const rows = NETWORK_ORDER.map((n) => {
    const d = networks[n], r = d.sigmak / Math.sqrt(d.avgk), kp = poissonIsf(1 / d.N, d.avgk), dr = d.distances.avg / d.nullModels.er.avgd;
    return [d.description, yes(r > 2, `${r.toFixed(1)}×`), `${fmt.int(d.kmax)} (random ${fmt.int(kp)})`, yes(dr < 1.5, `${d.distances.avg.toFixed(1)} (random ${d.nullModels.er.avgd.toFixed(1)})`),
      yes(d.clustering.avg / d.nullModels.er.C > 10, `${fmt.int(d.clustering.avg / d.nullModels.er.C)}×`), d.powerlaw.gamma.toFixed(2), yes(gof[n].p >= 0.1, gof[n].p.toFixed(2))];
  });
  document.getElementById("tbl-measured").append(dataTable([
    { label: "Network", align: "left" }, { label: "σₖ / √⟨k⟩ (heavy tail: > 2)", align: "left" }, { label: "k_max", align: "left" },
    { label: "⟨d⟩ (small world)", align: "left" }, { label: "⟨C⟩ / random", align: "left" }, { label: "γ̂" }, { label: "power law plausible (p)", align: "left" },
  ], rows));
})();
