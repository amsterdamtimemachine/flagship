<script lang="ts">
	type Props = {
		thumbnail: string;
		alt?: string;
		expanded?: boolean;
	};

	let { thumbnail, alt, expanded = false }: Props = $props();

	let imageError = $state(false);
	let imageLoading = $state(true);

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
		<div class="w-full {expanded ? 'h-64' : 'h-32'} bg-gray-100 flex items-center justify-center text-gray-500 {expanded ? 'rounded-lg' : 'text-sm'}">
			<div class="text-center">
				<div class="{expanded ? 'mb-2 text-4xl' : 'mb-1'}">🖼️</div>
				<div class="{expanded ? 'text-lg' : ''}">
					{expanded ? 'High-resolution image unavailable' : 'Image unavailable'}
				</div>
			</div>
		</div>
	{:else}
		<div class="relative w-full overflow-hidden {expanded ? 'bg-gray-50 rounded-lg' : ''}">
			{#if imageLoading}
				<div class="w-full {expanded ? 'h-64' : 'h-32'} bg-gray-100 animate-pulse flex items-center justify-center">
					<div class="text-gray-400 {expanded ? '' : 'text-sm'}">
						{expanded ? 'Loading high-resolution image...' : 'Loading...'}
					</div>
				</div>
			{/if}
			<img
				src={thumbnail}
				alt={alt || 'Feature image'}
				class="w-full h-auto object-contain rounded {expanded ? 'rounded-lg max-h-[70vh]' : 'max-w-full'}"
				class:hidden={imageLoading}
				on:load={handleImageLoad}
				on:error={handleImageError}
				loading={expanded ? 'eager' : 'lazy'}
			/>
		</div>
	{/if}
</div>
