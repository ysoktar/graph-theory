import "../layout.js";
import { $, $$ } from "../lib/ui.js";

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
