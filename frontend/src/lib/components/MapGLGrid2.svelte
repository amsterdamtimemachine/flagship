<!-- MapGLGrid.svelte -->
<script lang="ts">
   import { PUBLIC_MAPTILER_API_KEY } from '$env/static/public';
   import { onMount, onDestroy, createEventDispatcher } from 'svelte';
   import maplibre, { type Map } from 'maplibre-gl';
   import type { Heatmap, HeatmapCell, GridDimensions } from '@atm/shared-types';
   import debounce from 'lodash.debounce';
   import 'maplibre-gl/dist/maplibre-gl.css';

   export let heatmap: Heatmap;
   export let dimensions: GridDimensions;
   
   const MIN_ZOOM = 1; 
   const MAX_ZOOM = 16;
   const DEFAULT_ZOOM = 13;
   const STYLE_URL = `https://api.maptiler.com/maps/8b292bff-5b9a-4be2-aaea-22585e67cf10/style.json?key=${PUBLIC_MAPTILER_API_KEY}`;

   let map: Map | undefined;
   let mapContainer: HTMLElement;
   let isMapLoaded = false;
   let maxCount = 0;

   const dispatch = createEventDispatcher<{
       cellHover: {
           id: string;
           coordinates: number[][];
           mouseX: number;
           mouseY: number;
           value: number;
           count: number;
       };
       cellLeave: void;
       cellClick: {
           id: string;
           coordinates: number[][];
           value: number;
           count: number;
       };
   }>();

   // Generate initial features - geometry won't change
   function generateInitialFeatures(heatmap: Heatmap) {
       const features = heatmap.cells.map(cell => ({
           type: 'Feature',
           id: cell.cellId,
           properties: {
               id: cell.cellId,
               count: cell.featureCount
           },
           geometry: {
               type: 'Polygon',
               coordinates: [[
                   [cell.bounds.minLon, cell.bounds.minLat],
                   [cell.bounds.maxLon, cell.bounds.minLat],
                   [cell.bounds.maxLon, cell.bounds.maxLat],
                   [cell.bounds.minLon, cell.bounds.maxLat],
                   [cell.bounds.minLon, cell.bounds.minLat]
               ]]
           }
       }));

       return {
           type: 'FeatureCollection',
           features
       };
   }

   // Debounced function to update feature states
   const updateFeatureStates = debounce((map: Map, heatmap: Heatmap) => {
       maxCount = Math.max(...heatmap.cells.map(cell => cell.featureCount));
       
       heatmap.cells.forEach(cell => {
           map.setFeatureState(
               { source: 'grid', id: cell.cellId },
               { value: Math.max(cell.featureCount / maxCount, 0.1) }
           );
       });
   }, 16); // Debounce to roughly match 60fps

   // Update feature states when heatmap changes
   $: if (isMapLoaded && map && heatmap) {
       updateFeatureStates(map, heatmap);
   }

   onMount(() => {
       if (!mapContainer) return;
       
       const { minLon: west, maxLon: east, minLat: south, maxLat: north } = dimensions;
       
       map = new maplibre.Map({
           container: mapContainer,
           style: STYLE_URL,
           bounds: [[west, south], [east, north]],
           minZoom: MIN_ZOOM,
           maxZoom: MAX_ZOOM,
           zoom: DEFAULT_ZOOM,
           dragRotate: false,
           touchZoomRotate: false,
           dragPan: true,
           keyboard: true,
           scrollZoom: true
       });

       map.on('load', () => {
           // Add source with initial features
           map.addSource('grid', {
               type: 'geojson',
               data: generateInitialFeatures(heatmap),
               promoteId: 'id'
           });

           // Add layer using feature state for opacity
           map.addLayer({
               id: 'heatmap-squares',
               type: 'fill',
               source: 'grid',
               paint: {
                   'fill-color': '#0000ff',
                   'fill-opacity': ['coalesce', ['feature-state', 'value'], 0]
               }
           });

           // Initial feature state setup
           updateFeatureStates(map, heatmap);

           // Event handlers
           map.on('mousemove', 'heatmap-squares', (e) => {
               if (e.features?.[0]) {
                   const feature = e.features[0];
                   dispatch('cellHover', {
                       id: feature.properties.id,
                       coordinates: feature.geometry.coordinates,
                       mouseX: e.point.x,
                       mouseY: e.point.y,
                       value: feature.properties.value,
                       count: feature.properties.count
                   });
               }
           });

           map.on('mouseleave', 'heatmap-squares', () => {
               dispatch('cellLeave');
           });

           map.on('click', 'heatmap-squares', (e) => {
               if (e.features?.[0]) {
                   const feature = e.features[0];
                   dispatch('cellClick', {
                       id: feature.properties.id,
                       coordinates: feature.geometry.coordinates,
                       value: feature.properties.value,
                       count: feature.properties.count
                   });
               }
           });

           map.on('mouseenter', 'heatmap-squares', () => {
               map.getCanvas().style.cursor = 'pointer';
           });
           
           map.on('mouseleave', 'heatmap-squares', () => {
               map.getCanvas().style.cursor = '';
           });

           isMapLoaded = true;
       });
   });

   onDestroy(() => {
       if (map) {
           updateFeatureStates.cancel();
           map.remove();
       }
   });
</script>

<div bind:this={mapContainer} class="map-container" />

<style>
   .map-container {
       width: 100%;
       height: 100vh;
       position: relative;
   }
   :global(.maplibregl-canvas) {
       width: 100% !important;
       height: 100% !important;
   }
</style>
