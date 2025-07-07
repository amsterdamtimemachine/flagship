<script lang="ts">
	import { goto } from '$app/navigation';
	import GridFeatures from '$components/GridFeatures.svelte';
	import { fetchGeodataFromDatabase } from '$api';
	import { formatDate } from '$utils/utils';
	
	interface Props {
		data: { 
			geodata: any; // Database API response
			cellId: string;
			period: string;
			bounds?: { minlat: number; maxlat: number; minlon: number; maxlon: number };
		};
		onClose?: () => void; // Optional close handler
	}
	
	let { data, onClose }: Props = $props();
	
	// Extract features from geodata response
	let allFeatures = $state(data.geodata?.data || []);
	let currentPage = $state(data.geodata?.page || 1);
	let totalPages = $state(data.geodata?.total_pages || 1);
	let totalCount = $state(data.geodata?.total || 0);
	let hasMorePages = $derived(currentPage < totalPages);
	let loading = $state(false);
	
	async function loadMore() {
		if (loading || !hasMorePages) return;
		loading = true;
		try {
			// Parse period to get start and end years
			const [startYear, endYear] = data.period.split('_').map(y => parseInt(y));
			
			// Build params for next page
			const params = {
				min_lat: data.bounds?.minlat ?? 1,
				min_lon: data.bounds?.minlon ?? 1,
				max_lat: data.bounds?.maxlat ?? 85,
				max_lon: data.bounds?.maxlon ?? 55,
				start_year: `${startYear}-01-01`,
				end_year: `${endYear}-01-01`,
				page: currentPage + 1
			};
			
			const response = await fetchGeodataFromDatabase(params);
			
			// Append new features to existing ones
			allFeatures = [...allFeatures, ...(response.data || [])];
			currentPage = response.page || currentPage + 1;
			totalPages = response.total_pages || totalPages;
			totalCount = response.total || totalCount;
			
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
			goto(`/?period=${data.period}${window.location.search.includes('&') ? '&' + window.location.search.split('&').slice(1).join('&') : ''}`);
		}
	}
</script>

{#if data.geodata}
	<div class="w-full flex justify-between">
		<div>
			<h2>
				<span>
					<span class="font-bold">Cell</span>
					{data.cellId}
				</span>
				<span class="block">
					<span class="font-bold">Period</span>
					{formatDate(data.period)}
				</span>
				{#if data.bounds}
					<span class="block text-sm text-gray-600">
						Lat: {data.bounds.minlat.toFixed(4)} - {data.bounds.maxlat.toFixed(4)}<br/>
						Lon: {data.bounds.minlon.toFixed(4)} - {data.bounds.maxlon.toFixed(4)}
					</span>
				{/if}
			</h2>
		</div>
		<button
			onclick={closeModal}
			class="px-2 py-1 text-sm text-black border border-solid border-black"
		>
			close
		</button>
	</div>
	{#if allFeatures.length === 0}
		<div class="text-gray-500">No features found for this cell and period</div>
	{:else}
		<div>
			<span class="font-bold">Features</span>
			{allFeatures.length}
			{#if totalCount > 0}
				/ {totalCount}
			{/if}
			{#if hasMorePages}
				<span class="text-sm text-gray-600">(Page {currentPage} of {totalPages})</span>
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
{:else}
	<div class="text-gray-500">No data available</div>
{/if}
