<script lang="ts">
 import {onMount} from 'svelte';
 import {transformToGeoImages} from '$utils/image';
 import Worker from '$lib/workers/worker.ts?worker';
 import type {ImageResponse, ImageData, GeoImage} from '$types/image';

 export let data: ImageResponse;
 
 let geoImages: GeoImage[] = [];

  onMount(() => {
    const worker = new Worker();
    worker.onmessage = (event: MessageEvent<GeoImage[]>) => {
      geoImages = event.data;
      console.log(geoImages);
    };
    console.log(data.images);
   // // Set up error handling
   // worker.onerror = (err: ErrorEvent) => {
   //   console.error('Worker error:', err);
   //   error = 'An error occurred while processing the images.';
   //   isLoading = false;
   // };

    // Send the initial message to the worker
    worker.postMessage(data.images);

    return () => {
      worker.terminate();
    };
      //console.log(transformToGeoImages(data.images as ImageData));
  });



</script>
 
<h1>Welcome to SvelteKit</h1>
<p>Visit <a href="https://kit.svelte.dev">kit.svelte.dev</a> to read the documentation</p>
