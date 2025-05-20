<script lang="ts">
	import type { Snippet } from 'svelte';
	import '../app.pcss';

	let {
		children
	}: {
		children?: Snippet;
	} = $props();
</script>

<main class="relative">
	<!-- <h1 class="z-50 absolute top-1 left-1">Amsterdam Time Machine</h1> -->
	{@render children?.()}
</main>
