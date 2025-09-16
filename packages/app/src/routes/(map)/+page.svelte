<!-- (map)/+page.svelte -->
<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { onNavigate, afterNavigate } from '$app/navigation';
	import { createMapController } from '$state/MapController.svelte';
	import { createPageErrorData } from '$utils/error';
	import { mergeHeatmapTimeline, mergeHeatmaps } from '$utils/heatmap';
	import { mergeHistograms } from '$utils/histogram';
	import { loadingState } from '$lib/state/loadingState.svelte';
	import { QuestionMark } from 'phosphor-svelte';
	import ButtonLink from '$components/ButtonLink.svelte';
	import Map from '$components/Map.svelte';
	import TimePeriodSelector from '$components/TimePeriodSelector.svelte';
	import ToggleGroup from '$components/ToggleGroup.svelte';
	import TagsSelector from '$components/TagsSelector.svelte';
	import Tag from '$components/Tag.svelte';
	import Tooltip from '$components/Tooltip.svelte';
	import TagOperatorSwitch from '$components/TagOperatorSwitch.svelte';
	import FeaturesPanel from '$components/FeaturesPanel.svelte';
	import NavContainer from '$components/NavContainer.svelte';
	import FiltersStatusPanel from '$components/FiltersStatusPanel.svelte';
	import ErrorHandler from '$components/ErrorHandler.svelte';
	import FeatureDetailModal from '$components/FeatureDetailModal.svelte';
	import type { PageData } from './$types';
