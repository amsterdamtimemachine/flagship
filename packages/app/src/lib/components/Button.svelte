<script lang="ts">
	import type { Snippet } from 'svelte';
	import { mergeCss } from '$utils/utils';

	interface Props {
		onclick?: () => void;
		class?: string;
		disabled?: boolean;
		children: Snippet;
	}

	let { 
		onclick, 
		class: className, 
		disabled = false,
		children
	}: Props = $props();
</script>

<button
	{onclick}
	{disabled}
	class={mergeCss('flex justify-center items-center bg-white rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-2 text-sm', className)}
>
	{@render children()}
</button>