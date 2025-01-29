<script lang="ts">
	import type { GeoFeature } from '@atm/shared-types';
	export let feature: GeoFeature;
</script>

<div class="h-full flex flex-col">
	{#if feature?.properties?.thumb}
		<a href={feature.properties.thumb} class="h-full">
			<img src={feature.properties.thumb} class="h-full w-auto object-cover" />
		</a>
	{/if}
	<div class="flex">
		<!--
        <span class="text-xs pr-2">{feature?.properties.start_date} - {feature?.properties.end_date}</span>
				-->
		<a class="text-xs underline" href={feature?.properties.url}>source</a>
	</div>
</div>
