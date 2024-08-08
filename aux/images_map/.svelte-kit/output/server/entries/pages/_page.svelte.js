import { c as create_ssr_component, e as escape } from '../../chunks/ssr.js';
const Page = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	let { data } = $$props;
	let mainThreadTime = 0;
	let workerTime = 0;
	if ($$props.data === void 0 && $$bindings.data && data !== void 0) $$bindings.data(data);
	return `<div><button data-svelte-h="svelte-1q0wje4">Run Main Thread Test</button> <button data-svelte-h="svelte-1hn2fzg">Run Worker Test</button> ${`<p>Main Thread Time: ${escape(mainThreadTime)} ms</p> <p>Worker Time: ${escape(workerTime)} ms</p>`}</div>`;
});
export { Page as default };
