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
	
	// English pluralization: "feature" (singular) vs "features" (plural)
	const featuresText = $derived(totalFeatures === 1 ? 'feature' : 'features');
</script>

<p class="text-base text-gray-700">
		{#if isPaginated}
        Toont {showingStart}-{showingEnd} / {totalFeatures} {featuresText}
    {:else}
        Toont {totalFeatures} {featuresText}
	{/if}
</p>