import type { HeatmapTimelineApiResponse, HistogramApiResponse, HeatmapTimeline } from '@atm/shared/types';

	let { data }: { data: PageData } = $props();

	// Derived data from server
	let dimensions = $derived(data?.metadata?.heatmapDimensions);
	let recordTypes = $derived(data?.metadata?.recordTypes || []);
	let tags = $derived(data?.metadata?.tags);
	let availableTagNames = $derived(
		data?.availableTags?.tags?.map((tag: { name: string }) => tag.name) || data?.metadata?.tags || []
	);
	let heatmapTimeline = $derived((data?.heatmapTimeline as HeatmapTimelineApiResponse | null)?.heatmapTimeline);
	let heatmapBlueprint = $derived(data?.metadata?.heatmapBlueprint?.cells);
	let currentRecordTypes = $derived(data?.currentRecordTypes || []);
	let currentTags = $derived(data?.currentTags || []);
	let currentTagOperator = $derived(data?.currentTagOperator || 'OR');
	let histograms = $derived((data?.histogram as HistogramApiResponse | null)?.histograms);

	const controller = createMapController();
	let currentPeriod = $derived(controller.currentPeriod);
	let selectedCellId = $derived(controller.selectedCellId);
	let selectedCellBounds = $derived(controller.selectedCellBounds);
	let showCellModal = $derived(controller.showCellModal);

	// Navigation state
	let navExpanded = $state(true);

	// Combine server errors with controller errors for ErrorHandler
	let allErrors = $derived.by(() => {
		const serverErrors = data.errorData?.errors || [];
		const controllerErrors = controller.errors || [];
		return createPageErrorData([...serverErrors, ...controllerErrors]);
	});

	let mergedHeatmapTimeline = $derived.by(() => {
		if (heatmapTimeline && currentRecordTypes && recordTypes) {
			const timelineData = heatmapTimeline?.heatmapTimeline || heatmapTimeline;

			const needsMerging =
				currentRecordTypes.length > 1 || (currentTags && currentTags.length > 0);

			if (needsMerging) {
				// For OR operations with multiple tags, server already merged - just merge recordTypes if needed
				if (currentTagOperator === 'OR' && currentTags && currentTags.length > 1) {
					// OR operations: server already merged tags into base heatmaps, only merge recordTypes if needed
					if (currentRecordTypes.length > 1) {
						return mergeHeatmapTimeline(
							timelineData as unknown as HeatmapTimeline,
							currentRecordTypes,
							undefined, // Don't pass tags - use base heatmaps
							data?.metadata?.heatmapBlueprint
						);
					} else {
						// Single recordType with OR tags - use as-is (server already merged)
						return timelineData;
					}
				} else {
					// AND operations or single tag - use original client-side merging logic
					const selectedTags = currentTags && currentTags.length > 0 ? currentTags : undefined;
					return mergeHeatmapTimeline(
						timelineData as unknown as HeatmapTimeline,
						currentRecordTypes,
						selectedTags,
						data?.metadata?.heatmapBlueprint
					);
				}
			} else {
				// Single recordType, no tags - use original timeline
				return timelineData;
			}
		}
		return null;
	});

	let mergedHistogram = $derived.by(() => {
		if (histograms && currentRecordTypes && recordTypes) {
			// Determine selected tags if any
			const selectedTags = currentTags && currentTags.length > 0 ? currentTags : undefined;

			// Collect histograms to merge
			const histogramsToMerge = [];

			for (const recordType of currentRecordTypes) {
				const recordTypeData = histograms[recordType];
				if (recordTypeData) {
					// For OR operations with multiple tags, server already merged - use base histograms
					if (currentTagOperator === 'OR' && selectedTags && selectedTags.length > 1) {
						// OR operations: server already merged tags into base histograms
						if (recordTypeData.base) {
							histogramsToMerge.push(recordTypeData.base);
						}
					} else if (selectedTags && selectedTags.length > 0) {
						// AND operations or single tag - use original logic
						const tagKey =
							selectedTags.length > 1 ? selectedTags.sort().join('+') : selectedTags[0];
						if (recordTypeData.tags[tagKey]) {
							histogramsToMerge.push(recordTypeData.tags[tagKey]);
						}
					} else if (recordTypeData.base) {
						// Use base histogram
						histogramsToMerge.push(recordTypeData.base);
					}
				}
			}

			if (histogramsToMerge.length === 0) {
				return null;
			}

			// Merge histograms on client side
			return mergeHistograms(histogramsToMerge);
		}
		return null;
	});

	let currentHeatmap = $derived.by(() => {
		if (mergedHeatmapTimeline && currentPeriod) {
			const timeSliceData = (mergedHeatmapTimeline as any)[currentPeriod];
			if (timeSliceData) {
				const mergedKey = Object.keys(timeSliceData)[0];
				return timeSliceData[mergedKey]?.base || null;
			}
		}

		// Return empty heatmap when no data exists for this period
		// This keeps the map visible with all cells at 0 density
		if (heatmapBlueprint && dimensions) {
			const gridSize = dimensions.colsAmount * dimensions.rowsAmount;
			return {
				countArray: new Array(gridSize).fill(0),
				densityArray: new Array(gridSize).fill(0)
			};
		}

		return null;
	});

	onMount(() => {
		// Initialize controller with period from URL or first available time period
		const urlParams = new URLSearchParams(window.location.search);
		const periodFromUrl = urlParams.get('period');
		const firstPeriod = mergedHistogram?.bins?.[0]?.timeSlice?.key;

		// Use period from URL if valid, otherwise fall back to first period
		let initialPeriod = firstPeriod || '';
		if (
			periodFromUrl &&
			mergedHistogram?.bins?.some((bin) => bin.timeSlice.key === periodFromUrl)
		) {
			initialPeriod = periodFromUrl;
		}

		// Fallback to first heatmap period if histogram doesn't have data
		if (!initialPeriod && mergedHeatmapTimeline) {
			const heatmapPeriods = Object.keys(mergedHeatmapTimeline);
			if (heatmapPeriods.length > 0) {
				initialPeriod = heatmapPeriods[0];
			}
		}
		controller.initialize(initialPeriod);

		// Sync URL parameters after router is ready
		tick().then(() => {
			controller.syncUrlParameters(initialPeriod, currentTagOperator, currentRecordTypes);

			// Handle cell bounds lookup from URL if cell parameter exists
			const urlParams = new URLSearchParams(window.location.search);
			const cellParam = urlParams.get('cell');
			if (cellParam && heatmapBlueprint) {
				const cell = heatmapBlueprint.find((c) => c.cellId === cellParam);
				if (cell?.bounds) {
					// Update controller with bounds for the cell from URL
					controller.selectCell(cellParam, {
						minLat: cell.bounds.minLat,
						maxLat: cell.bounds.maxLat,
						minLon: cell.bounds.minLon,
						maxLon: cell.bounds.maxLon
					});
				}
			}
		});
	});

	function handlePeriodChange(period: string) {
		controller.setPeriod(period);
	}

	function handleRecordTypeChange(recordTypes: string[] | string) {
		const recordTypesArray = Array.isArray(recordTypes) ? recordTypes : [recordTypes];
		controller.setRecordType(recordTypesArray, { resetTags: true });
	}

	function handleTagsChange(tags: string | string[]) {
		const tagArray = Array.isArray(tags) ? tags : [tags];
		controller.setTags(tagArray);
	}

	function handleTagOperatorChange(operator: 'AND' | 'OR') {
		controller.setTagOperator(operator, { resetTags: true });
	}

	// Handle cell selection from map
	function handleCellClick(cellId: string | null) {
		if (cellId && heatmapBlueprint) {
			// Find the cell bounds from the blueprint
			const cell = heatmapBlueprint.find((c) => c.cellId === cellId);
			if (cell?.bounds) {
				controller.selectCell(cellId, {
					minLat: cell.bounds.minLat,
					maxLat: cell.bounds.maxLat,
					minLon: cell.bounds.minLon,
					maxLon: cell.bounds.maxLon
				});
			} else {
				controller.selectCell(cellId);
			}
		} else {
			controller.selectCell(null);
		}
	}

	function handleFeaturesPanelClose() {
		controller.clearErrors();
		controller.selectCell(null);
	}
