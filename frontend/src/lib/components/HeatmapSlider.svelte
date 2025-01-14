<!-- HeatmapSlider.svelte -->
<script lang="ts">
    import { Slider } from "bits-ui";
    import type { Heatmap } from '@atm/shared-types';

    export let heatmaps: Heatmap[];
    export let value = [0];
</script>

<div class="w-full px-4 py-2">
    <Slider.Root
        min={0}
        max={heatmaps.length - 1}
        step={1}
        bind:value
        let:ticks
        let:thumbs
        class="relative flex w-full touch-none select-none items-center"
    >
        <span class="relative h-2 w-full grow overflow-hidden rounded-full bg-dark-10">
            <Slider.Range class="absolute h-full bg-foreground" />
        </span>

        {#each thumbs as thumb}
            <Slider.Thumb
                {thumb}
                class="block h-5 w-5 cursor-pointer rounded-full border border-border-input bg-background shadow transition-colors hover:border-dark-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:bg-foreground"
            />
        {/each}

        {#each ticks as tick, i}
            <div class="absolute -translate-x-1/2" style="left: {tick.position}%">
                <Slider.Tick
                    {tick}
                    class="h-2 w-0.5 bg-gray-300"
                />
                <div class="mt-4 text-xs text-gray-500 whitespace-nowrap">
                    {heatmaps[i].period}
                </div>
            </div>
        {/each}
    </Slider.Root>
</div>
