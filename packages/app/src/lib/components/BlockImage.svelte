<script lang="ts">
	import type { ImageFeature } from '@atm/shared/types';
	type Props = {
		feature: ImageFeature;
	};

	let { feature }: Props = $props();
</script>

<div class="w-full h-full flex flex-col">
	{#if feature?.properties?.thumb}
		<a href={feature.properties.thumb} class="h-full">
			<img src={feature.properties.thumb} class="h-full w-auto object-cover" />
		</a>
	{/if}
	<div class="flex">
		<a class="text-xs underline" href={feature?.properties.url}>source</a>
	</div>
</div>
