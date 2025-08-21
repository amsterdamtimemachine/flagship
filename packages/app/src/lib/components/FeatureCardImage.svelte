<script lang="ts">
	type Props = {
		thumbnail: string;
		alt?: string;
		expanded?: boolean;
	};

	let { thumbnail, alt, expanded = false }: Props = $props();

	let imageError = $state(false);
	let imageLoading = $state(true);
	
	// Debug logging
	console.log('FeatureCardImage props:', { thumbnail, alt, expanded });

	const handleImageLoad = () => {
		imageLoading = false;
	};

	const handleImageError = () => {
		imageError = true;
		imageLoading = false;
	};
</script>

<div class="{expanded ? 'mb-6' : 'flex-1 p-2'}">
	{#if imageError}
		<div class="w-full {expanded ? 'h-64' : 'h-32'} bg-gray-100 flex items-center justify-center text-gray-500 text-sm">
			<div class="text-center">
				<div class="mb-1">🖼️</div>
				<div>Image unavailable</div>
			</div>
		</div>
	{:else}
		<div class="relative w-full">
			{#if imageLoading}
				<div class="w-full {expanded ? 'h-64' : 'h-32'} bg-gray-100 animate-pulse flex items-center justify-center">
					<div class="text-gray-400 text-sm">Loading...</div>
				</div>
			{/if}
			<img
				src={thumbnail}
				alt={alt}
				class="w-full h-auto {expanded ? 'object-contain max-h-[70vh]' : 'object-cover'} rounded"
				class:hidden={imageLoading}
				on:load={handleImageLoad}
				on:error={handleImageError}
			/>
		</div>
	{/if}
</div>
