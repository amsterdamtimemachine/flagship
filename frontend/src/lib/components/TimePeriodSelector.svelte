<script lang="ts">
   import { type Histogram } from '@atm/shared-types';
	 import { Slider } from "melt/builders";
 
 interface Props {
   histogram: Histogram;
   value?: string;
   onValueChange?: (newValue: string) => void;
 }
 
 let { 
   histogram, 
   value = undefined,
   onValueChange = undefined 
 }: Props = $props();
 
 // Extract time periods from histogram bins
 const timePeriods = $derived(histogram?.bins?.map(bin => bin.period) || []);
 
 // Function to create display periods
 function createDisplayPeriods(periods: string[]): string[] {
   if (!periods.length) return [];
   return periods.map((period) => {
     const [start] = period.split('_');
     return start;
   });
 }
 
 // Create display periods for the ticks
 const displayPeriods = $derived(createDisplayPeriods(timePeriods));
 const thumbScaleFactor = $derived((histogram.bins.length - 1) / histogram.bins.length);
 const thumbOffset = $derived((100 / histogram.bins.length - 1) / 2);
 
 // Find initial slider index based on provided value
 function getInitialIndex(): number {
   if (!value || !timePeriods.length) return 0;
   const index = timePeriods.indexOf(value);
   return index >= 0 ? index : 0;
 }
 
 // Make slider reactive to timePeriods changes
	const slider = $derived(new Slider({
		value: getInitialIndex(),
		onValueChange: (newIndex) => {
			if (onValueChange && timePeriods.length > 0 && newIndex >= 0 && newIndex < timePeriods.length) {
				const periodValue = timePeriods[newIndex];
				onValueChange(periodValue);
			}
		},
		min: 0,
		max: Math.max(0, histogram.bins.length-1), // Changed from timePeriods.length - 1
		step: 1,
		orientation: "horizontal"
	}));
 
 // Helper function for tick positioning
 function getTickTranslateStyle(index: number, total: number): string {
   if (index === 0) return 'translate-x-0';
   if (index === total - 1) return '-translate-x-full';
   return '-translate-x-[50%]';
 }

 // Calculate histogram bar heights (normalized to max height)
 function getBarHeight(count: number, maxCount: number): number {
   if (maxCount === 0) return 0;
   return (count / maxCount) * 40; // Max height of 40px
 }

 // Get current selected index for highlighting
 const currentIndex = $derived(() => {
   if (!value || !timePeriods.length) return 0;
   const index = timePeriods.indexOf(value);
   return index >= 0 ? index : 0;
 });

</script>

{#if histogram?.bins?.length > 0}
 <div class="w-full px-4 py-1 border-t border-solid border-gray-300">
   <!-- Root slider element with spread props -->
   <div {...slider.root} class="w-full h-20 mx-auto py-4 relative">
     
     <!-- Hidden track for slider functionality -->
     <div class="absolute inset-x-0 bottom-8 h-0.5 opacity-0"></div>
     
     <!-- Histogram bars -->
     <div class="absolute inset-x-0 top-0 h-12 flex items-end">
       {#each histogram.bins as bin, i}
         <div 
           class="absolute flex items-end"
           style="left: {i / histogram.bins.length * 100}%; width: {100 / histogram.bins.length}%;"
         >
           <div 
             class="w-full bg-blue-400 transition-colors duration-200"
             class:bg-blue-600={currentIndex() === i}
             class:bg-blue-400={currentIndex() !== i}
             style="height: {getBarHeight(bin.count, histogram.maxCount)}px; min-height: 2px;"
             title="Period: {bin.period}, Count: {bin.count}"
           ></div>
         </div>
       {/each}
     </div>
     
     <!-- Visible track -->
     <div class="absolute inset-x-0 bottom-8 h-0.5 bg-gray-400"></div>
     
     <!-- Ticks at boundaries -->
     {#each Array(histogram.bins.length + 1) as _, i}
       <div 
         class="absolute w-0.5 bg-gray-600" 
         style="left: {i / histogram.bins.length * 100}%; height: 48px;"
       >
         {#if i < displayPeriods.length}
           <span class="absolute  text-xs text-black whitespace-nowrap">
             {displayPeriods[i]}
           </span>
         {/if}
       </div>
     {/each}
     
     <!-- Draggable thumb using --percentage but positioned at bar centers -->
     <div
       {...slider.thumb}
       class="absolute bg-white w-4 h-4  border-2 border-blue-500 shadow-md hover:shadow-lg cursor-pointer z-10"
			 style="left: calc(var(--percentage) * {thumbScaleFactor} + {thumbOffset}%);"
     ></div> 
   </div>
 </div>
{/if}
