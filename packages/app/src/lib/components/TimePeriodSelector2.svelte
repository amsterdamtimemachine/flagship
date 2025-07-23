<script lang="ts">
	import type { Histogram } from '@atm/shared/types';

	interface Props {
		histogram: Histogram;
		period?: string;
		onPeriodChange?: (newPeriod: string) => void;
	}
	let { histogram, period = undefined, onPeriodChange = undefined }: Props = $props();

	// Extract time period data
	const timePeriods = $derived(histogram?.bins?.map((bin) => bin.timeSlice.key) || []);
	const displayPeriods = $derived(createDisplayPeriods(histogram?.bins || []));
	const timelineHeight = 26;

	// Slider state
	let currentIndex = $state(getInitialIndex());
	let isDragging = $state(false);
	let sliderElement: HTMLDivElement | undefined = $state();

	// Update currentIndex when period prop changes
	$effect(() => {
		if (period && timePeriods.length > 0) {
			const index = timePeriods.indexOf(period);
			if (index >= 0 && index !== currentIndex) {
				currentIndex = index;
			}
		}
	});

	// Thumb position and width calculations
	const thumbPosition = $derived(() => {
		if (timePeriods.length <= 1) return 0;
		return (currentIndex / timePeriods.length) * 100;
	});
	
	const thumbWidth = $derived(() => {
		if (timePeriods.length <= 1) return 100;
		return 100 / timePeriods.length;
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

	function handlePeriodChange(newIndex: number) {
		if (newIndex >= 0 && newIndex < timePeriods.length && onPeriodChange) {
			currentIndex = newIndex;
			const periodValue = timePeriods[newIndex];
			onPeriodChange(periodValue);
		}
	}

	function handleTrackClick(event: MouseEvent) {
		if (!sliderElement) return;
		
		const rect = sliderElement.getBoundingClientRect();
		const clickX = event.clientX - rect.left;
		const percentage = clickX / rect.width;
		const newIndex = Math.round(percentage * (timePeriods.length - 1));
		
		handlePeriodChange(Math.max(0, Math.min(timePeriods.length - 1, newIndex)));
	}

	function handleMouseDown(event: MouseEvent) {
		isDragging = true;
		event.preventDefault();
	}

	function handleMouseMove(event: MouseEvent) {
		if (!isDragging || !sliderElement) return;
		
		const rect = sliderElement.getBoundingClientRect();
		const dragX = event.clientX - rect.left;
		const percentage = Math.max(0, Math.min(1, dragX / rect.width));
		const newIndex = Math.round(percentage * (timePeriods.length - 1));
		
		handlePeriodChange(newIndex);
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
		handlePeriodChange(newIndex);
	}

	// Calculate histogram bar heights (normalized to max height)
	function getBarHeight(count: number, maxCount: number, minHeight: number = 2): number {
		if (count === 0 || maxCount === 0) return 0;
		const normalizedHeight = (count / maxCount) * 40;
		return Math.max(normalizedHeight, minHeight);
	}
</script>

<!-- Global mouse events for drag behavior -->
<svelte:document onmousemove={handleMouseMove} onmouseup={handleMouseUp} />

{#if histogram?.bins?.length > 0}
	<div class="w-full px-4 pb-1 pt-4">
		<div class="w-full relative h-[60px]">
			<!-- Histogram bars (non-interactive, visual only) -->
			<svg class="absolute inset-x-0 top-0 w-full h-full pointer-events-none">
				{#each histogram.bins as bin, i}
					{@const barWidth = 100 / histogram.bins.length}
					{@const barHeight = getBarHeight(bin.count, histogram.maxCount)}
					{@const x = (i / histogram.bins.length) * 100}
					<rect
						x="{x}%"
						y={timelineHeight - barHeight}
						width="{barWidth}%"
						height={barHeight}
						fill="#60a5fa"
						class="transition-colors duration-200"
					>
						<title>Period: {bin.timeSlice.label}, Count: {bin.count}</title>
					</rect>
				{/each}

				<!-- Ticks at period boundaries -->
				{#each Array(histogram.bins.length + 1) as _, i}
					{@const position = (i / histogram.bins.length) * 100}
					<line
						x1="{position}%"
						y1="0"
						x2="{position}%"
						y2={timelineHeight}
						stroke="black"
						stroke-width="1"
						transform={i === 0
							? 'translate(0.5, 0)'
							: i === histogram.bins.length
								? 'translate(-0.5, 0)'
								: ''}
					/>

					<!-- Tick labels -->
					{#if i < displayPeriods.length}
						<text
							x="{position}%"
							y={timelineHeight + 24}
							font-size="16"
							fill="black"
							text-anchor={i === 0 ? 'start' : i === histogram.bins.length ? 'end' : 'middle'}
							class="pointer-events-auto font-sans"
						>
							{displayPeriods[i]}
						</text>
					{/if}
				{/each}

				<!-- Track line -->
				<line
					x1="0%"
					y1={timelineHeight}
					x2="100%"
					y2={timelineHeight}
					stroke="black"
					stroke-width="1"
				/>
			</svg>

			<!-- Interactive slider track -->
			<div
				bind:this={sliderElement}
				class="absolute inset-x-0 cursor-pointer"
				style="top: {timelineHeight - 10}px; height: 20px;"
				onclick={handleTrackClick}
				role="slider"
				tabindex="0"
				aria-label="Time period selector"
				aria-valuemin="0"
				aria-valuemax={timePeriods.length - 1}
				aria-valuenow={currentIndex}
				aria-valuetext={histogram.bins[currentIndex]?.timeSlice?.label || ''}
				onkeydown={handleKeyDown}
			>
				<!-- Clickable areas for each period -->
				{#each histogram.bins as bin, i}
					{@const barWidth = 100 / histogram.bins.length}
					{@const x = (i / histogram.bins.length) * 100}
					<button
						class="absolute h-full bg-transparent hover:bg-blue-200/30 transition-colors duration-200 cursor-pointer"
						style="left: {x}%; width: {barWidth}%;"
						onclick={(e) => {
							e.stopPropagation();
							handlePeriodChange(i);
						}}
						aria-label="Select period {bin.timeSlice.label}"
						title="Period: {bin.timeSlice.label}, Count: {bin.count}"
					></button>
				{/each}

				<!-- Thumb -->
				<div
					class="absolute z-10 cursor-grab bg-transparent border-2 border-red-500 rounded hover:bg-red-400/20 transition-colors duration-200"
					class:cursor-grabbing={isDragging}
					style="left: {thumbPosition()}%; width: {thumbWidth()}%; height: {timelineHeight}px; top: 0;"
					onmousedown={handleMouseDown}
					role="button"
					tabindex="0"
					aria-label="Drag to change time period"
					title="Current period: {histogram.bins[currentIndex]?.timeSlice?.label || ''}"
				></div>
			</div>
		</div>
	</div>
{/if}
