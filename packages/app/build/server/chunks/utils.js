import { R as current_component, K as ensure_array_like, P as store_get, E as spread_attributes, G as escape_html, J as attr_class, Q as unsubscribe_stores, C as pop, A as push } from "./index3.js";
import "dequal";
import { d as derived, g as get, w as writable, r as readable, a as readonly } from "./index2.js";
import { clsx } from "clsx";
import { nanoid } from "nanoid/non-secure";
import { twMerge } from "tailwind-merge";
function onDestroy(fn) {
  var context = (
    /** @type {Component} */
    current_component
  );
  (context.d ??= []).push(fn);
}
async function tick() {
}
function styleToString(style) {
  return Object.keys(style).reduce((str, key) => {
    if (style[key] === void 0)
      return str;
    return str + `${key}:${style[key]};`;
  }, "");
}
function disabledAttr(disabled) {
  return disabled ? true : void 0;
}
({
  type: "hidden",
  "aria-hidden": true,
  hidden: true,
  tabIndex: -1,
  style: styleToString({
    position: "absolute",
    opacity: 0,
    "pointer-events": "none",
    margin: 0,
    transform: "translateX(-100%)"
  })
});
function executeCallbacks(...callbacks) {
  return (...args) => {
    for (const callback of callbacks) {
      if (typeof callback === "function") {
        callback(...args);
      }
    }
  };
}
function noop() {
}
function omit(obj, ...keys) {
  const result = {};
  for (const key of Object.keys(obj)) {
    if (!keys.includes(key)) {
      result[key] = obj[key];
    }
  }
  return result;
}
function removeUndefined(obj) {
  const result = {};
  for (const key in obj) {
    const value = obj[key];
    if (value !== void 0) {
      result[key] = value;
    }
  }
  return result;
}
function lightable(value) {
  function subscribe(run) {
    run(value);
    return () => {
    };
  }
  return { subscribe };
}
const hiddenAction = (obj) => {
  return new Proxy(obj, {
    get(target, prop, receiver) {
      return Reflect.get(target, prop, receiver);
    },
    ownKeys(target) {
      return Reflect.ownKeys(target).filter((key) => key !== "action");
    }
  });
};
const isFunctionWithParams = (fn) => {
  return typeof fn === "function";
};
makeElement("empty");
function makeElement(name2, args) {
  const { stores, action, returned } = args ?? {};
  const derivedStore = (() => {
    if (stores && returned) {
      return derived(stores, (values) => {
        const result = returned(values);
        if (isFunctionWithParams(result)) {
          const fn = (...args2) => {
            return hiddenAction(removeUndefined({
              ...result(...args2),
              [`data-melt-${name2}`]: "",
              action: action ?? noop
            }));
          };
          fn.action = action ?? noop;
          return fn;
        }
        return hiddenAction(removeUndefined({
          ...result,
          [`data-melt-${name2}`]: "",
          action: action ?? noop
        }));
      });
    } else {
      const returnedFn = returned;
      const result = returnedFn?.();
      if (isFunctionWithParams(result)) {
        const resultFn = (...args2) => {
          return hiddenAction(removeUndefined({
            ...result(...args2),
            [`data-melt-${name2}`]: "",
            action: action ?? noop
          }));
        };
        resultFn.action = action ?? noop;
        return lightable(resultFn);
      }
      return lightable(hiddenAction(removeUndefined({
        ...result,
        [`data-melt-${name2}`]: "",
        action: action ?? noop
      })));
    }
  })();
  const actionFn = action ?? (() => {
  });
  actionFn.subscribe = derivedStore.subscribe;
  return actionFn;
}
function createElHelpers(prefix) {
  const name2 = (part) => part ? `${prefix}-${part}` : prefix;
  const attribute = (part) => `data-melt-${prefix}${part ? `-${part}` : ""}`;
  const selector = (part) => `[data-melt-${prefix}${part ? `-${part}` : ""}]`;
  const getEl = (part) => document.querySelector(selector(part));
  return {
    name: name2,
    attribute,
    selector,
    getEl
  };
}
const isBrowser = typeof document !== "undefined";
function isHTMLElement(element) {
  return element instanceof HTMLElement;
}
function isTouch(event) {
  return event.pointerType === "touch";
}
function addMeltEventListener(target, event, handler, options) {
  const events = Array.isArray(event) ? event : [event];
  if (typeof handler === "function") {
    const handlerWithMelt = withMelt((_event) => handler(_event));
    events.forEach((_event) => target.addEventListener(_event, handlerWithMelt, options));
    return () => {
      events.forEach((_event) => target.removeEventListener(_event, handlerWithMelt, options));
    };
  }
  return () => noop();
}
function dispatchMeltEvent(originalEvent) {
  const node = originalEvent.currentTarget;
  if (!isHTMLElement(node))
    return null;
  const customMeltEvent = new CustomEvent(`m-${originalEvent.type}`, {
    detail: {
      originalEvent
    },
    cancelable: true
  });
  node.dispatchEvent(customMeltEvent);
  return customMeltEvent;
}
function withMelt(handler) {
  return (event) => {
    const customEvent = dispatchMeltEvent(event);
    if (customEvent?.defaultPrevented)
      return;
    return handler(event);
  };
}
function withGet(store) {
  return {
    ...store,
    get: () => get(store)
  };
}
withGet.writable = function(initial) {
  const internal = writable(initial);
  let value = initial;
  return {
    subscribe: internal.subscribe,
    set(newValue) {
      internal.set(newValue);
      value = newValue;
    },
    update(updater) {
      const newValue = updater(value);
      internal.set(newValue);
      value = newValue;
    },
    get() {
      return value;
    }
  };
};
withGet.derived = function(stores, fn) {
  const subscribers = /* @__PURE__ */ new Map();
  const get2 = () => {
    const values = Array.isArray(stores) ? stores.map((store) => store.get()) : stores.get();
    return fn(values);
  };
  const subscribe = (subscriber) => {
    const unsubscribers = [];
    const storesArr = Array.isArray(stores) ? stores : [stores];
    storesArr.forEach((store) => {
      unsubscribers.push(store.subscribe(() => {
        subscriber(get2());
      }));
    });
    subscriber(get2());
    subscribers.set(subscriber, unsubscribers);
    return () => {
      const unsubscribers2 = subscribers.get(subscriber);
      if (unsubscribers2) {
        for (const unsubscribe of unsubscribers2) {
          unsubscribe();
        }
      }
      subscribers.delete(subscriber);
    };
  };
  return {
    get: get2,
    subscribe
  };
};
function generateId() {
  return nanoid(10);
}
const kbd = {
  ALT: "Alt",
  ARROW_DOWN: "ArrowDown",
  ARROW_LEFT: "ArrowLeft",
  ARROW_RIGHT: "ArrowRight",
  ARROW_UP: "ArrowUp",
  BACKSPACE: "Backspace",
  CAPS_LOCK: "CapsLock",
  CONTROL: "Control",
  DELETE: "Delete",
  END: "End",
  ENTER: "Enter",
  ESCAPE: "Escape",
  F1: "F1",
  F10: "F10",
  F11: "F11",
  F12: "F12",
  F2: "F2",
  F3: "F3",
  F4: "F4",
  F5: "F5",
  F6: "F6",
  F7: "F7",
  F8: "F8",
  F9: "F9",
  HOME: "Home",
  META: "Meta",
  PAGE_DOWN: "PageDown",
  PAGE_UP: "PageUp",
  SHIFT: "Shift",
  SPACE: " ",
  TAB: "Tab",
  CTRL: "Control",
  ASTERISK: "*",
  A: "a",
  P: "p"
};
function toWritableStores(properties) {
  const result = {};
  Object.keys(properties).forEach((key) => {
    const propertyKey = key;
    const value = properties[propertyKey];
    result[propertyKey] = withGet(writable(value));
  });
  return result;
}
({
  prefix: "",
  disabled: readable(false),
  required: readable(false),
  name: readable(void 0),
  type: readable(void 0),
  checked: void 0
});
const usePortal = (el, target = "body") => {
  let targetEl;
  if (!isHTMLElement(target) && typeof target !== "string") {
    return {
      destroy: noop
    };
  }
  async function update(newTarget = "body") {
    target = newTarget;
    if (typeof target === "string") {
      targetEl = document.querySelector(target);
      if (targetEl === null) {
        await tick();
        targetEl = document.querySelector(target);
      }
      if (targetEl === null) {
        throw new Error(`No element found matching css selector: "${target}"`);
      }
    } else if (target instanceof HTMLElement) {
      targetEl = target;
    } else {
      throw new TypeError(`Unknown portal target type: ${target === null ? "null" : typeof target}. Allowed types: string (CSS selector) or HTMLElement.`);
    }
    el.dataset.portal = "";
    targetEl.appendChild(el);
    el.hidden = false;
  }
  function destroy() {
    el.remove();
  }
  update(target);
  return {
    update,
    destroy
  };
};
const defaults$1 = {
  isDateDisabled: void 0,
  isDateUnavailable: void 0,
  value: void 0,
  preventDeselect: false,
  numberOfMonths: 1,
  pagedNavigation: false,
  weekStartsOn: 0,
  fixedWeeks: false,
  calendarLabel: "Event Date",
  locale: "en",
  minValue: void 0,
  maxValue: void 0,
  disabled: false,
  readonly: false,
  weekdayFormat: "narrow"
};
({
  isDateDisabled: void 0,
  isDateUnavailable: void 0,
  value: void 0,
  positioning: {
    placement: "bottom"
  },
  escapeBehavior: "close",
  closeOnOutsideClick: true,
  onOutsideClick: void 0,
  preventScroll: false,
  forceVisible: false,
  locale: "en",
  granularity: void 0,
  disabled: false,
  readonly: false,
  minValue: void 0,
  maxValue: void 0,
  weekdayFormat: "narrow",
  ...omit(defaults$1, "isDateDisabled", "isDateUnavailable", "value", "locale", "disabled", "readonly", "minValue", "maxValue", "weekdayFormat")
});
const { name } = createElHelpers("toast");
const defaults = {
  closeDelay: 5e3,
  type: "foreground",
  hover: "pause"
};
function createToaster(props) {
  const withDefaults = { ...defaults, ...props };
  const options = toWritableStores(withDefaults);
  const { closeDelay, type, hover } = options;
  const toastsMap = writable(/* @__PURE__ */ new Map());
  const addToast = (props2) => {
    const propsWithDefaults = {
      closeDelay: closeDelay.get(),
      type: type.get(),
      ...props2
    };
    const ids = {
      content: generateId(),
      title: generateId(),
      description: generateId()
    };
    const timeout = propsWithDefaults.closeDelay === 0 ? null : window.setTimeout(() => {
      removeToast(ids.content);
    }, propsWithDefaults.closeDelay);
    const getPercentage = () => {
      const { createdAt, pauseDuration, closeDelay: closeDelay2, pausedAt } = toast;
      if (closeDelay2 === 0)
        return 0;
      if (pausedAt) {
        return 100 * (pausedAt - createdAt - pauseDuration) / closeDelay2;
      } else {
        const now = performance.now();
        return 100 * (now - createdAt - pauseDuration) / closeDelay2;
      }
    };
    const toast = {
      id: ids.content,
      ids,
      ...propsWithDefaults,
      timeout,
      createdAt: performance.now(),
      pauseDuration: 0,
      getPercentage
    };
    toastsMap.update((currentMap) => {
      currentMap.set(ids.content, toast);
      return new Map(currentMap);
    });
    return toast;
  };
  const removeToast = (id) => {
    toastsMap.update((currentMap) => {
      currentMap.delete(id);
      return new Map(currentMap);
    });
  };
  const updateToast = (id, data) => {
    toastsMap.update((currentMap) => {
      const toast = currentMap.get(id);
      if (!toast)
        return currentMap;
      currentMap.set(id, { ...toast, data });
      return new Map(currentMap);
    });
  };
  const pauseToastTimer = (currentToast) => {
    if (currentToast.timeout !== null) {
      window.clearTimeout(currentToast.timeout);
    }
    currentToast.pausedAt = performance.now();
  };
  const restartToastTimer = (currentToast) => {
    const pausedAt = currentToast.pausedAt ?? currentToast.createdAt;
    const elapsed = pausedAt - currentToast.createdAt - currentToast.pauseDuration;
    const remaining = currentToast.closeDelay - elapsed;
    currentToast.timeout = window.setTimeout(() => {
      removeToast(currentToast.id);
    }, remaining);
    currentToast.pauseDuration += performance.now() - pausedAt;
    currentToast.pausedAt = void 0;
  };
  const content2 = makeElement(name("content"), {
    stores: toastsMap,
    returned: ($toasts) => {
      return (id) => {
        const t = $toasts.get(id);
        if (!t)
          return null;
        const { ...toast } = t;
        return {
          id,
          role: "alert",
          "aria-describedby": toast.ids.description,
          "aria-labelledby": toast.ids.title,
          "aria-live": toast.type === "foreground" ? "assertive" : "polite",
          tabindex: -1
        };
      };
    },
    action: (node) => {
      let destroy = noop;
      destroy = executeCallbacks(addMeltEventListener(node, "pointerenter", (e) => {
        if (isTouch(e))
          return;
        toastsMap.update((currentMap) => {
          switch (hover.get()) {
            case "pause": {
              const currentToast = currentMap.get(node.id);
              if (!currentToast || currentToast.closeDelay === 0)
                return currentMap;
              pauseToastTimer(currentToast);
              break;
            }
            case "pause-all":
              for (const [, currentToast] of currentMap) {
                if (!currentToast || currentToast.closeDelay === 0)
                  continue;
                pauseToastTimer(currentToast);
              }
              break;
          }
          return new Map(currentMap);
        });
      }), addMeltEventListener(node, "pointerleave", (e) => {
        if (isTouch(e))
          return;
        toastsMap.update((currentMap) => {
          switch (hover.get()) {
            case "pause": {
              const currentToast = currentMap.get(node.id);
              if (!currentToast || currentToast.closeDelay === 0)
                return currentMap;
              restartToastTimer(currentToast);
              break;
            }
            case "pause-all":
              for (const [, currentToast] of currentMap) {
                if (!currentToast || currentToast.closeDelay === 0)
                  continue;
                restartToastTimer(currentToast);
              }
              break;
          }
          return new Map(currentMap);
        });
      }), () => {
        removeToast(node.id);
      });
      return {
        destroy
      };
    }
  });
  const title2 = makeElement(name("title"), {
    stores: toastsMap,
    returned: ($toasts) => {
      return (id) => {
        const toast = $toasts.get(id);
        if (!toast)
          return null;
        return {
          id: toast.ids.title
        };
      };
    }
  });
  const description2 = makeElement(name("description"), {
    stores: toastsMap,
    returned: ($toasts) => {
      return (id) => {
        const toast = $toasts.get(id);
        if (!toast)
          return null;
        return {
          id: toast.ids.description
        };
      };
    }
  });
  const close2 = makeElement(name("close"), {
    returned: () => {
      return (id) => ({
        type: "button",
        "data-id": id
      });
    },
    action: (node) => {
      function handleClose() {
        if (!node.dataset.id)
          return;
        removeToast(node.dataset.id);
      }
      const unsub = executeCallbacks(addMeltEventListener(node, "click", () => {
        handleClose();
      }), addMeltEventListener(node, "keydown", (e) => {
        if (e.key !== kbd.ENTER && e.key !== kbd.SPACE)
          return;
        e.preventDefault();
        handleClose();
      }));
      return {
        destroy: unsub
      };
    }
  });
  const toasts2 = derived(toastsMap, ($toastsMap) => {
    return Array.from($toastsMap.values());
  });
  return {
    elements: {
      content: content2,
      title: title2,
      description: description2,
      close: close2
    },
    states: {
      toasts: readonly(toasts2)
    },
    helpers: {
      addToast,
      removeToast,
      updateToast
    },
    actions: {
      portal: usePortal
    },
    options
  };
}
const {
  elements: { content, title, description, close },
  helpers,
  states: { toasts },
  actions: { portal }
} = createToaster();
helpers.addToast;
function Toaster($$payload, $$props) {
  push();
  var $$store_subs;
  const each_array = ensure_array_like(store_get($$store_subs ??= {}, "$toasts", toasts));
  $$payload.out += `<div class="fixed right-0 top-0 z-50 m-4 flex flex-col items-end gap-2 md:bottom-0 md:top-auto"><!--[-->`;
  for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
    let { id, data } = each_array[$$index];
    const __MELTUI_BUILDER_3__ = store_get($$store_subs ??= {}, "$close", close)(id);
    const __MELTUI_BUILDER_2__ = store_get($$store_subs ??= {}, "$description", description)(id);
    const __MELTUI_BUILDER_1__ = store_get($$store_subs ??= {}, "$title", title)(id);
    const __MELTUI_BUILDER_0__ = store_get($$store_subs ??= {}, "$content", content)(id);
    $$payload.out += `<div${spread_attributes(
      {
        ...__MELTUI_BUILDER_0__,
        class: "rounded-lg bg-white text-gray-800 shadow-md border max-w-sm"
      },
      null,
      {
        "border-red-200": data.type === "error",
        "border-yellow-200": data.type === "warning",
        "border-green-200": data.type === "success",
        "border-blue-200": data.type === "info"
      }
    )}><div class="relative flex w-[24rem] max-w-[calc(100vw-2rem)] items-center justify-between gap-4 p-5"><div><h3${spread_attributes(
      {
        ...__MELTUI_BUILDER_1__,
        class: "flex items-center gap-2 font-semibold text-sm mb-1"
      },
      null
    )}>${escape_html(data.title)} <span${attr_class("size-1.5 rounded-full", void 0, {
      "bg-red-500": data.type === "error",
      "bg-yellow-500": data.type === "warning",
      "bg-green-500": data.type === "success",
      "bg-blue-500": data.type === "info"
    })}></span></h3> <div${spread_attributes(
      {
        ...__MELTUI_BUILDER_2__,
        class: "text-sm text-gray-600"
      },
      null
    )}>${escape_html(data.description)}</div></div> <button${spread_attributes(
      {
        ...__MELTUI_BUILDER_3__,
        class: "absolute right-4 top-4 grid size-6 place-items-center rounded-full text-gray-400 hover:text-gray-600"
      },
      null
    )}>×</button></div></div>`;
  }
  $$payload.out += `<!--]--></div>`;
  if ($$store_subs) unsubscribe_stores($$store_subs);
  pop();
}
function mergeCss(...inputs) {
  return twMerge(clsx(inputs));
}
function formatDate(date, separator = "-") {
  let [start, end] = date.split("_");
  return `${start}${separator}${end}`;
}
export {
  Toaster as T,
  isHTMLElement as a,
  omit as b,
  makeElement as c,
  createElHelpers as d,
  disabledAttr as e,
  executeCallbacks as f,
  addMeltEventListener as g,
  formatDate as h,
  isBrowser as i,
  kbd as k,
  mergeCss as m,
  noop as n,
  onDestroy as o,
  toWritableStores as t,
  withGet as w
};
