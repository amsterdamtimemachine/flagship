<script lang="ts">

	type Props = {
		text: string;
	};

	let { text }: Props = $props();

	const maxLength = 200;
	let showFullText = $state(false);

	const truncatedText = text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
	const needsTruncation = text.length > maxLength;
</script>

<div class="flex-1 p-3">
	<div class="text-sm text-gray-700 leading-relaxed">
		{#if needsTruncation && !showFullText}
			<div>
				{truncatedText}
			</div>
			<button 
				class="mt-2 text-xs text-blue-600 hover:text-blue-800 underline"
				on:click={() => showFullText = true}
			>
				Show more
			</button>
		{:else}
			<div>
				{text}
			</div>
			{#if needsTruncation}
				<button 
					class="mt-2 text-xs text-blue-600 hover:text-blue-800 underline"
					on:click={() => showFullText = false}
				>
					Show less
				</button>
			{/if}
		{/if}
	</div>
</div>
