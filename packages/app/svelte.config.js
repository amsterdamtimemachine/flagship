//import adapter from '@sveltejs/adapter-auto';
import adapter from "svelte-adapter-bun";
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { preprocessMeltUI, sequence } from '@melt-ui/pp';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: sequence([
		vitePreprocess({
			script: true // Make sure this is enabled for TypeScript
		}),
		preprocessMeltUI()
	]),

	kit: {
		adapter: adapter(),
		alias: {
			$routes: 'src/routes',
			$components: 'src/lib/components',
			$state: 'src/lib/state',
			$types: 'src/lib/types',
			$utils: 'src/lib/utils/',
			$constants: 'src/lib/constants.ts',
			$stores: 'src/lib/stores',
			$tailwindConfig: 'tailwind.config.js',
		}
	}
};

export default config;
