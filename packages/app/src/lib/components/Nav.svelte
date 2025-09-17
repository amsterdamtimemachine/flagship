<script lang="ts">
    import ButtonLink from './ButtonLink.svelte';
    import Heading from './Heading.svelte';
</script>

<nav class="bg-atm-sand flex items-center justify-between h-[50px] p-3 border-b border-atm-sand-border">
    <a href="/" class="no-underline">
        <Heading level={1}>Amsterdam Time Machine</Heading>
    </a>
    <ButtonLink target='' rel='' href='/about'> About </ButtonLink>
</nav>