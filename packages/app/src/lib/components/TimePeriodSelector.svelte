<script lang="ts">
	import type { Histogram } from '@atm/shared/types';
	import { Slider } from 'melt/builders';

	interface Props {
		histogram: Histogram;
		period?: string;
		onPeriodChange?: (newPeriod: string) => void;
	}
	let { histogram, period = undefined, onPeriodChange = undefined,  }: Props = $props();

	// Extract time period keys from new histogram structure
	const timePeriods = $derived(histogram?.bins?.map((bin) => bin.timeSlice.key) || []);
	const displayPeriods = $derived(createDisplayPeriods(histogram?.bins || []));
	const thumbScaleFactor = $derived((histogram.bins.length - 1) / histogram.bins.length);
	const thumbOffset = $derived((100 / histogram.bins.length - 1) / 2);
	const thumbWidth = $derived(100 / histogram.bins.length);
	const timelineHeight = 26;

	const slider = $derived(
		new Slider({
			value: getInitialIndex(),
			onValueChange: (newIndex) => {
				if (
					onPeriodChange &&
					timePeriods.length > 0 &&
					newIndex >= 0 &&
					newIndex < timePeriods.length
				) {
					const periodValue = timePeriods[newIndex];
					onPeriodChange(periodValue);
				}
			},
			min: 0,
			max: Math.max(0, histogram.bins.length - 1),
			step: 1,
			orientation: 'horizontal'
		})
	);

	function createDisplayPeriods(bins: any[]): string[] {
		if (!bins.length) return [];
		
		// Extract start years from TimeSlice objects
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


	// Calculate histogram bar heights (normalized to max height)
	function getBarHeight(count: number, maxCount: number, minHeight: number = 2): number {
		if (count === 0 || maxCount === 0) return 0;
		const normalizedHeight = (count / maxCount) * 40;
		return Math.max(normalizedHeight, minHeight);
	}
</script>

{#if histogram?.bins?.length > 0}
	<div class="w-full px-4 pb-1 pt-4">
		<div {...slider.root} class="w-full relative h-[60px]">
			<svg class="absolute inset-x-0 top-0 w-full h-full pointer-events-none">
				<!-- Histogram bars -->
				{#each histogram.bins as bin, i}
					{@const barWidth = 100 / histogram.bins.length}
					{@const barHeight = getBarHeight(bin.count, histogram.maxCount)}
					{@const x = (i / histogram.bins.length) * 100}
					<rect
						x="{x}%"
						y={timelineHeight - barHeight}
						width="{barWidth}%"together
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

					<!-- Tick year -->
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

				<!-- Track -->
				<line
					x1="0%"
					y1={timelineHeight}
					x2="100%"
					y2={timelineHeight}
					stroke="black"
					stroke-width="1"
				/>
			</svg>

			<!-- Thumb-->
			<span
				{...slider.thumb}
				class="absolute cursor-pointer z-10 outline outline-[6px] outline-red-500 rounded"
				style="left: calc(var(--percentage) * {thumbScaleFactor} + 1px); width: calc({thumbWidth}% - 2px); height: {timelineHeight}px;"
			>
			</span>
		</div>
	</div>
{/if}
