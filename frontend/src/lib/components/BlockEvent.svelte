<script lang="ts">
	import type { GeoFeature } from '@atm/shared-types';
	import { pickAndConvertObjectToArray, prettifyKey } from '$utils/utils';

	export let feature: GeoFeature<'Image'>;
	
	// WIP: currently there's only cinema screening data in th Event dataset so we'll make EventBlock less generic than it's supposed to be 
	$: items = pickAndConvertObjectToArray(feature?.properties, ['street_name', 'city_name', 'info', 'venue_type']);	
	$: console.log(items);
</script>

{#if items}
<div class="w-[300px]">
	<dl>
		{#each items as [key, value]}
			<dt>{prettifyKey(key)}</dt>
			<dd>{value}</dd>
		{/each}
	</dl>
</div>
{/if}
