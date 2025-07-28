//import adapter from '@sveltejs/adapter-auto';
import adapter from "svelte-adapter-bun";
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { preprocessMeltUI, sequence } from '@melt-ui/pp';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://kit.svelte.dev/docs/integrations#preprocessors
	// for more information about preprocessors
	preprocess: sequence([
		vitePreprocess({
			script: true // Make sure this is enabled for TypeScript
		}),
		preprocessMeltUI()
	]),

	kit: {
		// adapter-auto only supports some environments, see https://kit.svelte.dev/docs/adapter-auto for a list.
		// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
		// See https://kit.svelte.dev/docs/adapters for more information about adapters.
		adapter: adapter(),
		alias: {
			$routes: 'src/routes',
			$components: 'src/lib/components',
			$state: 'src/lib/state',
			$types: 'src/lib/types',
			$utils: 'src/lib/utils/',
			$constants: 'src/lib/constants.ts',
			$stores: 'src/lib/stores'
		}
	}
};

export default config;
