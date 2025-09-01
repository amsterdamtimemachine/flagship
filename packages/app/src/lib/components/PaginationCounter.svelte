<script lang="ts">
	import { createPagination } from '@melt-ui/svelte';

	interface Props {
		totalItems: number;
		currentPage: number;
		itemsPerPage: number;
	}

	let { totalItems, currentPage, itemsPerPage }: Props = $props();

	const {
		states: { range }
	} = createPagination({
		count: totalItems,
		perPage: itemsPerPage,
		defaultPage: currentPage
	});
</script>

<p class="text-sm text-gray-700">
	Showing items {$range.start} - {$range.end} of {totalItems}
</p>
