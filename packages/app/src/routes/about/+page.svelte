<script lang="ts">
	import SvelteMarkdown from 'svelte-markdown';
	import Heading from '$components/Heading.svelte';
	import Paragraph from '$components/Paragraph.svelte';
	import Link from '$components/Link.svelte';
	import Image from '$components/Image.svelte';
	import List from '$components/List.svelte';
	import ListItem from '$components/ListItem.svelte';
	import Strong from '$components/Strong.svelte';
	import Em from '$components/Em.svelte';
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
		paragraph: Paragraph,
		link: Link,
		image: Image,
		list: List,
		listitem: ListItem,
		strong: Strong,
		em: Em
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
		<div class="prose prose-slate max-w-none">
			<SvelteMarkdown source={data.content} {renderers} />
		</div>
		<LogoGrid class="mt-8" />
	</div>
	
</div>
