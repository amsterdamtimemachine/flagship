<script lang="ts">

	type Props = {
		text: string;
		expanded?: boolean;
	};

	let { text, expanded = false }: Props = $props();

	const maxLength = 200;
	let showFullText = $state(false);

	const truncatedText = text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
	const needsTruncation = text.length > maxLength;
</script>

{#if expanded}
	<div class="mb-6">
		<h4 class="text-lg font-medium text-gray-900 mb-3">Description</h4>
		<div class="prose prose-gray max-w-none">
			<p class="text-gray-700 leading-relaxed whitespace-pre-wrap">
				{text}
			</p>
		</div>
	</div>
{:else}
	<div class="flex-1">
		<div class="text-sm text-gray-700 leading-relaxed">
			{#if needsTruncation && !showFullText}
				<div>
					{truncatedText}
				</div>
				<button 
					class="mt-2 text-xs text-blue-600 hover:text-blue-800 underline"
					onclick={() => showFullText = true}
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
						onclick={() => showFullText = false}
					>
						Show less
					</button>
				{/if}
			{/if}
		</div>
	</div>
{/if}
