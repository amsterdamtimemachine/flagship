<script lang="ts">
	import SvelteMarkdown from 'svelte-markdown';
	import Heading from '$lib/components/Heading.svelte';
	import Paragraph from '$lib/components/Paragraph.svelte';
	import Nav from '$lib/components/Nav.svelte';
	import NavItem from '$lib/components/NavItem.svelte';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	// Create custom renderers - test direct component passing
	const renderers = {
		heading: Heading,
		paragraph: Paragraph
	};
</script>

<div class="w-full bg-atm-sand-dark min-h-screen">
	<div class="w-full flex justify-center bg-atm-sand border-b border-atm-sand-border">
		<Nav class="max-w-4xl border-none">
			<NavItem href="/" label="Kaart" />
			<NavItem href="/about" label="Over" />
		</Nav>
	</div>
	<div class="max-w-4xl mx-auto py-8">
		<SvelteMarkdown source={data.content} {renderers} />
	</div>
</div>
