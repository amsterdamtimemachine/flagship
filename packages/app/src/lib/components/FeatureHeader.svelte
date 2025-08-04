<script lang="ts">
	import type { RawFeature } from '@atm/shared/types';

	type Props = {
		feature: RawFeature;
	};

	let { feature }: Props = $props();

	// Format time period for display
	const formatTimePeriod = (per: [number, number]) => {
		const [start, end] = per;
		if (start === end) return start.toString();
		return `${start}-${end}`;
	};
</script>

<div class="p-3 border-b border-gray-200">
	<!-- Title -->
	<h3 class="font-semibold text-sm text-gray-900 mb-1 line-clamp-2">
		{feature.tit}
	</h3>
	
	<!-- Dataset and Record Type -->
	<div class="flex items-center gap-2 mb-2">
		<span class="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
			{feature.recordType}
		</span>
		<span class="text-xs text-gray-600">
			{feature.ds}
		</span>
	</div>
	
	<!-- Time Period -->
	<div class="text-xs text-gray-600 mb-2">
		📅 {formatTimePeriod(feature.per)}
	</div>
	
	<!-- Source URL -->
	{#if feature.url}
		<div class="mb-2">
			<a href={feature.url} target="_blank" rel="noopener noreferrer" class="text-xs text-blue-600 hover:text-blue-800 underline">
				source
			</a>
		</div>
	{/if}
	
	<!-- Tags -->
	{#if feature.tags && feature.tags.length > 0}
		<div class="flex flex-wrap gap-1">
			{#each feature.tags.slice(0, 3) as tag}
				<span class="text-xs px-1 py-0.5 bg-gray-100 text-gray-700 rounded">
					{tag}
				</span>
			{/each}
			{#if feature.tags.length > 3}
				<span class="text-xs text-gray-500">
					+{feature.tags.length - 3} more
				</span>
			{/if}
		</div>
	{/if}
</div>