</script>

<ErrorHandler errorData={allErrors} />

<div class="relative flex flex-col w-screen h-screen">
	<div class="relative flex-1">
		{#if currentHeatmap && heatmapBlueprint && dimensions}
			<Map
				heatmap={currentHeatmap}
				{heatmapBlueprint}
				{dimensions}
				{selectedCellId}
				{handleCellClick}
			/>
		{/if}

		<NavContainer bind:isExpanded={navExpanded} class="absolute top-0 left-0 z-30">
			<nav class="bg-atm-sand flex items-center justify-between h-[50px] p-3 border-b border-atm-sand-border">
				<h1 class="font-sans">Amsterdam Time Machine</h1>
				<ButtonLink target='' rel='' href='/about'> About </ButtonLink>
			
			</nav>
			<div class="p-3">
				<div class="mb-4">
					<div class="flex">
						<h2 class="mb-2 pr-1">Content type</h2>
						<Tooltip icon={QuestionMark} text="this is a tooltip test!" placement="bottom" />
					</div>

					<ToggleGroup
						items={recordTypes}
						selectedItems={currentRecordTypes}
						onItemSelected={handleRecordTypeChange}
						requireOneItemSelected={true}>
						{#snippet children(item, isSelected, isDisabled)}
							<Tag variant={isSelected ? 'selected-outline' : 'outline'} disabled={isDisabled}>
								{item}
							</Tag>
						{/snippet}
					</ToggleGroup>
				</div>

				<div class="mb-4">
					<div class="flex">
						<h2 class="pr-1">Topics</h2>
						<Tooltip icon={QuestionMark} text="this is a tooltip test!" placement="bottom" />
					</div>
					<div class="flex items-center justify-between mb-3">
						<span class="text-xs text-neutral-600">
							{currentTagOperator === 'AND' ? 'Include only content with all selected topics' : 'Include content with any selected topics'}
						</span>
						<TagOperatorSwitch 
							operator={currentTagOperator as 'AND' | 'OR'}
							onOperatorChange={handleTagOperatorChange}
						/>
					</div>
				</div>

				{#if currentTagOperator === 'AND'}
					<TagsSelector
						recordTypes={currentRecordTypes || []}
						allRecordTypes={recordTypes}
						availableTags={availableTagNames}
						selectedTags={currentTags || []}
						onTagsSelected={handleTagsChange}
					/>
				{:else}
					<ToggleGroup
						items={availableTagNames}
						selectedItems={currentTags || []}
						onItemSelected={handleTagsChange}
						requireOneItemSelected={false}>
						{#snippet children(item, isSelected, isDisabled)}
							<Tag variant={isSelected ? 'selected-outline' : 'outline'} disabled={isDisabled}>
								{item}
							</Tag>
						{/snippet}
					</ToggleGroup>
				{/if}
			</div>
		</NavContainer>

	<!-- Show filters status when nav is collapsed -->
	{#if !navExpanded}
		<FiltersStatusPanel
			selectedRecordTypes={currentRecordTypes}
			allRecordTypes={recordTypes}
			selectedTags={currentTags}
			class="absolute top-3 left-3"
		/>
	{/if}

		{#if showCellModal && selectedCellId}
			<div
				class="z-30 absolute top-0 right-0 w-1/2 h-full bg-atm-sand overflow-y-auto border-l border-solid border-gray-300 shadow-[-5px_0px_20px_5px_rgba(0,0,0,0.07)]"
			>
				<FeaturesPanel
					cellId={selectedCellId}
					period={currentPeriod}
					bounds={selectedCellBounds ?? undefined}
					recordTypes={currentRecordTypes}
					tags={currentTags}
					tagOperator={currentTagOperator as 'AND' | 'OR'}
					onClose={handleFeaturesPanelClose}
				/>
			</div>
		{/if}
	</div>

	{#if mergedHistogram}
		<TimePeriodSelector
			period={currentPeriod}
			histogram={mergedHistogram}
			onPeriodChange={handlePeriodChange}
			class="z-40 bg-atm-sand border-t border-atm-sand-border"
		/>
	{/if}

	<FeatureDetailModal />
</div>
