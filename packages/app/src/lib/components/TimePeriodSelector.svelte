<script lang="ts">
	import type { Histogram } from '@atm/shared/types';
	import { mergeCss } from '$utils/utils';
	import TimePeriodSelectorChart from '$components/TimePeriodSelectorChart.svelte';
	import TimePeriodSelectorLabels from '$components/TimePeriodSelectorLabels.svelte';
	import TimePeriodSelectorThumb from '$components/TimePeriodSelectorThumb.svelte';
	import TimePeriodSelectorTrack from '$components/TimePeriodSelectorTrack.svelte';

	interface Props {
		histogram: Histogram;
		period?: string;
		onPeriodChange?: (newPeriod: string) => void;
		class?: string;
	}
	let {
		histogram,
		period = undefined,
		onPeriodChange = undefined,
		class: className
	}: Props = $props();

	// Extract time period data
	const timePeriods = $derived(histogram?.bins?.map((bin) => bin.timeSlice.key) || []);
	const displayPeriods = $derived(createDisplayPeriods(histogram?.bins || []));
	const timelineHeight = 15;

	// Slider state
	let currentIndex = $state(getInitialIndex());
	let isDragging = $state(false);
	let trackElement: HTMLDivElement | undefined = $state();

	// Update currentIndex when period prop changes
	$effect(() => {
		if (period && timePeriods.length > 0) {
			const index = timePeriods.indexOf(period);
			if (index >= 0 && index !== currentIndex) {
				currentIndex = index;
			}
		}
	});

	function createDisplayPeriods(bins: any[]): string[] {
		if (!bins.length) return [];

		const result = bins.map((bin) => {
			return bin.timeSlice.startYear.toString();
		});

		// Add the end year of the last bin for the final tick
		const lastBin = bins[bins.length - 1];
		if (lastBin?.timeSlice?.endYear) {
			result.push(lastBin.timeSlice.endYear.toString());
		}

		return result;
	}

	function getInitialIndex(): number {
		if (!period || !timePeriods.length) return 0;
		const index = timePeriods.indexOf(period);
		return index >= 0 ? index : 0;
	}

	function handleIndexChange(newIndex: number) {
		if (newIndex >= 0 && newIndex < timePeriods.length && onPeriodChange) {
			currentIndex = newIndex;
			const periodValue = timePeriods[newIndex];
			onPeriodChange(periodValue);
		}
	}

	function handleDragStart(event: MouseEvent) {
		isDragging = true;
		event.preventDefault();
	}

	function handleMouseMove(event: MouseEvent) {
		if (!isDragging || !trackElement) return;

		const rect = trackElement.getBoundingClientRect();
		const dragX = event.clientX - rect.left;
		const percentage = Math.max(0, Math.min(1, dragX / rect.width));
		const newIndex = Math.round(percentage * (timePeriods.length - 1));

		handleIndexChange(newIndex);
	}

	function handleMouseUp() {
		isDragging = false;
	}

	function handleKeyDown(event: KeyboardEvent) {
		let newIndex = currentIndex;

		switch (event.key) {
			case 'ArrowLeft':
			case 'ArrowDown':
				newIndex = Math.max(0, currentIndex - 1);
				break;
			case 'ArrowRight':
			case 'ArrowUp':
				newIndex = Math.min(timePeriods.length - 1, currentIndex + 1);
				break;
			case 'Home':
				newIndex = 0;
				break;
			case 'End':
				newIndex = timePeriods.length - 1;
				break;
			default:
				return;
		}

		event.preventDefault();
		handleIndexChange(newIndex);
	}
</script>

<!-- Global mouse events for drag behavior -->
<svelte:document onmousemove={handleMouseMove} onmouseup={handleMouseUp} />

{#if histogram?.bins?.length > 0}
	<div class={mergeCss('bg-atm-sand border-t border-atm-sand-border w-full px-4 pt-2', className)}>
		<div class="w-full relative h-[40px]" bind:this={trackElement}>
			<!-- Chart Layer: Histogram bars and grid -->
			<TimePeriodSelectorChart
				bins={histogram.bins}
				maxCount={histogram.maxCount}
				{timelineHeight}
			/>

			<!-- Labels Layer: Year labels -->
			<TimePeriodSelectorLabels {displayPeriods} {timelineHeight} />

			<!-- Interactive Layer: Clickable track -->
			<TimePeriodSelectorTrack
				bins={histogram.bins}
				{currentIndex}
				onIndexChange={handleIndexChange}
				{timelineHeight}
				onKeyDown={handleKeyDown}
			/>

			<!-- Thumb Layer: Draggable indicator -->
			<TimePeriodSelectorThumb
				{currentIndex}
				totalBins={histogram.bins.length}
				{isDragging}
				onDragStart={handleDragStart}
				{timelineHeight}
				bins={histogram.bins}
			/>
		</div>
	</div>
{/if}
