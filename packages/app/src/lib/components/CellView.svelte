<script lang="ts">
	import { goto } from '$app/navigation';
	import GridFeatures from '$components/GridFeatures.svelte';
	import type { HeatmapCellResponse } from '@atm/shared/types';
	import { fetchApi } from '$api';
	import { formatDate } from '$utils/utils';
	import { PUBLIC_SERVER_DEV_URL, PUBLIC_SERVER_PROD_URL } from '$env/static/public';
	
	interface Props {
		data: { cellFeatures: HeatmapCellResponse };
		onClose?: () => void; // Optional close handler
	}
	
	let { data, onClose }: Props = $props();
	
	// Make these reactive to data changes
	let currentPage = $derived(data.cellFeatures.currentPage);
	let hasMorePages = $derived(currentPage < data.cellFeatures.totalPages);
	let allFeatures = $derived(data.cellFeatures.features);
	let baseUrl = $derived(
		import.meta.env.MODE === 'production' ? PUBLIC_SERVER_DEV_URL : PUBLIC_SERVER_PROD_URL
	);
	// WIP: number of features per pages(25) shouldn't be hardcoded)
	let totalFeatureCount = $derived(25 * data.cellFeatures.totalPages);
	let loading = $state(false);
	
	async function loadMore() {
		if (loading || !hasMorePages) return;
		loading = true;
		try {
			// Get the current URL parameters
			const url = new URL(window.location.href);
			const contentClasses = url.searchParams.get('contentClasses') || '';
			const tags = url.searchParams.get('tags') || '';
			// Build API URL with parameters
			let apiUrl = `${baseUrl}/grid/cell/${data.cellFeatures.cellId}?period=${data.cellFeatures.period}&page=${currentPage + 1}`;
			if (contentClasses) apiUrl += `&contentClasses=${contentClasses}`;
			if (tags) apiUrl += `&tags=${tags}`;
			const response = await fetchApi<CellFeaturesResponse>(apiUrl);
			allFeatures = [...allFeatures, ...response.features];
			currentPage = response.currentPage;
			hasMorePages = currentPage < response.totalPages;
		} catch (error) {
			console.error('Error loading more features:', error);
		} finally {
			loading = false;
		}
	}
	
	function closeModal() {
		if (onClose) {
			// Use the passed close handler
			onClose();
		} else {
			// Fallback: navigate back to period page
			goto(`/${data.cellFeatures.period}${window.location.search}`);
		}
	}
</script>

{#if data.cellFeatures}
	<div class="w-full flex justify-between">
		<div>
			<h2>
				<span>
					<span class="font-bold">Cell</span>
					{formatDate(data.cellFeatures.cellId, ':')}
				</span>
				<span class="block">
					<span class="font-bold">Period</span>
					{formatDate(data.cellFeatures.period)}
				</span>
			</h2>
		</div>
		<button
			onclick={closeModal}
			class="px-2 py-1 text-sm text-black border border-solid border-black"
		>
			close
		</button>
	</div>
	{#if data.cellFeatures.featureCount === 0}
		<div class="text-gray-500">No data available for this period</div>
	{:else}
		<div>
			<span class="font-bold"> Features </span>
			{allFeatures.length}
			{#if hasMorePages}
				/ ~{totalFeatureCount}
			{/if}
		</div>
		<GridFeatures features={allFeatures} />
		{#if hasMorePages}
			<button
				onclick={loadMore}
				disabled={loading}
				class="px-2 py-1 text-sm text-black border border-solid border-black"
			>
				{loading ? 'Loading...' : 'Load More'}
			</button>
		{/if}
	{/if}
{/if}
