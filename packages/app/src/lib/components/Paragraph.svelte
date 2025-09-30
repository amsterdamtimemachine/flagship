<script lang="ts">
	import { mergeCss } from '$utils/utils';

	interface Props {
		class?: string;
		children?: import('svelte').Snippet;
	}

	let { class: className, children }: Props = $props();
</script>

<p class={mergeCss('font-sans font-normal text-black text-paragraph pb-3', className)}>
	{@render children?.()}
</p>
