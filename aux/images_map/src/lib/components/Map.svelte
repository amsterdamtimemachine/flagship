<script lang="ts">
  import { PUBLIC_MAPTILER_API_KEY } from '$env/static/public';
  import { onMount } from 'svelte';
  import maplibregl, { Map, NavigationControl } from 'maplibre-gl';
  import 'maplibre-gl/dist/maplibre-gl.css';
  import type { Point } from '$types/geometry';
  
  export let points: Point[] = []; 
  export let center: [number, number] = [4.9, 52.37]; 
  export let zoom: number = 6; 
  
  let map: Map;
  let mapContainer: HTMLElement;

  const STYLE_URL = `https://api.maptiler.com/maps/8b292bff-5b9a-4be2-aaea-22585e67cf10/style.json?key=${PUBLIC_MAPTILER_API_KEY}`;

  onMount(() => {
    if (!mapContainer) return;
    
    map = new Map({
      container: mapContainer,
      style: STYLE_URL,
      center: center,
      zoom: zoom
    });

    map.addControl(new NavigationControl());

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
          'circle-radius': 4,
          'circle-color': '#ff0000'
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
  :global(.maplibregl-canvas) {
    width: 100% !important;
    height: 100% !important;
  }
</style>
