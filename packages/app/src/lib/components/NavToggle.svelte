<script lang="ts">
	import { List, X } from 'phosphor-svelte';
	import { mergeCss } from '$utils/utils';

	interface Props {
		class?: string;
		isNavExpanded?: boolean;
		onclick?: () => void;
	}

	let { class: className, isNavExpanded = false, onclick }: Props = $props();
</script>

<button
	type="button"
	class={mergeCss('focus:outline-none flex justify-center items-center bg-white rounded-r-sm border border-gray-300 hover:bg-gray-100', className)}
	aria-label={isNavExpanded ? 'Close navigation menu' : 'Open navigation menu'}
	onclick={onclick}
>
	{#if isNavExpanded}
		<X weight="bold" size={24} />
	{:else}
		<List weight="bold" size={24} />
	{/if}
</button>
