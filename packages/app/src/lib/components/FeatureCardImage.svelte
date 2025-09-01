<script lang="ts">
	type Props = {
		thumbnail: string;
		alt?: string;
		expanded?: boolean;
		onExpand?: () => void;
	};

	let { thumbnail, alt, expanded = false, onExpand }: Props = $props();

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

<div class="flex-1">
	{#if imageError}
		<div class="w-full {expanded ? 'h-64' : 'h-32'} bg-gray-100 flex items-center justify-center text-gray-500 text-sm">
			<div class="text-center">
				<div class="mb-1">🖼️</div>
				<div>Image unavailable</div>
			</div>
		</div>
	{:else}
		<div class="relative w-full bg-gray-300">
			<img
				src={thumbnail}
				alt={alt}
				class="w-full h-auto {expanded ? 'object-contain max-h-[70vh]' : 'object-cover'} rounded {!expanded && onExpand ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}"
				class:hidden={imageLoading}
				onload={handleImageLoad}
				onerror={handleImageError}
				onclick={!expanded && onExpand ? onExpand : undefined}
			/>
		</div>
	{/if}
</div>
