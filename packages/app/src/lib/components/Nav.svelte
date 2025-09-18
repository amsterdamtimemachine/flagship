<script lang="ts">
    import Heading from './Heading.svelte';
    import { mergeCss } from '$utils/utils';
    import type { Snippet } from 'svelte';

    interface Props {
        class?: string;
        children?: Snippet;
    }

    let { class: className, children }: Props = $props();
</script>

<nav class={mergeCss('w-full bg-atm-sand flex items-center justify-between h-[50px] border-b border-atm-sand-border', className)}>
    <a href="/" class="no-underline">
        <Heading level={1}>Amsterdam Time Machine</Heading>
    </a>
    <div class="flex items-center gap-2">
        {@render children?.()}
    </div>
</nav>
