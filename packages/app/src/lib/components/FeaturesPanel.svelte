<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import FeaturesGrid from '$components/FeaturesGrid.svelte';
	import Pagination from '$components/Pagination.svelte';
	import PaginationCounter from '$components/PaginationCounter.svelte';
	import { fetchGeodataFromDatabase } from '$utils/externalApi';
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
	let totalCount = $state(0);
	let pageSize = $state(100); // From API response
	let loading = $state(false);
	let initialLoading = $state(true);
	let errors = $state<AppError[]>([]);
	let errorData = $derived(createPageErrorData(errors));
	
	// Layout memory for stable masonry across pagination
	let layoutMemory = new Map<string, number>(); // featureId -> columnIndex
	let currentContext = $state(''); // Track current data context
	
	/**
	 * Clear layout memory when data context changes
	 */
	function clearLayoutMemory() {
		console.log('🧹 Clearing layout memory - context changed');
		layoutMemory.clear();
	}
	
	async function loadCellData(page: number = 1) {
		loading = true;
		loadingState.startLoading();
		console.log("fetching cell data");
		
		try {
			// Parse period to get start and end years
			const [startYear, endYear] = period.split('_').map(y => parseInt(y));
			
			// Build params for API call - only include bounds if available
			const params: any = {
				start_year: `${startYear}-01-01`,
				end_year: `${endYear}-01-01`,
				page,
				recordTypes: recordTypes,
				tags: tags,
			};
			
			// Only add bounds if they exist
			if (bounds) {
				params.min_lat = bounds.minLat;
				params.min_lon = bounds.minLon;
				params.max_lat = bounds.maxLat;
				params.max_lon = bounds.maxLon;
			}
						
			const response = await fetchGeodataFromDatabase(params);
			
			// Always replace features for pagination (no more appending)
			allFeatures = response.data || [];
			currentPage = response.page || 1;
			totalCount = response.total || 0;
			pageSize = response.page_size || 100;
			
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
			loading = false;
			loadingState.stopLoading();
		}
	}
	
	function handlePageChange(newPage: number) {
		if (loading) return; // Prevent multiple concurrent requests
		loadCellData(newPage);
	}
	
	// Detect context changes and clear memory when needed
	$effect(() => {
		// Create context key from always-available props
		const newContext = `${cellId}_${period}`;
		
		if (currentContext !== newContext) {
			console.log('🔄 Context changed:', { from: currentContext, to: newContext });
			clearLayoutMemory();
			currentContext = newContext;
		}
	});
	
	$effect(() => {
		// Reset state when cellId or period changes
		allFeatures = [];
		currentPage = 1;
		totalCount = 0;
		pageSize = 100;
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

<!-- Data Header -->
<div class="sticky top-0 z-10 bg-white mb-4 pb-2 border-b flex items-center justify-between">
	<div class="text-sm text-gray-700">
		cell: {cellId} | period: {period}
	</div>
	<div class="flex items-center gap-4">
		{#if !initialLoading && totalCount > pageSize}
			<PaginationCounter 
				totalItems={totalCount}
				currentPage={currentPage}
				itemsPerPage={pageSize}
			/>
			<Pagination 
				totalItems={totalCount}
				currentPage={currentPage}
				itemsPerPage={pageSize}
				onPageChange={handlePageChange}
				loading={loading}
			/>
		{/if}
		<button
			onclick={closeModal}
			class="px-2 py-1 text-sm text-black border border-solid border-black"
		>
			close
		</button>
	</div>
</div>

<div class="bg-gray-100 min-h-[200px]">
	{#if initialLoading}
		<div class="text-gray-500 p-4">Loading cell data...</div>
	{:else if allFeatures.length === 0}
		<div class="text-gray-500 p-4">No features found for this cell and period</div>
	{:else}
		<FeaturesGrid features={allFeatures} layoutMemory={layoutMemory} />
	{/if}
</div>
