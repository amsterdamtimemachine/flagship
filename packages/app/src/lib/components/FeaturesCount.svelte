<script lang="ts">
	interface Props {
		totalFeatures: number;
		currentPage: number;
		featuresPerPage: number;
	}

	let { totalFeatures, currentPage, featuresPerPage }: Props = $props();

	const totalPages = $derived(Math.ceil(totalFeatures / featuresPerPage));
	const showingStart = $derived((currentPage - 1) * featuresPerPage + 1);
	const showingEnd = $derived(Math.min(currentPage * featuresPerPage, totalFeatures));
	const isPaginated = $derived(totalPages > 1);
</script>

<p class="text-sm text-gray-700">
	{#if isPaginated}
		Showing {showingStart}-{showingEnd} / {totalFeatures} features
	{:else}
		Showing {totalFeatures} features
	{/if}
</p>
