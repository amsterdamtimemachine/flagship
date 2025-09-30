<script lang="ts">
	import type { HistogramBin } from '@atm/shared/types';
	import { calculateHistogramBarHeights } from '$lib/utils/histogram';

	interface Props {
		bins: HistogramBin[];
		maxCount: number;
		timelineHeight: number;
	}
	let { bins, maxCount, timelineHeight }: Props = $props();

	// Calculate bar heights using logarithmic scaling with global maxCount
	const barHeights = $derived(bins && bins.length > 0 ? calculateHistogramBarHeights(bins, maxCount, timelineHeight, 1) : []);
</script>

<svg class="absolute top-0 w-full h-full pointer-events-none">
	<!-- Histogram bars -->
	{#each bins as bin, i}
		{@const barWidth = 100 / bins.length}
		{@const barHeight = barHeights[i]}
		{@const x = (i / bins.length) * 100}
		<rect
			x="{x}%"
			y={timelineHeight - barHeight}
			width="{barWidth}%"
			height={barHeight}
			class="fill-atm-blue"
			fill="#5480f1"
		>
			<title>Period: {bin.timeSlice.label}, Count: {bin.count}</title>
		</rect>
	{/each}

	<!-- Ticks at period boundaries -->
	{#each Array(bins.length + 1) as _, i}
		{@const position = (i / bins.length) * 100}
		<line
			x1="{position}%"
			y1="0"
			x2="{position}%"
			y2={timelineHeight}
			stroke="black"
			stroke-width="0.5"
			transform={i === 0 ? 'translate(0.5, 0)' : i === bins.length ? 'translate(-0.5, 0)' : ''}
		/>
	{/each}

	<!-- Track line -->
	<line
		x1="0%"
		y1={timelineHeight}
		x2="100%"
		y2={timelineHeight}
		stroke="black"
		stroke-width="0.5"
	/>
</svg>
