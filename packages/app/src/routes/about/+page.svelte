<script lang="ts">
  import SvelteMarkdown from 'svelte-markdown';
  import Heading from '$lib/components/Heading.svelte';
  import Paragraph from '$lib/components/Paragraph.svelte';
  import type { PageData } from './$types';
  
  interface Props {
    data: PageData;
  }
  
  let { data }: Props = $props();

  // Create custom renderers - test direct component passing
  const renderers = {
    heading: Heading as any,
    paragraph: Paragraph as any
  };
</script>

<div class="max-w-4xl mx-auto p-8 bg-atm-sand min-h-screen">
  <SvelteMarkdown source={data.content} {renderers} />
</div>