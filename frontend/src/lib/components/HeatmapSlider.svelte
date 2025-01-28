
<script lang="ts">
    import { createSlider, melt } from '@melt-ui/svelte';
    import type { Heatmap } from '@atm/shared-types';
    
    export let periods: string[];
    export let heatmaps: Record<string, Heatmap>;
    export let value = [0];
    export let className = '';

    const {
        elements: { root, range, thumbs, ticks },
        states: { value: sliderValue }  // Get the value state store
    } = createSlider({
        defaultValue: value,
        min: 0,
        step: 1,
        max: periods.length - 1,
    });

    // Two-way binding between parent value and slider state
    $: value = $sliderValue;
    $: if (value !== $sliderValue) {
        sliderValue.set(value);
    }

    function calculatePosition(index: number): number {
        return (index / (periods.length - 1)) * 100;
    }
</script>


<div class="w-full px-4 py-2 {className}">
    <div 
        use:melt={$root}
        class="relative flex w-full touch-none select-none items-center h-12"
    >
        <!-- Track -->
        <div class="absolute h-2 w-full rounded-full bg-gray-200">
            <!-- Range -->
            <div 
                use:melt={$range}
                class="absolute h-full bg-blue-500 rounded-full"
            />
        </div>

        <!-- Thumb -->
        <div 
            use:melt={$thumbs[0]}
            class="absolute w-5 h-5 bg-white border-2 border-blue-500 rounded-full cursor-pointer shadow-lg transform -translate-x-1/2 focus:ring-2 focus:ring-blue-500/40"
        />

        <!-- Ticks and Labels -->
        {#each $ticks as tick, index}
            <div 
                class="absolute -translate-x-1/2"
                style="left: {calculatePosition(index)}%"
            >
                <div 
                    use:melt={tick}
                    class="h-2 w-0.5 bg-gray-300" 
                />
                <div class="mt-4 text-xs text-gray-500 whitespace-nowrap">
                    {periods[index]}
                </div>
            </div>
        {/each}
    </div>
</div>
