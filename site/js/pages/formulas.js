import "../layout.js";
import { $, $$, h } from "../lib/ui.js";
import { GLOSSARY } from "../glossary.js";

// the glossary is the site-wide one, so this list and the dotted-underline definitions never disagree
$(".gloss").append(...[...GLOSSARY].sort((a, b) => a.term.localeCompare(b.term, "en", { sensitivity: "base" }))
  .flatMap((t) => [h("dt", { id: "term-" + t.term.toLowerCase().replace(/[^a-z0-9]+/g, "-") }, t.term), h("dd", {}, t.def)]));

// live filter over the formula cards and glossary entries
const input = $("#filter");
input.addEventListener("input", () => {
  const q = input.value.trim().toLowerCase();
  for (const el of $$(".formula, .gloss dt")) {
    const hit = !q || el.textContent.toLowerCase().includes(q) || (el.nextElementSibling && el.tagName === "DT" && el.nextElementSibling.textContent.toLowerCase().includes(q));
    el.style.display = hit ? "" : "none";
    if (el.tagName === "DT" && el.nextElementSibling) el.nextElementSibling.style.display = hit ? "" : "none";
  }
  const shown = $$(".formula").filter((f) => f.style.display !== "none").length;
  count.textContent = q ? `${shown} of ${total} formulas shown` : summary;
  for (const sec of $$(".formula-section")) sec.style.display = [...sec.querySelectorAll(".formula")].some((f) => f.style.display !== "none") ? "" : "none";
});
const count = document.getElementById("count"), total = $$(".formula").length;
const summary = `${total} formulas, ${$$(".gloss dt").length} terms`;
count.textContent = summary;
