<script lang="ts">
  import { PUBLIC_MAPBOX_API_KEY } from '$env/static/public';
  import { onMount } from 'svelte';
  import type { Point } from '$types/geometry';
  import mapboxgl, { type Map, type LngLatLike } from 'mapbox-gl';
  
  // You need to replace this with your actual Mapbox access token
  mapboxgl.accessToken = PUBLIC_MAPBOX_API_KEY;
  
  export let points: Point[] = []; 
  export let center: LngLatLike = [4.9, 52.37]; 
  export let zoom: number = 6; 
  
  let map: Map | undefined;
  let mapContainer: HTMLElement;

  onMount(() => {
    if (!mapContainer) return;

    map = new mapboxgl.Map({
      container: mapContainer,
      style: 'mapbox://styles/mapbox/streets-v11', // This style includes detailed street data
      center: center,
      zoom: zoom
    });

    map.on('load', () => {
      if (!map) return;

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
          'circle-radius': 2,
          'circle-color': '#000000'
        }
      });
    });

    return () => {
      if (map) {
        map.remove();
      }
    };
  });
</script>

<div bind:this={mapContainer} class="map-container"></div>

<style>
  .map-container {
    width: 100%;
    height: 100vh;
  }
  :global(.mapboxgl-canvas) {
    width: 100% !important;
    height: 100% !important;
  }
</style>
