<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import FeaturesLayout from '$components/FeaturesLayout.svelte';
	import { fetchGeodataFromDatabase } from '$utils/clientApi';
	import { formatDate } from '$utils/utils';
	import { loadingState } from '$lib/state/loadingState.svelte';
	import { createError, createPageErrorData } from '$utils/error';
	import ErrorHandler from '$components/ErrorHandler.svelte';
	import type { RecordType } from '@atm/shared/types';
	import type { AppError } from '$types/error';
	
	interface Props {
		cellId: string;
		period: string;
		bounds?: { minLat: number; maxLat: number; minLon: number; maxLon: number };
		recordTypes: RecordType[];
		tags: string[];
		onClose?: () => void; 
	}
	
	let { cellId, period, bounds, recordTypes, tags, onClose }: Props = $props();
	
	// Cell data state
	let allFeatures = $state<any[]>([]);
	let currentPage = $state(1);
	let totalPages = $state(1);
	let totalCount = $state(0);
	let hasMorePages = $derived(currentPage < totalPages);
	let loading = $state(false);
	let loadingMore = $state(false);
	let initialLoading = $state(true);
	let errors = $state<AppError[]>([]);
	let errorData = $derived(createPageErrorData(errors));
	
	async function loadCellData(page: number = 1, triggerGlobalLoading: boolean = true) {
		// Only trigger global loading state when explicitly requested
		if (triggerGlobalLoading) {
			loadingState.startLoading();
		}
		
		try {
			// Parse period to get start and end years
			const [startYear, endYear] = period.split('_').map(y => parseInt(y));
			
			// Build params for API call
			const params = {
				min_lat: bounds?.minLat,
				min_lon: bounds?.minLon,
				max_lat: bounds?.maxLat,
				max_lon: bounds?.maxLon,
				start_year: `${startYear}-01-01`,
				end_year: `${endYear}-01-01`,
				page,
				recordTypes: recordTypes,
				tags: tags,
			};
						
			const response = await fetchGeodataFromDatabase(params);
			
		//	console.log('📊 CellView API response:', {
		//		cellId,
		//		recordTypes,
		//		page,
		//		totalReturned: response.data?.length || 0,
		//		totalCount: response.total || 0,
		//		responseMetadata: {
		//			page: response.page,
		//			pageSize: response.page_size,
		//			totalPages: response.total_pages,
		//			returned: response.returned
		//		}
		//	});
			
			if (page === 1) {
				// Initial load - replace all features
				allFeatures = response.data || [];
				currentPage = response.page || 1;
				totalPages = response.total_pages || 1;
				totalCount = response.total || 0;
			} else {
				// Load more - append to existing features
				allFeatures = [...allFeatures, ...(response.data || [])];
				currentPage = response.page || currentPage + 1;
				totalPages = response.total_pages || totalPages;
				totalCount = response.total || totalCount;
			}
			
			// Clear previous errors on successful load
			errors = [];
			
		} catch (err) {
			console.error('Error loading cell data:', err);
			errors = [createError(
				'error',
				'Cell Data Load Failed',
				err instanceof Error ? err.message : 'Failed to load cell data',
				{ cellId, period, page, recordTypes, tags }
			)];
		} finally {
			// Stop global loading state when explicitly requested
			if (triggerGlobalLoading) {
				loadingState.stopLoading();
			}
		}
	}
	
	async function loadMore() {
		if (loadingMore || !hasMorePages) return;
		loadingMore = true;
		
		try {
			await loadCellData(currentPage + 1, true); // true = trigger global loading
		} finally {
			loadingMore = false;
		}
	}
	
	// Watch for prop changes and reload data when cellId or period changes
	$effect(() => {
		// Reset state when cellId or period changes
		allFeatures = [];
		currentPage = 1;
		totalPages = 1;
		totalCount = 0;
		errors = [];
		initialLoading = true;
		
		// Load new data
		loadCellData(1).finally(() => {
			initialLoading = false;
		});
	});
	
	function closeModal() {
		if (onClose) {
			// Use the passed close handler
			onClose();
		}
	}
</script>

<ErrorHandler errorData={errorData} />

{#if initialLoading}
	<div class="w-full flex justify-between">
		<div>
			<h2>
				<span>
					<span class="font-bold">Cell</span>
					{cellId}
				</span>
				<span class="block">
					<span class="font-bold">Period</span>
					{formatDate(period)}
				</span>
				{#if bounds}
					<span class="block text-sm text-gray-600">
						Lat: {bounds.minLat.toFixed(4)} - {bounds.maxLat.toFixed(4)}<br/>
						Lon: {bounds.minLon.toFixed(4)} - {bounds.maxLon.toFixed(4)}
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
	<div class="text-gray-500">Loading cell data...</div>
{:else}
	<div class="w-full flex justify-between">
		<div>
			<h2>
				<span>
					<span class="font-bold">Cell</span>
					{cellId}
				</span>
				<span class="block">
					<span class="font-bold">Period</span>
					{formatDate(period)}
				</span>
				{#if bounds}
					<span class="block text-sm text-gray-600">
						Lat: {bounds.minLat.toFixed(4)} - {bounds.maxLat.toFixed(4)}<br/>
						Lon: {bounds.minLon.toFixed(4)} - {bounds.maxLon.toFixed(4)}
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
		<FeaturesLayout features={allFeatures} />
		{#if hasMorePages}
			<button
				onclick={loadMore}
				disabled={loadingMore}
				class="px-2 py-1 text-sm text-black border border-solid border-black"
			>
				{loadingMore ? 'Loading...' : 'Load More'}
			</button>
		{/if}
	{/if}
{/if}
