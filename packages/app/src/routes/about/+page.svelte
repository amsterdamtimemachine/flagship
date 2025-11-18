<script lang="ts">
	import SvelteMarkdown from 'svelte-markdown';
	import Heading from '$components/Heading.svelte';
	import Paragraph from '$components/Paragraph.svelte';
	import Nav from '$components/Nav.svelte';
	import NavItem from '$components/NavItem.svelte';
	import LogoGrid from '$components/LogoGrid.svelte';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	const renderers = {
		heading: Heading,
		paragraph: Paragraph
	};
</script>

<div class="w-full bg-atm-sand-dark min-h-screen">
	<div class="w-full flex justify-center bg-atm-sand border-b border-atm-sand-border">
		<Nav class="max-w-4xl border-none px-4 sm:px-6 lg:px-8">
			<NavItem href="/" label="Data Index" />
			<NavItem href="/about" label="Over" />
		</Nav>
	</div>
	<div class="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
		<SvelteMarkdown source={data.content} {renderers} />
		<LogoGrid class="mt-8" />
	</div>
	
</div>
