// Placeholder for a page that is still being written: shows its place in the site and what it will cover.
import { pageInfo } from "../layout.js";
import { h } from "../lib/ui.js";

const info = pageInfo(document.body.dataset.page);
document.querySelector(".content").append(
  h("h1", {}, info.title),
  h("p", { class: "lead" }, info.desc),
  h("div", { class: "callout note" }, h("p", {}, "This page is still being written. ",
    info.book ? `It will cover Section ${info.book} of the book` : "It is part of the site's tools",
    info.nb ? ` and part ${info.nb} of the class notebook.` : ".")),
);
