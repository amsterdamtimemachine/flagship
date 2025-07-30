<script lang="ts">
	import type { HistogramBin } from '@atm/shared/types';

	interface Props {
		bins: HistogramBin[];
		maxCount: number;
		timelineHeight: number;
	}
	let { bins, maxCount, timelineHeight }: Props = $props();

	// Calculate histogram bar heights (normalized to max height)
	function getBarHeight(count: number, maxCount: number, minHeight: number = 2): number {
		if (count === 0 || maxCount === 0) return 0;
		const normalizedHeight = (count / maxCount) * 40;
		return Math.max(normalizedHeight, minHeight);
	}
</script>

<svg class="absolute inset-x-0 top-0 w-full h-full pointer-events-none">
	<!-- Histogram bars -->
	{#each bins as bin, i}
		{@const barWidth = 100 / bins.length}
		{@const barHeight = getBarHeight(bin.count, maxCount)}
		{@const x = (i / bins.length) * 100}
		<rect
			x="{x}%"
			y={timelineHeight - barHeight}
			width="{barWidth}%"
			height={barHeight}
			fill="#5373cf"
			class="transition-colors duration-200"
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
			stroke-width="1"
			transform={i === 0
				? 'translate(0.5, 0)'
				: i === bins.length
					? 'translate(-0.5, 0)'
					: ''}
		/>
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
