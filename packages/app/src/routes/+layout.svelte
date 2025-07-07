<script lang="ts">
	import type { Snippet } from 'svelte';
	import Toaster from '$components/Toaster.svelte';
	import LoadingBar from '$components/LoadingBar.svelte';
	import '../app.pcss';

	let {
		children
	}: {
		children?: Snippet;
	} = $props();
</script>

	<main class="relative">
		<LoadingBar class="fixed top-0 z-50"/>

		<Toaster />
	<!-- <h1 class="z-50 absolute top-1 left-1">Amsterdam Time Machine</h1> -->
		{@render children?.()}
	</main>
