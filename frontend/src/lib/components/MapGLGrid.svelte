<!-- MapGLGrid.svelte -->
<script lang="ts">
   import { PUBLIC_MAPTILER_API_KEY } from '$env/static/public';
   import { onMount, onDestroy, createEventDispatcher } from 'svelte';
   import maplibre, { type Map } from 'maplibre-gl';
   import type { Heatmap, HeatmapCell, HeatmapBlueprintCell, GridDimensions } from '@atm/shared-types';
   import debounce from 'lodash.debounce';
   import 'maplibre-gl/dist/maplibre-gl.css';

   export let heatmap: Heatmap;
   export let heatmapBlueprint: HeatmapBlueprintCell[];
   export let dimensions: GridDimensions;
   
   const MIN_ZOOM = 1; 
   const MAX_ZOOM = 16;
   const DEFAULT_ZOOM = 13;
   const STYLE_URL = `https://api.maptiler.com/maps/8b292bff-5b9a-4be2-aaea-22585e67cf10/style.json?key=${PUBLIC_MAPTILER_API_KEY}`;

   let map: Map | undefined;
   let mapContainer: HTMLElement;
   let isMapLoaded = false;

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
           period:string;
       };
   }>();

   // Generate initial features from blueprint
   function generateInitialFeatures(blueprint: HeatmapBlueprintCell[]) {
       const features = blueprint.map(cell => ({
           type: 'Feature',
           id: cell.cellId,
           properties: {
               id: cell.cellId,
               count: 0  // Initial count is 0
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

// Debounced function to update feature states - simplified now
const updateFeatureStates = debounce((map: Map, heatmap: Heatmap, blueprint: HeatmapBlueprintCell[]) => {
    // Create a map of current cell values for quick lookup
    const currentValues = new Map(
        heatmap.cells.map(cell => [cell.cellId, {
            count: cell.featureCount,
            density: cell.countDensity
        }])
    );
    
    // Update ALL blueprint cells, whether they have current values or not
    blueprint.forEach(cell => {
        const cellData = currentValues.get(cell.cellId) ?? { count: 0, density: 0 };
        
        // Always set the state, even for cells with no values
        map.setFeatureState(
            { source: 'grid', id: cell.cellId },
            { 
                value: cellData.density,  // Use pre-computed density
                count: cellData.count
            }
        );
    });
}, 16);

   // Update feature states when heatmap changes
   $: if (isMapLoaded && map && heatmap) {
       updateFeatureStates(map, heatmap, heatmapBlueprint);
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
           // Add source with blueprint features
           map.addSource('grid', {
               type: 'geojson',
               data: generateInitialFeatures(heatmapBlueprint),
               promoteId: 'id'
           });

           // Add layer using feature state for opacity with transition
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
           updateFeatureStates(map, heatmap, heatmapBlueprint);

           // Event handlers
           map.on('mousemove', 'heatmap-squares', (e) => {
                   if (e.features?.[0]) {
                   const feature = e.features[0];
                   const featureState = map.getFeatureState({ source: 'grid', id: feature.properties.id });

                   // Only dispatch if the cell has a value
                   if (featureState.count > 0) {
                   dispatch('cellHover', {
                        id: feature.properties.id,
                        coordinates: feature.geometry.coordinates,
                        mouseX: e.point.x,
                        mouseY: e.point.y,
                        value: featureState.value || 0,  // This is now using the pre-computed density
                        count: featureState.count || 0
                        });
                   map.getCanvas().style.cursor = 'pointer';
                   } else {
                   map.getCanvas().style.cursor = '';
                   }
                   }
                   });

           map.on('mouseleave', 'heatmap-squares', () => {
               dispatch('cellLeave');
               map.getCanvas().style.cursor = '';
           });

           map.on('click', 'heatmap-squares', (e) => {
               if (e.features?.[0]) {
                   const feature = e.features[0];
                   const featureState = map.getFeatureState({ source: 'grid', id: feature.properties.id });
                   
                   // Only dispatch if the cell has a value
                   if (featureState.count > 0) {
                       dispatch('cellClick', {
                           id: feature.properties.id,
                           period: heatmap.period,
                       });
                   }
               }
           });

           isMapLoaded = true;
       });
   });
   onDestroy(() => {
       if (map) {
           map.off('mousemove', 'heatmap-squares');
           map.off('mouseleave', 'heatmap-squares');
           map.off('click', 'heatmap-squares');
           map.off('mouseenter', 'heatmap-squares');
           updateFeatureStates.cancel();
           map.remove();
       }
   });
</script>

<div bind:this={mapContainer} class="h-full w-full" />


