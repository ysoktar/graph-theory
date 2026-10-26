import { REPO } from "../layout.js";
import { h, $, segmented, renderMath, dataTable } from "../lib/ui.js";
import { ERRATA, BOOK, SOFTWARE, VERIFIED, SEVERITY } from "../errata.js";

$("#md-link").href = `${REPO}/blob/main/notebook/ERRATA.md`;

const counts = Object.keys(SEVERITY).map((k) => [SEVERITY[k].label, SEVERITY[k].desc, ERRATA.filter((e) => e.severity === k).length]);
$("#summary").append(dataTable([{ label: "Severity", align: "left" }, { label: "Meaning", align: "left" }, { label: "Entries" }], counts));

const host = $("#errata");
let filter = "all";
function render() {
  host.replaceChildren();
  for (const e of ERRATA) {
    if (filter !== "all" && e.severity !== filter) continue;
    const loc = `cell ${e.cell}${e.run ? ` · code, In [${e.run}]` : ""}`;
    const card = h("div", { class: "callout fix errata-entry", id: e.id },
      h("div", { class: "callout-label" }, h("span", { class: "sev " + e.severity }, SEVERITY[e.severity].label), h("span", {}, `${e.id} · ${loc} · ${e.section}`)),
      h("div", { class: "fix-quote" }, ...e.quote.split("\n").flatMap((l, i) => (i ? [h("br"), l] : [l]))),
      h("p", {}, h("strong", {}, "Problem. "), e.issue),
      h("p", {}, h("strong", {}, "Correction. "), e.correction),
      h("p", { class: "small" }, h("strong", {}, "Evidence. "), e.evidence,
        e.page ? [" ", h("a", { href: e.page }, "See it on the site →")] : null));
    host.append(card);
  }
  renderMath(host);
}
segmented($("#filters"), {
  label: "Show", value: "all",
  options: [{ value: "all", label: `All (${ERRATA.length})` }, ...Object.entries(SEVERITY).map(([k, v]) => ({ value: k, label: `${v.label} (${ERRATA.filter((e) => e.severity === k).length})` }))],
  onChange: (v) => { filter = v; render(); },
});
render();
$("#verified").append(...VERIFIED.map((v) => h("li", {}, v)));
for (const [hostId, list] of [["#book", BOOK], ["#software", SOFTWARE]]) for (const e of list) {
  $(hostId).append(h("div", { class: "callout fix errata-entry", id: e.id },
    h("div", { class: "callout-label" }, h("span", { class: "sev " + e.severity }, SEVERITY[e.severity].label), h("span", {}, `${e.id} · ${e.location}`)),
    h("div", { class: "fix-quote" }, e.quote),
    h("p", {}, h("strong", {}, "Problem. "), e.issue),
    h("p", {}, h("strong", {}, "Correction. "), e.correction),
    h("p", { class: "small" }, h("strong", {}, "Evidence. "), e.evidence, e.page ? [" ", h("a", { href: e.page }, "See it on the site →")] : null)));
}
if (location.hash) requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView());
