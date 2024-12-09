<script lang="ts">
    import { PUBLIC_MAPTILER_API_KEY } from '$env/static/public';
    import { onMount, onDestroy, createEventDispatcher } from 'svelte';
    import maplibre, { type Map } from 'maplibre-gl';
    import 'maplibre-gl/dist/maplibre-gl.css';

    interface Cell {
        cellId: string;
        count: number;
        bounds: {
            minLon: number;
            maxLon: number;
            minLat: number;
            maxLat: number;
        };
    }

    interface MapBounds {
        boundA: [number, number];
        boundB: [number, number];
    }

    interface Dimensions {
        width: number;
        height: number;
    }

    export let cells: Cell[] = [];
    export let bounds: MapBounds;
    export let dimensions: Dimensions;

    const MIN_ZOOM = 11;
    const MAX_ZOOM = 16;
    const DEFAULT_ZOOM = 13;
    const PADDING = 0.1;

    const STYLE_URL = `https://api.maptiler.com/maps/8b292bff-5b9a-4be2-aaea-22585e67cf10/style.json?key=${PUBLIC_MAPTILER_API_KEY}`;

    let map: Map | undefined;
    let mapContainer: HTMLElement;

   // function getLatitudeAdjustmentFactor(latitude: number): number {
   //     return 1 / Math.cos((latitude * Math.PI) / 180);
   // }

    function calculateSquareCoordinates(cell: Cell, scale: number = 1): number[][] {
        const centerLat = (cell.bounds.minLat + cell.bounds.maxLat) / 2;
        //const latAdjustment = getLatitudeAdjustmentFactor(centerLat);
        
        const cellWidth = cell.bounds.maxLon - cell.bounds.minLon;
        const cellHeight = (cell.bounds.maxLat - cell.bounds.minLat); // * latAdjustment;
        
        const centerLng = cell.bounds.minLon + (cellWidth / 2);
        
        const halfSize = (Math.min(cellWidth, cellHeight) * scale) / 2;
        const halfSizeLng = halfSize;
        const halfSizeLat = halfSize; // / latAdjustment;

        return [
            [centerLng - halfSizeLng, centerLat - halfSizeLat],
            [centerLng + halfSizeLng, centerLat - halfSizeLat],
            [centerLng + halfSizeLng, centerLat + halfSizeLat],
            [centerLng - halfSizeLng, centerLat + halfSizeLat],
            [centerLng - halfSizeLng, centerLat - halfSizeLat]
        ];
    }

    function generateGridFeatures(cells: Cell[]) {
        const maxCount = Math.max(...cells.map(cell => cell.count));
        
        const features = cells.flatMap(cell => {
            const normalizedValue = cell.count / maxCount;
            
            // Create outline feature with adjusted square coordinates
            const outlineFeature = {
                type: 'Feature',
                properties: {
                    id: `outline-${cell.cellId}`,
                    isOutline: true,
                    cellId: cell.cellId,
                    value: normalizedValue,
                    count: cell.count
                },
                geometry: {
                    type: 'Polygon',
                    coordinates: [
                        calculateSquareCoordinates(cell, 1) // Full size for outline
                    ]
                }
            };

            // Create inner square feature
            const dataFeature = {
                type: 'Feature',
                properties: {
                    id: cell.cellId,
                    isData: true,
                    value: normalizedValue,
                    count: cell.count
                },
                geometry: {
                    type: 'Polygon',
                    coordinates: [
                        calculateSquareCoordinates(cell, 0.1 + (normalizedValue * 0.8)) // Scaled size for inner square
                    ]
                }
            };

            return [outlineFeature, dataFeature];
        });

        return {
            type: 'FeatureCollection',
            features: features
        };
    }

    export function updateData(newCells: Cell[]) {
        if (!map) return;
        
        cells = newCells;
        const source = map.getSource('grid') as maplibre.GeoJSONSource;
        if (source) {
            source.setData(generateGridFeatures(cells));
        }
    }

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

    onMount(() => {
        if (!mapContainer) return;
        
        const [west, north] = bounds.boundA;
        const [east, south] = bounds.boundB;
        
        map = new maplibre.Map({
            container: mapContainer,
            style: STYLE_URL,
            bounds: [[west, south], [east, north]],
           // maxBounds: [
           //     [west - PADDING, south - PADDING],
           //     [east + PADDING, north + PADDING]
           // ],
            //minZoom: MIN_ZOOM,
            //maxZoom: MAX_ZOOM,
            zoom: DEFAULT_ZOOM,
            dragRotate: false,
            touchZoomRotate: false,
            dragPan: true,
            keyboard: true,
            scrollZoom: true
        });

        map.on('load', () => {
            map.addSource('grid', {
                type: 'geojson',
                data: generateGridFeatures(cells),
                promoteId: 'id'
            });

            // Add outlines layer
            map.addLayer({
                id: 'cell-outlines',
                type: 'line',
                source: 'grid',
                filter: ['==', ['get', 'isOutline'], true],
                paint: {
                    'line-color': '#4444ff',
                    'line-width': 0.5,
                    'line-opacity': 0.3
                }
            });

            // Add data squares layer
            map.addLayer({
                id: 'data-squares',
                type: 'fill',
                source: 'grid',
                filter: ['==', ['get', 'isData'], true],
                paint: {
                    'fill-color': '#0000ff',
                    'fill-opacity': 0.8
                }
            });

            // Handle hover events on outlines
            map.on('mousemove', 'cell-outlines', (e) => {
                if (e.features && e.features.length > 0) {
                    const feature = e.features[0];
                    dispatch('cellHover', {
                        id: feature.properties.cellId,
                        coordinates: feature.geometry.coordinates,
                        mouseX: e.point.x,
                        mouseY: e.point.y,
                        value: feature.properties.value,
                        count: feature.properties.count
                    });
                }
            });

            // Also keep hover events on inner squares
            map.on('mousemove', 'data-squares', (e) => {
                if (e.features && e.features.length > 0) {
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

            map.on('mouseleave', 'cell-outlines', () => {
                dispatch('cellLeave');
            });

            map.on('mouseleave', 'data-squares', () => {
                dispatch('cellLeave');
            });

            // Handle click events on both layers
            map.on('click', 'cell-outlines', (e) => {
                if (e.features && e.features.length > 0) {
                    const feature = e.features[0];
                    dispatch('cellClick', {
                        id: feature.properties.cellId,
                        coordinates: feature.geometry.coordinates,
                        value: feature.properties.value,
                        count: feature.properties.count
                    });
                }
            });

            map.on('click', 'data-squares', (e) => {
                if (e.features && e.features.length > 0) {
                    const feature = e.features[0];
                    dispatch('cellClick', {
                        id: feature.properties.id,
                        coordinates: feature.geometry.coordinates,
                        value: feature.properties.value,
                        count: feature.properties.count
                    });
                }
            });

            // Update cursor style for both layers
            map.on('mouseenter', 'cell-outlines', () => {
                map.getCanvas().style.cursor = 'pointer';
            });

            map.on('mouseenter', 'data-squares', () => {
                map.getCanvas().style.cursor = 'pointer';
            });

            map.on('mouseleave', 'cell-outlines', () => {
                map.getCanvas().style.cursor = '';
            });

            map.on('mouseleave', 'data-squares', () => {
                map.getCanvas().style.cursor = '';
            });
        });
    });

    onDestroy(() => {
        if (map) {
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
