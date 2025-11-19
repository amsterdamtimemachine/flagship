<script lang="ts">
	interface Props {
		displayPeriods: string[];
		timelineHeight: number;
	}
	let { displayPeriods, timelineHeight }: Props = $props();
</script>

<svg class="absolute w-full h-full pointer-events-none">
	<!-- Year labels -->
	{#each displayPeriods as period, i}
		{@const position = (i / (displayPeriods.length - 1)) * 100}
		{@const isLastPeriod = i === displayPeriods.length - 1}
		{@const displayLabel = isLastPeriod ? 'Nu' : period}
		<text
			x="{position}%"
			y={timelineHeight + 18}
			fill="black"
			text-anchor={i === 0 ? 'start' : i === displayPeriods.length - 1 ? 'end' : 'middle'}
			class="font-medium text-base"
		>
			{displayLabel}
		</text>
	{/each}
</svg>
