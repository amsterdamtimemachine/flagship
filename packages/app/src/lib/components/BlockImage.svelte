<script lang="ts">
	type Props = {
		feature: any; // Database API feature
	};

	let { feature }: Props = $props();

	// Get image URL from various possible properties
	let imageUrl = $derived(() => {
		const props = feature?.properties || {};
		return props.thumb || props.image || props.photo || props.picture || 
		       props.img_url || props.image_url || props.thumbnail || null;
	});

	// Get source URL
	let sourceUrl = $derived(() => {
		const props = feature?.properties || {};
		return props.url || props.source || props.link || null;
	});

	// Get title or description
	let title = $derived(() => {
		const props = feature?.properties || {};
		return props.title || props.name || props.description || 'Image';
	});
</script>

<div class="w-full h-full flex flex-col border border-gray-200 bg-white">
	{#if imageUrl}
		<div class="flex-1">
			{#if sourceUrl}
				<a href={sourceUrl} target="_blank" class="block h-full">
					<img 
						src={imageUrl} 
						alt={title}
						class="h-full w-full object-cover"
						loading="lazy"
					/>
				</a>
			{:else}
				<img 
					src={imageUrl} 
					alt={title}
					class="h-full w-full object-cover"
					loading="lazy"
				/>
			{/if}
		</div>
	{:else}
		<div class="flex-1 bg-gray-100 flex items-center justify-center">
			<div class="text-gray-500 text-xs">No image</div>
		</div>
	{/if}
	
	<div class="p-2 border-t border-gray-100">
		<div class="text-xs font-medium text-gray-900 truncate" title={title}>
			{title}
		</div>
		{#if sourceUrl}
			<a class="text-xs text-blue-600 underline" href={sourceUrl} target="_blank">
				view source
			</a>
		{/if}
		{#if feature?.geometry?.coordinates}
			<div class="text-xs text-gray-500 mt-1">
				{feature.geometry.coordinates[1]?.toFixed(4)}, {feature.geometry.coordinates[0]?.toFixed(4)}
			</div>
		{/if}
	</div>
</div>
