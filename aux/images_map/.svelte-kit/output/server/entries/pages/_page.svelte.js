import { c as create_ssr_component, a as add_attribute, b as each, e as escape, d as add_styles, v as validate_component } from "../../chunks/ssr.js";
import "maplibre-gl";
import "mapbox-gl";
const MapAccessible = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let focusedCellData;
  let cells = [];
  let focusedCell = null;
  let gridElement;
  focusedCellData = null;
  return `  <div class="relative w-full h-full min-h-[500px] border border-gray-200 rounded-lg bg-red-500 background-red-500" role="grid" aria-label="Historical data heatmap"${add_attribute("this", gridElement, 0)}> <svg class="absolute inset-0 w-full h-full"><defs><pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse"><rect width="48" height="48" fill="none" stroke="#ddd" stroke-width="1"></rect></pattern></defs><rect width="100%" height="100%" fill="url(#grid)"></rect>${each(cells, (cell, i) => {
    return `<rect${add_attribute("x", cell.x, 0)}${add_attribute("y", cell.y, 0)} width="48" height="48" fill="${"rgb(0, 0, " + escape(Math.floor(cell.value * 255), true) + ")"}"${add_attribute("opacity", focusedCell === cell.id ? 0.8 : 0.6, 0)}></rect>`;
  })}</svg>  <div class="absolute inset-0 grid grid-cols-10 grid-rows-10 h-full" role="row">${each(cells, (cell, i) => {
    return `<button class="relative focus:outline-none focus:ring-2 focus:ring-blue-500 focus:z-10 w-full h-full" aria-label="${"Grid cell " + escape(i + 1, true) + " with " + escape(Math.floor(cell.value * 100), true) + "% data density"}" tabindex="0"${add_styles({
      "grid-column": i % 10 + 1,
      "grid-row": Math.floor(i / 10) + 1
    })}><span class="sr-only">Contains ${escape(cell.dataPoints)} historical records</span> </button>`;
  })}</div>  ${focusedCellData ? `<div role="tooltip" class="absolute p-4 bg-white shadow-lg rounded-lg z-20" style="${"left: " + escape(focusedCellData.x, true) + "px; top: " + escape(focusedCellData.y, true) + "px"}"><h3 class="font-bold text-sm" data-svelte-h="svelte-151jn40">Cell Details</h3> <p class="text-sm">Data density: ${escape(Math.floor(focusedCellData.value * 100))}%
        <br>
        Records: ${escape(focusedCellData.dataPoints)}</p></div>` : ``}</div>`;
});
const Page = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { data } = $$props;
  if ($$props.data === void 0 && $$bindings.data && data !== void 0) $$bindings.data(data);
  return `<div>${validate_component(MapAccessible, "MapAccessible").$$render($$result, {}, {}, {})}</div>`;
});
export {
  Page as default
};
