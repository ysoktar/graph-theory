import "../layout.js";
import { $, $$, h } from "../lib/ui.js";

// live filter over the formula cards and glossary entries
const input = $("#filter");
input.addEventListener("input", () => {
  const q = input.value.trim().toLowerCase();
  for (const el of $$(".formula, .gloss dt")) {
    const hit = !q || el.textContent.toLowerCase().includes(q) || (el.nextElementSibling && el.tagName === "DT" && el.nextElementSibling.textContent.toLowerCase().includes(q));
    el.style.display = hit ? "" : "none";
    if (el.tagName === "DT" && el.nextElementSibling) el.nextElementSibling.style.display = hit ? "" : "none";
  }
  for (const sec of $$(".formula-section")) sec.style.display = [...sec.querySelectorAll(".formula")].some((f) => f.style.display !== "none") ? "" : "none";
});
document.getElementById("count").append(h("span", {}, `${$$(".formula").length} formulas, ${$$(".gloss dt").length} terms`));
