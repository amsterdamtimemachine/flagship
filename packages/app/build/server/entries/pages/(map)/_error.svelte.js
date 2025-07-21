import { G as escape_html, C as pop, A as push } from "../../../chunks/index3.js";
import "clsx";
import { p as page } from "../../../chunks/index4.js";
function _error($$payload, $$props) {
  push();
  $$payload.out += `<div class="error-container"><h1>Error ${escape_html(page.status)}</h1> <p>${escape_html(page.error?.message)}</p></div>`;
  pop();
}
export {
  _error as default
};
