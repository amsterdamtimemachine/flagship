<script lang="ts">
	import type { RawFeature } from '@atm/shared/types';

	type Props = {
		feature: RawFeature;
	};

	let { feature }: Props = $props();
</script>

{#if feature.tags && feature.tags.length > 0}
	<div class="border-b border-gray-300 rounded-sm">
			<div class="flex flex-wrap gap-1">
				{#each feature.tags as tag}
					<span class="text-xs px-1 py-0.5 bg-gray-100 text-gray-700 rounded">
						{tag}
					</span>
				{/each}
			</div>
	</div>
{/if}
