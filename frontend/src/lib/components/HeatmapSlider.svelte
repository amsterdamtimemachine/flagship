<script lang="ts">
    import { createSlider, melt } from '@melt-ui/svelte';

    export let periods: string[]; // expects periods in the format of "startYear_endYear" eg: ["1500_1700", 1700_1900"]
    export let value = [0];
    export let className = '';

    function createDisplayPeriods(periods: string[]): string[] {
        // If we have no periods, return empty array
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

    const displayPeriods = createDisplayPeriods(periods);

    const {
        elements: { root, range, thumbs, ticks },
        states: { value: sliderValue }
    } = createSlider({
        defaultValue: value,
        min: 0,
        step: 1,
        max: displayPeriods.length - 1,
    });


    // Two-way binding
    $: value = $sliderValue;
    $: if (value !== $sliderValue) {
        sliderValue.set(value);
    }
</script>

<div class="w-full px-4 py-1 {className}">
    <span {...$root} use:melt={$root} class="relative flex w-full h-12 items-center">
        <!--
        <span class="h-2 w-full rounded-full bg-gray-200">
            <span {...$range} use:melt={$range} class="absolute h-full bg-blue-500 rounded-full" />
        </span>
        -->

    <span class="h-2 w-full bg-gray-200"/>
    {#each $ticks as tick, i}
        <span 
            {...tick} 
            use:melt={tick}
            class="absolute h-2 w-0.5 bg-gray-600"
            class:translate-x-0={i === 0}
            class:translate-x-full={i === $ticks.length - 1}
        >
            <span 
                class="absolute top-4 text-xs text-black whitespace-nowrap {getTickTranslateStyle(i, $ticks.length)}"
            >
                {displayPeriods[i]}
            </span>
        </span>
    {/each}

        <span
            {...$thumbs[0]}
            use:melt={$thumbs[0]}
            class="absolute w-5 h-5 bg-white border-2 border-blue-500 rounded-full cursor-pointer shadow-lg focus:ring-2 focus:ring-blue-500/40"
        />
    </span>
</div>
