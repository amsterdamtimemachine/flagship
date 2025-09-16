<script lang="ts">
	import type { Snippet } from 'svelte';
	import { mergeCss } from '$utils/utils';

	interface Props {
		href: string;
		target?: string;
		rel?: string;
		class?: string;
		children?: Snippet;
	}

	let {
		href,
		target='_blank',
		rel='noopener noreferrer',
		class: className,
		children,
	}: Props = $props();

	const baseClasses =
		'h-[32px] py-2 flex justify-center items-center bg-atm-sand-darkish rounded border border-atm-gold border-[1px] hover:bg-atm-sand-dark text-sm';
</script>


	<a
		class={mergeCss('h-[32px] px-2 inline-flex justify-center items-center bg-atm-sand-darkish rounded border border-atm-gold border-[1px] hover:bg-atm-sand-dark text-sm' , className)}
		{href} {target} {rel}>
		<span>
			{@render children?.()}
		</span>
	</a>

