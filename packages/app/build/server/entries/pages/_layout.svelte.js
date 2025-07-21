import "clsx";
import { o as onDestroy, m as mergeCss, T as Toaster } from "../../chunks/utils.js";
import { D as once, E as spread_attributes, F as clsx, C as pop, A as push } from "../../chunks/index3.js";
import "dequal";
import { nanoid } from "nanoid";
function createSubscriber(_) {
  return () => {
  };
}
function isFunction(value) {
  return typeof value === "function";
}
function isGetter(value) {
  return isFunction(value) && value.length === 0;
}
function extract(value, defaultValue) {
  if (isGetter(value)) {
    const getter = value;
    const gotten = getter();
    if (gotten === void 0)
      return defaultValue;
    return gotten;
  }
  if (value === void 0)
    return defaultValue;
  return value;
}
const defaultWindow = void 0;
function getActiveElement(document) {
  let activeElement = document.activeElement;
  while (activeElement?.shadowRoot) {
    const node = activeElement.shadowRoot.activeElement;
    if (node === activeElement)
      break;
    else
      activeElement = node;
  }
  return activeElement;
}
class ActiveElement {
  #document;
  #subscribe;
  constructor(options = {}) {
    const {
      window = defaultWindow,
      document = window?.document
    } = options;
    if (window === void 0) return;
    this.#document = document;
    this.#subscribe = createSubscriber();
  }
  get current() {
    this.#subscribe?.();
    if (!this.#document) return null;
    return getActiveElement(this.#document);
  }
}
new ActiveElement();
function styleAttr(value) {
  return Object.entries(value).map(([key, value2]) => `${key}: ${value2};`).join(" ");
}
function keys(obj) {
  return Object.keys(obj);
}
function createDataIds(name, parts) {
  return parts.reduce((acc, part) => {
    acc[part] = `data-melt-${name}-${part}`;
    return acc;
  }, {});
}
function createIds(identifiers) {
  const id = nanoid();
  return Object.keys(identifiers).reduce((acc, key) => {
    acc[key] = `${key}-${id}`;
    return acc;
  }, {});
}
function createBuilderMetadata(name, parts) {
  const dataAttrs = createDataIds(name, parts);
  const dataSelectors = keys(dataAttrs).reduce((acc, key) => {
    acc[key] = `[${dataAttrs[key]}]`;
    return acc;
  }, {});
  return {
    dataAttrs,
    dataSelectors,
    createIds: () => createIds(dataAttrs)
  };
}
createBuilderMetadata("accordion", [
  "root",
  "item",
  "trigger",
  "heading",
  "content"
]);
createDataIds("avatar", ["image", "fallback"]);
class Synced {
  #internalValue;
  #valueArg;
  #onChange;
  #defaultValue;
  #equalityCheck;
  constructor({ value, onChange, ...args }) {
    this.#valueArg = value;
    this.#onChange = onChange;
    this.#defaultValue = "defaultValue" in args ? args?.defaultValue : void 0;
    this.#equalityCheck = args.equalityCheck;
    this.#internalValue = extract(value, this.#defaultValue);
  }
  get current() {
    return isFunction(this.#valueArg) ? this.#valueArg() ?? this.#defaultValue ?? this.#internalValue : this.#internalValue;
  }
  set current(value) {
    if (this.#equalityCheck === true && this.current === value) return;
    if (isFunction(this.#equalityCheck)) {
      if (this.#equalityCheck(this.current, value)) return;
    }
    if (isFunction(this.#valueArg)) {
      this.#onChange?.(value);
      return;
    }
    this.#internalValue = value;
    this.#onChange?.(value);
  }
}
createBuilderMetadata("collapsible", ["trigger", "content"]);
createBuilderMetadata("popover", ["trigger", "content", "arrow"]);
createBuilderMetadata("combobox", ["input", "trigger", "content", "option"]);
createBuilderMetadata("fileupload", ["dropzone", "input"]);
createDataIds("pin-input", ["root", "input"]);
const dataIds = createDataIds("progress", ["root", "progress"]);
class Progress {
  // Props
  #props;
  #max = once(() => extract(this.#props.max, 100));
  get max() {
    return this.#max();
  }
  // States
  #value;
  constructor(props = {}) {
    this.#props = props;
    this.#value = new Synced({
      value: props.value,
      onChange: props.onValueChange,
      defaultValue: 0
    });
  }
  get value() {
    return this.#value.current;
  }
  set value(value) {
    this.#value.current = value;
  }
  /**
   * Spread attributes for the Progress root element.
   */
  get root() {
    return {
      [dataIds.root]: "",
      value: this.#value.current,
      max: this.max,
      role: "progressbar",
      "aria-valuemin": 0,
      "aria-valuemax": this.max,
      "aria-valuenow": this.#value.current,
      "data-value": this.#value.current,
      "data-state": this.#value.current === this.max ? "complete" : "loading",
      "data-max": this.max
    };
  }
  /**
   * Spread attributes for the Progress percentage element.
   * Provides a --progress CSS variable that can be used to style the progress:
   * `transform: translateX(calc(var(--progress) * -1));`
   */
  get progress() {
    return {
      [dataIds.progress]: "",
      style: styleAttr({
        "--progress": `${100 - 100 * (this.#value.current ?? 0) / (this.max ?? 1)}%`,
        "--neg-progress": `-${100 - 100 * (this.#value.current ?? 0) / (this.max ?? 1)}%`
      })
    };
  }
}
createBuilderMetadata("radio-group", ["root", "item", "label", "hidden-input"]);
createBuilderMetadata("select", ["trigger", "content", "option"]);
createBuilderMetadata("slider", ["root", "thumb"]);
createDataIds("tabs", ["trigger", "content", "trigger-list"]);
createBuilderMetadata("toaster", ["root"]);
createBuilderMetadata("toaster-toast", ["content", "title", "description", "close"]);
createDataIds("toggle", ["trigger", "hidden-input"]);
createBuilderMetadata("tooltip", ["trigger", "content", "arrow"]);
createDataIds("tree", ["root", "item", "group"]);
function LoadingBar($$payload, $$props) {
  push();
  let { class: className = void 0 } = $$props;
  const progress = new Progress({ value: 0, max: 100 });
  let isActive = false;
  onDestroy(() => {
    isActive = false;
  });
  $$payload.out += `<div${spread_attributes(
    {
      ...progress.root,
      class: clsx(mergeCss("w-full h-[3px]", className))
    },
    null,
    {
      "opacity-100": isActive,
      "opacity-0": !isActive
    },
    { transition: "opacity 150ms ease-in-out" }
  )}><div${spread_attributes(
    {
      ...progress.progress,
      class: "h-full bg-blue-500 transition-transform duration-300 ease-out"
    },
    null,
    void 0,
    {
      width: "calc(100% - var(--progress))",
      transform: "translateX(calc(var(--progress) * -1))"
    }
  )}></div></div>`;
  pop();
}
function _layout($$payload, $$props) {
  let { children } = $$props;
  $$payload.out += `<main class="relative">`;
  LoadingBar($$payload, { class: "fixed top-0 z-50" });
  $$payload.out += `<!----> `;
  Toaster($$payload);
  $$payload.out += `<!----> `;
  children?.($$payload);
  $$payload.out += `<!----></main>`;
}
export {
  _layout as default
};
