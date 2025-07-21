<script lang="ts">
	import type { HistogramBin } from '@atm/shared/types';

	interface Props {
		currentIndex: number;
		totalBins: number;
		isDragging: boolean;
		onDragStart: (event: MouseEvent) => void;
		timelineHeight: number;
		bins: HistogramBin[];
	}
	let { currentIndex, totalBins, isDragging, onDragStart, timelineHeight, bins }: Props = $props();

	// Thumb position and width calculations
	const thumbPosition = $derived(() => {
		if (totalBins <= 1) return 0;
		return (currentIndex / totalBins) * 100;
	});
	
	const thumbWidth = $derived(() => {
		if (totalBins <= 1) return 100;
		return 100 / totalBins;
	});

	const currentBin = $derived(() => bins[currentIndex]);
</script>

<div
	class="absolute z-10 cursor-grab bg-transparent border-2 border-red-500 rounded hover:bg-red-400/20 transition-colors duration-200"
	class:cursor-grabbing={isDragging}
	style="left: {thumbPosition()}%; width: {thumbWidth()}%; height: {timelineHeight}px; top: 0;"
	onmousedown={onDragStart}
	role="button"
	tabindex="0"
	aria-label="Drag to change time period"
	title="Current period: {currentBin?.timeSlice?.label || ''}"
></div>