<script lang="ts">
  import { PUBLIC_MAPTILER_API_KEY } from '$env/static/public';
  import { onMount } from 'svelte';
  import * as maptilersdk from '@maptiler/sdk';
  import '@maptiler/sdk/dist/maptiler-sdk.css';
  import type { Point } from '$types/geometry';
  
  export let points: Point[] = []; 
  export let center: [number, number] = [4.9, 52.37]; 
  export let zoom: number = 6; 
  
  let map: maptilersdk.Map;
  let mapContainer: HTMLElement;
  const MAP_STYLE_URL = "https://api.maptiler.com/maps/8b292bff-5b9a-4be2-aaea-22585e67cf10/style.json?key=smdqJRATk5bxz2F8hvF4"

  maptilersdk.config.apiKey = PUBLIC_MAPTILER_API_KEY;

  onMount(() => {
    if (!mapContainer) return;
    
    map = new maptilersdk.Map({
      container: mapContainer,
      style: MAP_STYLE_URL,
      center: center,
      zoom: zoom
    });

    map.on('load', () => {
      // Add points source and layer
      map.addSource('points', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: points.map(({x, y}) => ({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [x, y]
            },
            properties: {}
          }))
        }
      });

      map.addLayer({
        id: 'points',
        type: 'circle',
        source: 'points',
        paint: {
          'circle-radius': 1,
          'circle-color': '#000000'
        }
      });
    });

    return () => {
      map.remove();
    };
  });
</script>

<div bind:this={mapContainer} class="map-container"></div>

<style>
  .map-container {
    width: 100%;
    height: 100vh;
  }
</style>
