<script lang="ts">
 import {onMount} from 'svelte';
 export let data;

 onMount(() => {
  console.log(data);
 })

 
</script>

<h1>Welcome to SvelteKit</h1>
<p>Visit <a href="https://kit.svelte.dev">kit.svelte.dev</a> to read the documentation</p>
