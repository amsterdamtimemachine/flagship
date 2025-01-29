<script lang="ts">
	import { pushState } from '$app/navigation';
	import FeatureCloud from '$components/FeatureCloud.svelte';
	import type { CellFeaturesResponse } from '@atm/shared-types';
	import type { PageData } from './$types';
	import { fetchApi } from '$api';
	import { formatDate } from '$utils/utils';
	import { PUBLIC_SERVER_DEV_URL, PUBLIC_SERVER_PROD_URL } from '$env/static/public';

	export let data: PageData;

	let currentPage = data.cellFeatures.currentPage;
	let loading = false;
	let hasMorePages = currentPage < data.cellFeatures.totalPages;

	let allFeatures = data.cellFeatures.features;
	$: baseUrl =
		import.meta.env.MODE === 'production' ? PUBLIC_SERVER_DEV_URL : PUBLIC_SERVER_PROD_URL;

	$: totalFeatureCount = 25 * data.cellFeatures.totalPages;

	async function loadMore() {
		if (loading || !hasMorePages) return;
		loading = true;

		try {
			const url = `${baseUrl}/grid/cell/${data.cellFeatures.cellId}?period=${data.cellFeatures.period}&page=${currentPage + 1}`;
			const response = await fetchApi<CellFeaturesResponse>(url);
			allFeatures = allFeatures.concat(response.features);
			currentPage = response.currentPage;
			hasMorePages = currentPage < response.totalPages;
		} catch (error) {
			console.error('Error loading more features:', error);
		} finally {
			loading = false;
		}
	}

	function closeModal() {
		pushState('/', { selectedCell: undefined });
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
			on:click={closeModal}
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
		<FeatureCloud features={allFeatures} />
		{#if hasMorePages}
			<button
				on:click={loadMore}
				disabled={loading}
				class="px-2 py-1 text-sm text-black border border-solid border-black"
			>
				{loading ? 'Loading...' : 'Load More'}
			</button>
		{/if}
	{/if}
{/if}
