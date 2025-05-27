<script lang="ts">
	import type { Snippet } from 'svelte';
	import Toaster from '$components/Toaster.svelte';
	import '../app.pcss';

	let {
		children
	}: {
		children?: Snippet;
	} = $props();
</script>

	<main class="relative">

		<Toaster />
	<!-- <h1 class="z-50 absolute top-1 left-1">Amsterdam Time Machine</h1> -->
		{@render children?.()}
	</main>
