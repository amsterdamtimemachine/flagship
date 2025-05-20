<script lang="ts">
	import { run } from 'svelte/legacy';

	import { createSlider, melt } from '@melt-ui/svelte';
	import { formatDate } from '$utils/utils';

	interface Props {
		// expects periods in the format of "startYear_endYear" eg: ["1500_1700", 1700_1900"]
		timePeriods?: string[];
		value?: string | undefined;
	}

	let { timePeriods = [], value = $bindable() }: Props = $props();
	const displayPeriods = createDisplayPeriods(timePeriods);

	const {
		elements: { root, range, thumbs, ticks },
		states: { value: sliderValue }
	} = createSlider({
		defaultValue: [0],
		min: 0,
		step: 1,
		max: displayPeriods.length - 1
	});

	run(() => {
		value = timePeriods[$sliderValue[0]];
	});
	//	$: if (value !== $sliderValue) {
	//		sliderValue.set(value);
	//	}

	function createDisplayPeriods(periods: string[]): string[] {
		if (!periods.length) return [];

		return periods.map((period) => {
			const [start, end] = period.split('_');
			const displayPeriod = `${start} — ${end}`;
			return displayPeriod;
		});
	}

	function getTickTranslateStyle(index: number, total: number): string {
		if (index === 0) return 'translate-x-0';
		if (index === total - 1) return '-translate-x-full';
		return '-translate-x-[50%]';
	}
</script>

{#if displayPeriods.length > 0}
	<div class="w-full px-4 py-1 border-t border-solid border-gray-300">
		<span {...$root} use:melt={$root} class="relative flex w-full h-12 items-center">
			<span class="h-2 w-full bg-gray-200"></span>
			{#each $ticks as tick, i}
				<span
					{...tick}
					use:melt={tick}
					class="absolute h-2 w-[2px] bg-gray-600"
					class:translate-x-0={i === 0}
					class:translate-x-full={i === $ticks.length - 1}
				>
					<span
						class="absolute top-4 text-xs text-black whitespace-nowrap {getTickTranslateStyle(
							i,
							$ticks.length
						)}"
					>
						{displayPeriods[i]}
					</span>
				</span>
			{/each}

			<span
				{...$thumbs[0]}
				use:melt={$thumbs[0]}
				class="absolute w-5 h-5 bg-white border-2 border-blue-500 rounded-full cursor-pointer shadow-lg focus:ring-2 focus:ring-blue-500/40"
			></span>
		</span>
	</div>
{/if}
