<script lang="ts">
	import { pickAndConvertObjectToArray, prettifyKey } from '$utils/utils';

	interface Props {
		feature: any; // Database API feature
	}

	let { feature }: Props = $props();

	// Extract relevant properties from the database feature
	let items = $derived.by(() => {
		if (!feature?.properties) return [];
		
		// Pick common text/document properties
		return pickAndConvertObjectToArray(feature.properties, [
			'title',
			'description',
			'name',
			'text',
			'content',
			'author',
			'date',
			'location',
			'address',
			'city',
			'type',
			'category'
		]);
	});

	// Determine what type of text content this is
	let contentType = $derived(() => {
		const props = feature?.properties || {};
		if (props.title) return 'Document';
		if (props.name) return 'Record';
		if (props.text || props.content) return 'Text';
		return 'Item';
	});
</script>

{#if items.length > 0}
	<div class="w-full border-2 border-solid border-gray-200 p-2 bg-white">
		<h2 class="text-sm pb-2 font-semibold text-gray-700">{contentType}</h2>
		<dl class="space-y-1">
			{#each items as [key, value]}
				{#if key && value}
					<div>
						<dt class="text-xs text-gray-600">{prettifyKey(key)}</dt>
						<dd class="text-xs font-medium text-gray-900 break-words">
							{#if typeof value === 'string' && value.length > 100}
								{value.substring(0, 100)}...
							{:else}
								{value}
							{/if}
						</dd>
					</div>
				{/if}
			{/each}
		</dl>
		
		{#if feature?.geometry?.coordinates}
			<div class="mt-2 pt-2 border-t border-gray-100">
				<dt class="text-xs text-gray-600">Coordinates</dt>
				<dd class="text-xs text-gray-500">
					{feature.geometry.coordinates[1]?.toFixed(4)}, {feature.geometry.coordinates[0]?.toFixed(4)}
				</dd>
			</div>
		{/if}
	</div>
{:else}
	<div class="w-full border border-gray-200 p-2 bg-gray-50">
		<div class="text-xs text-gray-500">No displayable properties</div>
		{#if feature?.id}
			<div class="text-xs text-gray-400">ID: {feature.id}</div>
		{/if}
	</div>
{/if}