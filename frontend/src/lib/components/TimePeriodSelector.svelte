<script lang="ts">
  import { Slider } from "melt/builders";
  
  interface Props {
    // Expects periods in the format of "startYear_endYear" eg: ["1500_1700", "1700_1900"]
    timePeriods?: string[];
    value?: string;
    onValueChange?: (newValue: string) => void;
  }
  
  let { 
    timePeriods = [], 
    value = undefined,
    onValueChange = undefined 
  }: Props = $props();
  
  // Function to create display periods
  function createDisplayPeriods(periods: string[]): string[] {
    if (!periods.length) return [];
    return periods.map((period) => {
      const [start, _] = period.split('_');
      return start;
    });
  }
  
  // Create display periods for the ticks
  const displayPeriods = $derived(createDisplayPeriods(timePeriods));
  
  // Find initial slider index based on provided value
  function getInitialIndex(): number {
    if (!value || !timePeriods.length) return 0;
    const index = timePeriods.indexOf(value);
    return index >= 0 ? index : 0;
  }
  
  // Create the slider instance
  const slider = new Slider({
    value: getInitialIndex(),
    onValueChange: (newIndex) => {
      if (onValueChange && timePeriods.length > 0 && newIndex >= 0 && newIndex < timePeriods.length) {
        const periodValue = timePeriods[newIndex];
        onValueChange(periodValue);
      }
    },
    min: 0,
    max: Math.max(0, (timePeriods?.length || 1) - 1),
    step: 1,
    orientation: "horizontal"
  });
  
  // Helper function for tick positioning
  function getTickTranslateStyle(index: number, total: number): string {
    if (index === 0) return 'translate-x-0';
    if (index === total - 1) return '-translate-x-full';
    return '-translate-x-[50%]';
  }
</script>

{#if displayPeriods.length > 0}
  <div class="w-full px-4 py-1 border-t border-solid border-gray-300">
    <!-- Root slider element with spread props -->
    <div {...slider.root} class="w-100 h-10 mx-auto py-4 relative">
      <!-- Track -->
      <div class="h-full bg-gray-400 relative">
      </div>
      
      <!-- Ticks and labels -->
      {#each displayPeriods as period, i}
        <div 
          class="absolute h-2 w-0.5 bg-gray-600" 
          style="left: {i / (displayPeriods.length - 1) * 100}%"
          class:translate-x-0={i === 0}
          class:translate-x-full={i === displayPeriods.length - 1}
        >
          <span
            class="absolute top-4 text-xs text-black whitespace-nowrap {getTickTranslateStyle(
              i,
              displayPeriods.length
            )}"
          >
            {period}
          </span>
        </div>
      {/each}
      
      <!-- Thumb with data-melt-slider-thumb attribute from spread -->
      <div
        {...slider.thumb}
        class="absolute bg-white left-[var(--percentage)] top-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 border-blue-500 shadow-md hover:shadow-lg"
      ></div>
    </div>
  </div>
{/if}
