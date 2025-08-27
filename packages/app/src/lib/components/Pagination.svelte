<script lang="ts">
	import { createPagination, melt } from '@melt-ui/svelte';
	
	interface Props {
		totalItems: number;
		currentPage: number;
		itemsPerPage: number;
		onPageChange?: (page: number) => void;
		loading?: boolean;
		siblingCount?: number;
		class?: string;
	}
	
	let { 
		totalItems, 
		currentPage, 
		itemsPerPage, 
		onPageChange,
		loading = false,
		siblingCount = 1,
		class: className
	}: Props = $props();
	
	const {
		elements: { root, pageTrigger, prevButton, nextButton },
		states: { pages, range }
	} = createPagination({
		count: totalItems,
		perPage: itemsPerPage,
		defaultPage: currentPage,
		siblingCount,
		onPageChange: ({ curr, next }) => {
			if (onPageChange) {
				onPageChange(next);
			}
			return next;
		}
	});
</script>

<nav
	class="flex items-center gap-2 {className || ''}"
	class:opacity-50={loading}
	class:pointer-events-none={loading}
	aria-label="pagination"
	use:melt={$root}
>
		<button
			class="grid h-8 items-center rounded-md bg-white px-3 text-sm text-gray-700 border border-gray-300
			hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 data-[selected]:bg-gray-900
			data-[selected]:text-white transition-colors"
			use:melt={$prevButton}
		>
			←
		</button>
		{#each $pages as page (page.key)}
			{#if page.type === 'ellipsis'}
				<span class="px-2 text-gray-500">...</span>
			{:else}
				<button
					class="grid h-8 items-center rounded-md bg-white px-3 text-sm text-gray-700 border border-gray-300
					hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 data-[selected]:bg-gray-900
					data-[selected]:text-white transition-colors min-w-[32px]"
					use:melt={$pageTrigger(page)}
				>
					{page.value}
				</button>
			{/if}
		{/each}
	<button
		class="grid h-8 items-center rounded-md bg-white px-3 text-sm text-gray-700 border border-gray-300
		hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 data-[selected]:bg-gray-900
		data-[selected]:text-white transition-colors"
		use:melt={$nextButton}
	>
		→
	</button>
</nav>
