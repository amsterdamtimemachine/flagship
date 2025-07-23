
<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		children
	}: {
		children?: Snippet;
	} = $props();

</script>

<div class="w-full border-2 border-solid border-gray-200 p-2 bg-white">
	{@render children?.()}
</div>
