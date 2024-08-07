<script lang="ts">
  import { PUBLIC_MAPBOX_API_KEY } from '$env/static/public';
  import { onMount } from 'svelte';
  import type { Point } from '$types/geo';
  import mapboxgl, { type Map, type LngLatLike } from 'mapbox-gl';
  
  
  export let points: Point[] = []; 
  export let center: LngLatLike = [4.9, 52.37]; 
  export let zoom: number = 6; 
  
  let map: Map | undefined;
  let mapContainer: HTMLElement;

  onMount(() => {
    if (!mapContainer) return;
    map = new mapboxgl.Map({
      container: mapContainer,
      style: 'mapbox://styles/mapbox/streets-v11',
      center: center,
      zoom: zoom
    });

    map.on('load', () => {
      if (!map) return;

      // Remove all text labels
        const style = map.getStyle();
        if (style && style.layers) {
          for (const layer of style.layers) {
            if (layer.type === 'symbol') {
              map.removeLayer(layer.id);
            }
          }
        }

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
