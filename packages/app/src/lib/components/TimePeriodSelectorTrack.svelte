<script lang="ts">
	import type { HistogramBin } from '@atm/shared/types';

	interface Props {
		bins: HistogramBin[];
		currentIndex: number;
		onIndexChange: (newIndex: number) => void;
		timelineHeight: number;
		onKeyDown?: (event: KeyboardEvent) => void;
	}
	let { bins, currentIndex, onIndexChange, timelineHeight, onKeyDown }: Props = $props();

	let trackElement: HTMLDivElement | undefined = $state();

	function handleTrackClick(event: MouseEvent) {
		if (!trackElement) return;

		const rect = trackElement.getBoundingClientRect();
		const clickX = event.clientX - rect.left;
		const percentage = clickX / rect.width;
		const newIndex = Math.round(percentage * (bins.length - 1));

		onIndexChange(Math.max(0, Math.min(bins.length - 1, newIndex)));
	}
</script>

<div
	bind:this={trackElement}
	class="absolute inset-x-0 cursor-pointer"
	style="top: 0; height: {timelineHeight}px;"
	onclick={handleTrackClick}
	role="slider"
	tabindex="0"
	aria-label="Time period selector"
	aria-valuemin="0"
	aria-valuemax={bins.length - 1}
	aria-valuenow={currentIndex}
	aria-valuetext={bins[currentIndex]?.timeSlice?.label || ''}
	onkeydown={onKeyDown}
>
	<!-- Clickable areas for each period -->
	{#each bins as bin, i}
		{@const barWidth = 100 / bins.length}
		{@const x = (i / bins.length) * 100}
		<button
			class="absolute h-full bg-transparent hover:bg-blue-200/30 transition-colors duration-200 cursor-pointer"
			style="left: {x}%; width: {barWidth}%;"
			onclick={(e) => {
				e.stopPropagation();
				onIndexChange(i);
			}}
			aria-label="Select period {bin.timeSlice.label}"
			title="Period: {bin.timeSlice.label}, Count: {bin.count}"
		></button>
	{/each}
</div>
