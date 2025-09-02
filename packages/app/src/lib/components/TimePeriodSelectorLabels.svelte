<script lang="ts">
	interface Props {
		displayPeriods: string[];
		timelineHeight: number;
	}
	let { displayPeriods, timelineHeight }: Props = $props();
</script>

<svg class="absolute inset-x-0 top-0 w-full h-full pointer-events-none">
	<!-- Year labels -->
	{#each displayPeriods as period, i}
		{@const position = (i / (displayPeriods.length - 1)) * 100}
		<text
			x="{position}%"
			y={timelineHeight + 18}
			font-size="15"
			fill="black"
			text-anchor={i === 0 ? 'start' : i === displayPeriods.length - 1 ? 'end' : 'middle'}
			class="font-sans"
		>
			{period}
		</text>
	{/each}
</svg>
