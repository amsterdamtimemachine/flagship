<script lang="ts">
	import type { GeoFeature } from '@atm/shared-types';
	import { pickAndConvertObjectToArray, prettifyKey } from '$utils/utils';

	export let feature: GeoFeature<'Image'>;
	
	// WIP: currently there's only cinema screening data in th Event dataset so we'll make EventBlock less generic than it's supposed to be 
	$: items = pickAndConvertObjectToArray(feature?.properties, ['title', 'city_name', 'street_name','info', 'venue_type']);	
</script>

{#if items}
<div class="w-full border-2 border-solid border-black-100">
	<h2 class="text-sm pb-2"> Film screening</h2>
	<dl>
		{#each items as [key, value]}
			{#if key && value}
			<dt class="text-xs">{prettifyKey(key)}</dt>
			<dd class="text-xs font-bold">{value}</dd>
			{/if} 
		{/each}
	</dl>
</div>
{/if}
