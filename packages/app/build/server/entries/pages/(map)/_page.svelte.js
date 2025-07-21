import "clsx";
import { J as attr_class, F as clsx, C as pop, A as push, K as ensure_array_like, M as attr, G as escape_html, N as stringify, O as attr_style, E as spread_attributes, P as store_get, Q as unsubscribe_stores } from "../../../chunks/index3.js";
import "../../../chunks/client.js";
import debounce from "lodash.debounce";
import { c as createPageErrorData } from "../../../chunks/error.js";
import { w as withGet, i as isBrowser, a as isHTMLElement, t as toWritableStores, b as omit, c as makeElement, d as createElHelpers, e as disabledAttr, f as executeCallbacks, g as addMeltEventListener, n as noop, k as kbd, o as onDestroy, m as mergeCss, h as formatDate } from "../../../chunks/utils.js";
import "maplibre-gl";
import "dequal";
import { d as derived, w as writable } from "../../../chunks/index2.js";
import "../../../chunks/index.js";
function getElemDirection(elem) {
  const style = window.getComputedStyle(elem);
  const direction = style.getPropertyValue("direction");
  return direction;
}
const overridable = (_store, onChange) => {
  const store = withGet(_store);
  const update = (updater, sideEffect) => {
    store.update((curr) => {
      const next = updater(curr);
      let res = next;
      if (onChange) {
        res = onChange({ curr, next });
      }
      sideEffect?.(res);
      return res;
    });
  };
  const set = (curr) => {
    update(() => curr);
  };
  return {
    ...store,
    update,
    set
  };
};
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function handleRovingFocus(nextElement) {
  if (!isBrowser)
    return;
  sleep(1).then(() => {
    const currentFocusedElement = document.activeElement;
    if (!isHTMLElement(currentFocusedElement) || currentFocusedElement === nextElement)
      return;
    currentFocusedElement.tabIndex = -1;
    if (nextElement) {
      nextElement.tabIndex = 0;
      nextElement.focus();
    }
  });
}
const defaults = {
  type: "single",
  orientation: "horizontal",
  loop: true,
  rovingFocus: true,
  disabled: false,
  defaultValue: ""
};
const { name, selector } = createElHelpers("toggle-group");
const createToggleGroup = (props) => {
  const withDefaults = { ...defaults, ...props };
  const options = toWritableStores(omit(withDefaults, "value"));
  const { type, orientation, loop, rovingFocus, disabled } = options;
  const defaultValue = withDefaults.defaultValue ? withDefaults.defaultValue : withDefaults.type === "single" ? void 0 : [];
  const valueWritable = withDefaults.value ?? writable(defaultValue);
  const value = overridable(valueWritable, withDefaults?.onValueChange);
  const root = makeElement(name(), {
    stores: orientation,
    returned: ($orientation) => {
      return {
        role: "group",
        "data-orientation": $orientation
      };
    }
  });
  const item = makeElement(name("item"), {
    stores: [value, disabled, orientation, type],
    returned: ([$value, $disabled, $orientation, $type]) => {
      return (props2) => {
        const itemValue = typeof props2 === "string" ? props2 : props2.value;
        const argDisabled = typeof props2 === "string" ? false : !!props2.disabled;
        const disabled2 = $disabled || argDisabled;
        const pressed = Array.isArray($value) ? $value.includes(itemValue) : $value === itemValue;
        const isSingle = $type === "single";
        const isMultiple = $type === "multiple" || $type === void 0;
        return {
          disabled: disabledAttr(disabled2),
          pressed,
          "data-orientation": $orientation,
          "data-disabled": disabledAttr(disabled2),
          "data-state": pressed ? "on" : "off",
          "data-value": itemValue,
          "aria-pressed": isMultiple ? pressed : void 0,
          "aria-checked": isSingle ? pressed : void 0,
          type: "button",
          role: isSingle ? "radio" : void 0,
          tabindex: pressed ? 0 : -1
        };
      };
    },
    action: (node) => {
      let unsub = noop;
      const parentGroup = node.closest(selector());
      if (!isHTMLElement(parentGroup))
        return {};
      const items = Array.from(parentGroup.querySelectorAll(selector("item")));
      const $value = value.get();
      const anyPressed = Array.isArray($value) ? $value.length > 0 : $value ? true : false;
      if (!anyPressed && items[0] === node) {
        node.tabIndex = 0;
      }
      function getNodeProps() {
        const itemValue = node.dataset.value;
        const disabled2 = node.dataset.disabled === "true";
        return { value: itemValue, disabled: disabled2 };
      }
      function handleValueUpdate() {
        const { value: itemValue, disabled: disabled2 } = getNodeProps();
        if (itemValue === void 0 || disabled2)
          return;
        value.update(($value2) => {
          if (Array.isArray($value2)) {
            if ($value2.includes(itemValue)) {
              return $value2.filter((i) => i !== itemValue);
            }
            return [...$value2, itemValue];
          }
          return $value2 === itemValue ? void 0 : itemValue;
        });
      }
      unsub = executeCallbacks(addMeltEventListener(node, "click", () => {
        handleValueUpdate();
      }), addMeltEventListener(node, "keydown", (e) => {
        if (e.key === kbd.SPACE || e.key === kbd.ENTER) {
          e.preventDefault();
          handleValueUpdate();
          return;
        }
        if (!rovingFocus.get())
          return;
        const el = e.currentTarget;
        if (!isHTMLElement(el))
          return;
        const root2 = el.closest(selector());
        if (!isHTMLElement(root2))
          return;
        const items2 = Array.from(root2.querySelectorAll(selector("item") + ":not([data-disabled])")).filter((item2) => isHTMLElement(item2));
        const currentIndex = items2.indexOf(el);
        const dir = getElemDirection(el);
        const $orientation = orientation.get();
        const nextKey = {
          horizontal: dir === "rtl" ? kbd.ARROW_LEFT : kbd.ARROW_RIGHT,
          vertical: kbd.ARROW_DOWN
        }[$orientation ?? "horizontal"];
        const prevKey = {
          horizontal: dir === "rtl" ? kbd.ARROW_RIGHT : kbd.ARROW_LEFT,
          vertical: kbd.ARROW_UP
        }[$orientation ?? "horizontal"];
        const $loop = loop.get();
        if (e.key === nextKey) {
          e.preventDefault();
          const nextIndex = currentIndex + 1;
          if (nextIndex >= items2.length && $loop) {
            handleRovingFocus(items2[0]);
          } else {
            handleRovingFocus(items2[nextIndex]);
          }
        } else if (e.key === prevKey) {
          e.preventDefault();
          const prevIndex = currentIndex - 1;
          if (prevIndex < 0 && $loop) {
            handleRovingFocus(items2[items2.length - 1]);
          } else {
            handleRovingFocus(items2[prevIndex]);
          }
        } else if (e.key === kbd.HOME) {
          e.preventDefault();
          handleRovingFocus(items2[0]);
        } else if (e.key === kbd.END) {
          e.preventDefault();
          handleRovingFocus(items2[items2.length - 1]);
        }
      }));
      return {
        destroy: unsub
      };
    }
  });
  const isPressed = derived(value, ($value) => {
    return (itemValue) => {
      return Array.isArray($value) ? $value.includes(itemValue) : $value === itemValue;
    };
  });
  return {
    elements: {
      root,
      item
    },
    states: {
      value
    },
    helpers: {
      isPressed
    },
    options
  };
};
function createMapController() {
  let currentPeriod = "";
  let selectedCellId = null;
  let selectedCellBounds = null;
  let errors = [];
  let onCellSelected = null;
  function initialize(serverPeriod) {
    currentPeriod = serverPeriod;
  }
  function setPeriod(newPeriod) {
    currentPeriod = newPeriod;
  }
  function setRecordType(newRecordTypes) {
    return;
  }
  function syncUrlParameters(serverPeriod) {
    return;
  }
  function selectCell(cellId, bounds) {
    selectedCellId = cellId;
    selectedCellBounds = bounds || null;
    if (onCellSelected) {
      onCellSelected(cellId, bounds);
    }
  }
  function clearErrors() {
    errors = [];
  }
  return {
    get currentPeriod() {
      return currentPeriod;
    },
    get selectedCellId() {
      return selectedCellId;
    },
    get selectedCellBounds() {
      return selectedCellBounds;
    },
    get showCellModal() {
      return !!selectedCellId;
    },
    get errors() {
      return errors;
    },
    // Control methods
    initialize,
    setPeriod,
    setRecordType,
    syncUrlParameters,
    selectCell,
    clearErrors,
    set onCellSelected(callback) {
      onCellSelected = callback;
    }
  };
}
function mergeHeatmaps(heatmaps, blueprint) {
  const validHeatmaps = heatmaps.filter(
    (heatmap) => heatmap && heatmap.countArray && heatmap.densityArray && heatmap.countArray.length > 0
  );
  if (validHeatmaps.length === 0) {
    let gridSize2 = 0;
    if (blueprint) {
      if (blueprint.rows > 0 && blueprint.cols > 0) {
        gridSize2 = blueprint.rows * blueprint.cols;
      } else if (Array.isArray(blueprint) || typeof blueprint === "object" && Object.keys(blueprint).length > 0) {
        gridSize2 = Array.isArray(blueprint) ? blueprint.length : Object.keys(blueprint).length;
      }
    }
    return {
      densityArray: new Array(gridSize2).fill(0),
      countArray: new Array(gridSize2).fill(0)
    };
  }
  if (validHeatmaps.length === 1) {
    return validHeatmaps[0];
  }
  const gridSize = validHeatmaps[0].countArray.length;
  for (let i = 1; i < validHeatmaps.length; i++) {
    if (validHeatmaps[i].countArray.length !== gridSize) {
      throw new Error(`Heatmap grid size mismatch: expected ${gridSize}, got ${validHeatmaps[i].countArray.length}`);
    }
    if (validHeatmaps[i].densityArray.length !== gridSize) {
      throw new Error(`Heatmap grid size mismatch: expected ${gridSize}, got ${validHeatmaps[i].densityArray.length}`);
    }
  }
  const mergedCounts = new Array(gridSize).fill(0);
  const mergedDensity = new Array(gridSize).fill(0);
  for (let cellIndex = 0; cellIndex < gridSize; cellIndex++) {
    let totalCount = 0;
    for (const heatmap of validHeatmaps) {
      totalCount += heatmap.countArray[cellIndex];
    }
    mergedCounts[cellIndex] = totalCount;
  }
  const maxCount = Math.max(...mergedCounts);
  if (maxCount > 0) {
    const maxTransformed = Math.log(maxCount + 1);
    for (let cellIndex = 0; cellIndex < gridSize; cellIndex++) {
      mergedDensity[cellIndex] = mergedCounts[cellIndex] > 0 ? Math.log(mergedCounts[cellIndex] + 1) / maxTransformed : 0;
    }
  } else {
    for (let cellIndex = 0; cellIndex < gridSize; cellIndex++) {
      mergedDensity[cellIndex] = 0;
    }
  }
  const result = {
    densityArray: mergedDensity,
    countArray: mergedCounts
  };
  return result;
}
function mergeHeatmapTimeline(timeline, recordTypes, selectedTag, blueprint) {
  const mergedTimeline = {};
  for (const [timeSliceKey, timeSliceData] of Object.entries(timeline)) {
    const heatmapsToMerge = [];
    for (const recordType of recordTypes) {
      const recordTypeData = timeSliceData[recordType];
      if (recordTypeData) {
        if (selectedTag && recordTypeData.tags[selectedTag]) {
          heatmapsToMerge.push(recordTypeData.tags[selectedTag]);
        } else if (recordTypeData.base) {
          heatmapsToMerge.push(recordTypeData.base);
        }
      }
    }
    if (heatmapsToMerge.length > 0) {
      const mergedHeatmap = mergeHeatmaps(heatmapsToMerge, blueprint);
      const combinedRecordType = recordTypes.sort().join("+");
      mergedTimeline[timeSliceKey] = {
        [combinedRecordType]: {
          base: mergedHeatmap,
          tags: selectedTag ? { [selectedTag]: mergedHeatmap } : {}
        }
      };
    }
  }
  return mergedTimeline;
}
function Map_1($$payload, $$props) {
  push();
  let {
    heatmap,
    heatmapBlueprint,
    dimensions,
    selectedCellId = null,
    class: className,
    handleCellClick,
    handleMapLoaded
  } = $$props;
  (() => {
    const idMap = /* @__PURE__ */ new Map();
    if (!heatmapBlueprint || !dimensions) {
      return idMap;
    }
    heatmapBlueprint.forEach((cell) => {
      const index = cell.row * dimensions.colsAmount + cell.col;
      idMap.set(index, cell.cellId);
    });
    return idMap;
  })();
  onDestroy(() => {
  });
  $$payload.out += `<div${attr_class(clsx(mergeCss("h-full w-full", className)))}><div class="h-full w-full"></div></div>`;
  pop();
}
function TimePeriodSelectorChart($$payload, $$props) {
  push();
  let { bins, maxCount, timelineHeight } = $$props;
  function getBarHeight(count, maxCount2, minHeight = 2) {
    if (count === 0 || maxCount2 === 0) return 0;
    const normalizedHeight = count / maxCount2 * 40;
    return Math.max(normalizedHeight, minHeight);
  }
  const each_array = ensure_array_like(bins);
  const each_array_1 = ensure_array_like(Array(bins.length + 1));
  $$payload.out += `<svg class="absolute inset-x-0 top-0 w-full h-full pointer-events-none"><!--[-->`;
  for (let i = 0, $$length = each_array.length; i < $$length; i++) {
    let bin = each_array[i];
    const barWidth = 100 / bins.length;
    const barHeight = getBarHeight(bin.count, maxCount);
    const x = i / bins.length * 100;
    $$payload.out += `<rect${attr("x", `${stringify(x)}%`)}${attr("y", timelineHeight - barHeight)}${attr("width", `${stringify(barWidth)}%`)}${attr("height", barHeight)} fill="#60a5fa" class="transition-colors duration-200"><title>Period: ${escape_html(bin.timeSlice.label)}, Count: ${escape_html(bin.count)}</title></rect>`;
  }
  $$payload.out += `<!--]--><!--[-->`;
  for (let i = 0, $$length = each_array_1.length; i < $$length; i++) {
    each_array_1[i];
    const position = i / bins.length * 100;
    $$payload.out += `<line${attr("x1", `${stringify(position)}%`)} y1="0"${attr("x2", `${stringify(position)}%`)}${attr("y2", timelineHeight)} stroke="black" stroke-width="1"${attr("transform", i === 0 ? "translate(0.5, 0)" : i === bins.length ? "translate(-0.5, 0)" : "")}></line>`;
  }
  $$payload.out += `<!--]--><line x1="0%"${attr("y1", timelineHeight)} x2="100%"${attr("y2", timelineHeight)} stroke="black" stroke-width="1"></line></svg>`;
  pop();
}
function TimePeriodSelectorLabels($$payload, $$props) {
  push();
  let { displayPeriods, timelineHeight } = $$props;
  const each_array = ensure_array_like(displayPeriods);
  $$payload.out += `<svg class="absolute inset-x-0 top-0 w-full h-full pointer-events-none"><!--[-->`;
  for (let i = 0, $$length = each_array.length; i < $$length; i++) {
    let period = each_array[i];
    const position = i / (displayPeriods.length - 1) * 100;
    $$payload.out += `<text${attr("x", `${stringify(position)}%`)}${attr("y", timelineHeight + 24)} font-size="16" fill="black"${attr("text-anchor", i === 0 ? "start" : i === displayPeriods.length - 1 ? "end" : "middle")} class="font-sans">${escape_html(period)}</text>`;
  }
  $$payload.out += `<!--]--></svg>`;
  pop();
}
function TimePeriodSelectorThumb($$payload, $$props) {
  push();
  let {
    currentIndex,
    totalBins,
    isDragging,
    onDragStart,
    timelineHeight,
    bins
  } = $$props;
  const thumbPosition = () => {
    if (totalBins <= 1) return 0;
    return currentIndex / totalBins * 100;
  };
  const thumbWidth = () => {
    if (totalBins <= 1) return 100;
    return 100 / totalBins;
  };
  const currentBin = () => bins[currentIndex];
  $$payload.out += `<div${attr_class("absolute z-10 cursor-grab bg-transparent border-2 border-red-500 rounded hover:bg-red-400/20 transition-colors duration-200", void 0, { "cursor-grabbing": isDragging })}${attr_style(`left: ${stringify(thumbPosition())}%; width: ${stringify(thumbWidth())}%; height: ${stringify(timelineHeight)}px; top: 0;`)} role="button" aria-label="Drag to change time period"${attr("title", `Current period: ${stringify(currentBin?.timeSlice?.label || "")}`)}></div>`;
  pop();
}
function TimePeriodSelectorTrack($$payload, $$props) {
  push();
  let {
    bins,
    currentIndex,
    onIndexChange,
    timelineHeight,
    onKeyDown
  } = $$props;
  const each_array = ensure_array_like(bins);
  $$payload.out += `<div class="absolute inset-x-0 cursor-pointer"${attr_style(`top: 0; height: ${stringify(timelineHeight)}px;`)} role="slider" tabindex="0" aria-label="Time period selector" aria-valuemin="0"${attr("aria-valuemax", bins.length - 1)}${attr("aria-valuenow", currentIndex)}${attr("aria-valuetext", bins[currentIndex]?.timeSlice?.label || "")}><!--[-->`;
  for (let i = 0, $$length = each_array.length; i < $$length; i++) {
    let bin = each_array[i];
    const barWidth = 100 / bins.length;
    const x = i / bins.length * 100;
    $$payload.out += `<button class="absolute h-full bg-transparent hover:bg-blue-200/30 transition-colors duration-200 cursor-pointer"${attr_style(`left: ${stringify(x)}%; width: ${stringify(barWidth)}%;`)}${attr("aria-label", `Select period ${stringify(bin.timeSlice.label)}`)}${attr("title", `Period: ${stringify(bin.timeSlice.label)}, Count: ${stringify(bin.count)}`)}></button>`;
  }
  $$payload.out += `<!--]--></div>`;
  pop();
}
function TimePeriodSelector($$payload, $$props) {
  push();
  let {
    histogram,
    period = void 0,
    onPeriodChange = void 0
  } = $$props;
  const timePeriods = histogram?.bins?.map((bin) => bin.timeSlice.key) || [];
  const displayPeriods = createDisplayPeriods(histogram?.bins || []);
  const timelineHeight = 26;
  let currentIndex = getInitialIndex();
  let isDragging = false;
  function createDisplayPeriods(bins) {
    if (!bins.length) return [];
    const result = bins.map((bin) => {
      return bin.timeSlice.startYear.toString();
    });
    const lastBin = bins[bins.length - 1];
    if (lastBin?.timeSlice?.endYear) {
      result.push(lastBin.timeSlice.endYear.toString());
    }
    return result;
  }
  function getInitialIndex() {
    if (!period || !timePeriods.length) return 0;
    const index = timePeriods.indexOf(period);
    return index >= 0 ? index : 0;
  }
  function handleIndexChange(newIndex) {
    if (newIndex >= 0 && newIndex < timePeriods.length && onPeriodChange) {
      currentIndex = newIndex;
      const periodValue = timePeriods[newIndex];
      onPeriodChange(periodValue);
    }
  }
  function handleDragStart(event) {
    isDragging = true;
    event.preventDefault();
  }
  function handleKeyDown(event) {
    let newIndex = currentIndex;
    switch (event.key) {
      case "ArrowLeft":
      case "ArrowDown":
        newIndex = Math.max(0, currentIndex - 1);
        break;
      case "ArrowRight":
      case "ArrowUp":
        newIndex = Math.min(timePeriods.length - 1, currentIndex + 1);
        break;
      case "Home":
        newIndex = 0;
        break;
      case "End":
        newIndex = timePeriods.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    handleIndexChange(newIndex);
  }
  if (histogram?.bins?.length > 0) {
    $$payload.out += "<!--[-->";
    $$payload.out += `<div class="w-full px-4 pb-1 pt-4"><div class="w-full relative h-[60px]">`;
    TimePeriodSelectorChart($$payload, {
      bins: histogram.bins,
      maxCount: histogram.maxCount,
      timelineHeight
    });
    $$payload.out += `<!----> `;
    TimePeriodSelectorLabels($$payload, { displayPeriods, timelineHeight });
    $$payload.out += `<!----> `;
    TimePeriodSelectorTrack($$payload, {
      bins: histogram.bins,
      currentIndex,
      onIndexChange: handleIndexChange,
      timelineHeight,
      onKeyDown: handleKeyDown
    });
    $$payload.out += `<!----> `;
    TimePeriodSelectorThumb($$payload, {
      currentIndex,
      totalBins: histogram.bins.length,
      isDragging,
      onDragStart: handleDragStart,
      timelineHeight,
      bins: histogram.bins
    });
    $$payload.out += `<!----></div></div>`;
  } else {
    $$payload.out += "<!--[!-->";
  }
  $$payload.out += `<!--]-->`;
  pop();
}
function ToggleGroup($$payload, $$props) {
  push();
  var $$store_subs;
  let {
    items,
    selectedItems = [],
    onItemSelected,
    class: className
  } = $$props;
  const { elements: { root, item }, states: { value } } = createToggleGroup({
    type: "multiple",
    defaultValue: selectedItems,
    onValueChange: ({ curr, next }) => {
      if (onItemSelected) {
        console.log("change");
        onItemSelected(next);
      }
      return next;
    }
  });
  const each_array = ensure_array_like(items);
  $$payload.out += `<div${spread_attributes(
    {
      ...store_get($$store_subs ??= {}, "$root", root),
      class: clsx(mergeCss("flex items-center data-[orientation='vertical']:flex-col", className)),
      "aria-label": "Toggle selection"
    },
    "svelte-b5btdf"
  )}><!--[-->`;
  for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
    let itemValue = each_array[$$index];
    const __MELTUI_BUILDER_0__ = store_get($$store_subs ??= {}, "$item", item)(itemValue);
    $$payload.out += `<button${spread_attributes(
      {
        class: "toggle-item",
        ...__MELTUI_BUILDER_0__,
        "aria-label": `Toggle ${stringify(itemValue)}`
      },
      "svelte-b5btdf"
    )}>${escape_html(itemValue)}</button>`;
  }
  $$payload.out += `<!--]--></div>`;
  if ($$store_subs) unsubscribe_stores($$store_subs);
  pop();
}
function CellView($$payload, $$props) {
  push();
  let {
    cellId,
    period,
    bounds,
    recordTypes,
    onClose
  } = $$props;
  {
    $$payload.out += "<!--[-->";
    $$payload.out += `<div class="w-full flex justify-between"><div><h2><span><span class="font-bold">Cell</span> ${escape_html(cellId)}</span> <span class="block"><span class="font-bold">Period</span> ${escape_html(formatDate(period))}</span> `;
    if (bounds) {
      $$payload.out += "<!--[-->";
      $$payload.out += `<span class="block text-sm text-gray-600">Lat: ${escape_html(bounds.minlat.toFixed(4))} - ${escape_html(bounds.maxlat.toFixed(4))}<br> Lon: ${escape_html(bounds.minlon.toFixed(4))} - ${escape_html(bounds.maxlon.toFixed(4))}</span>`;
    } else {
      $$payload.out += "<!--[!-->";
    }
    $$payload.out += `<!--]--></h2></div> <button class="px-2 py-1 text-sm text-black border border-solid border-black">close</button></div> <div class="text-gray-500">Loading cell data...</div>`;
  }
  $$payload.out += `<!--]-->`;
  pop();
}
function ErrorHandler($$payload, $$props) {
  push();
  pop();
}
function _page($$payload, $$props) {
  push();
  let { data } = $$props;
  let dimensions = data?.metadata?.heatmapDimensions;
  let recordTypes = data?.metadata?.recordTypes;
  let heatmapTimeline = data?.heatmapTimeline?.heatmapTimeline;
  let heatmapBlueprint = data?.metadata?.heatmapBlueprint?.cells;
  let currentRecordTypes = data?.currentRecordTypes;
  let tags = data?.tags;
  let histogram = data?.histogram?.histogram;
  const controller = createMapController();
  let currentPeriod = controller.currentPeriod;
  let selectedCellId = controller.selectedCellId;
  let selectedCellBounds = controller.selectedCellBounds;
  let showCellModal = controller.showCellModal;
  (() => {
    const serverErrors = data.errorData?.errors || [];
    const controllerErrors = controller.errors || [];
    return createPageErrorData([...serverErrors, ...controllerErrors]);
  })();
  let mergedHeatmapTimeline = (() => {
    if (heatmapTimeline && currentRecordTypes && recordTypes) {
      const effectiveRecordTypes = currentRecordTypes.length > 0 ? currentRecordTypes : recordTypes;
      const needsMerging = effectiveRecordTypes.length > 1 || tags && tags.length > 0;
      if (needsMerging) {
        const selectedTag = tags && tags.length > 0 ? tags[0] : void 0;
        return mergeHeatmapTimeline(heatmapTimeline, effectiveRecordTypes, selectedTag, heatmapBlueprint);
      } else {
        return heatmapTimeline;
      }
    }
    return null;
  })();
  let mergedHistogram = histogram;
  let currentHeatmap = (() => {
    if (mergedHeatmapTimeline && currentPeriod && recordTypes) {
      const effectiveRecordTypes = currentRecordTypes.length > 0 ? currentRecordTypes : recordTypes;
      const timeSliceData = mergedHeatmapTimeline[currentPeriod];
      if (timeSliceData) {
        if (effectiveRecordTypes.length > 1 || tags && tags.length > 0) {
          const combinedKey = effectiveRecordTypes.sort().join("+");
          return timeSliceData[combinedKey]?.base || null;
        } else {
          const recordType = effectiveRecordTypes[0];
          return timeSliceData[recordType]?.base || null;
        }
      }
    }
    return null;
  })();
  const debouncedPeriodChange = debounce(
    (period) => {
      controller.setPeriod(period);
    },
    300
  );
  function handlePeriodChange(period) {
    debouncedPeriodChange(period);
  }
  function handleRecordTypeChange(recordTypes2) {
  }
  function handleCellClick(cellId) {
    if (cellId && heatmapBlueprint) {
      const cell = heatmapBlueprint.find((c) => c.cellId === cellId);
      if (cell?.bounds) {
        controller.selectCell(cellId, {
          minlat: cell.bounds.minlat,
          maxlat: cell.bounds.maxlat,
          minlon: cell.bounds.minlon,
          maxlon: cell.bounds.maxlon
        });
      } else {
        controller.selectCell(cellId);
      }
    } else {
      controller.selectCell(null);
    }
  }
  function handleCellClose() {
    controller.clearErrors();
    controller.selectCell(null);
  }
  ErrorHandler();
  $$payload.out += `<!----> <div class="relative flex flex-col w-screen h-screen"><div class="relative flex-1">`;
  ToggleGroup($$payload, {
    items: recordTypes,
    selectedItems: currentRecordTypes,
    onItemSelected: handleRecordTypeChange,
    class: "absolute z-50 top-5 left-5"
  });
  $$payload.out += `<!----> `;
  if (currentHeatmap && heatmapBlueprint && dimensions) {
    $$payload.out += "<!--[-->";
    Map_1($$payload, {
      heatmap: currentHeatmap,
      heatmapBlueprint,
      dimensions,
      selectedCellId,
      handleCellClick
    });
  } else {
    $$payload.out += "<!--[!-->";
  }
  $$payload.out += `<!--]--> `;
  if (showCellModal && selectedCellId) {
    $$payload.out += "<!--[-->";
    $$payload.out += `<div class="z-50 absolute p-4 top-0 right-0 w-1/2 h-full bg-white overflow-y-auto border-l border-solid border-gray-300">`;
    CellView($$payload, {
      cellId: selectedCellId,
      period: currentPeriod,
      bounds: selectedCellBounds,
      recordTypes: currentRecordTypes,
      onClose: handleCellClose
    });
    $$payload.out += `<!----></div>`;
  } else {
    $$payload.out += "<!--[!-->";
  }
  $$payload.out += `<!--]--></div> `;
  if (mergedHistogram) {
    $$payload.out += "<!--[-->";
    TimePeriodSelector($$payload, {
      period: currentPeriod,
      histogram: mergedHistogram,
      onPeriodChange: handlePeriodChange
    });
  } else {
    $$payload.out += "<!--[!-->";
  }
  $$payload.out += `<!--]--></div>`;
  pop();
}
export {
  _page as default
};
