<script lang="ts">
    import { PUBLIC_MAPTILER_API_KEY } from '$env/static/public';
    import { onMount, onDestroy, createEventDispatcher } from 'svelte';
    import maplibre, { type Map, type LngLatLike } from 'maplibre-gl';
    import 'maplibre-gl/dist/maplibre-gl.css';

    const dispatch = createEventDispatcher<{
        cellHover: {
            id: string;
            coordinates: number[][];
            mouseX: number;
            mouseY: number;
            value: number;
        };
        cellLeave: void;
        cellClick: {
            id: string;
            coordinates: number[][];
            value: number;
        };
    }>();

    interface CenterPoint {
        lng: number;
        lat: number;
    }

    interface GridOptions {
        centerPoint: CenterPoint;
        cellSize: number;
        numCells: number;
    }

    interface CellData {
        [key: string]: number;
    }

    // Configuration constants
    const CENTER_POINT: CenterPoint = {
        lng: 4.897184,
        lat: 52.374477
    };

    const CELL_SIZE = 0.001;
    const NUM_CELLS = 60;
    const MIN_VALUE_THRESHOLD = 0.2;

    const MIN_ZOOM = 11;
    const MAX_ZOOM = 16;
    const DEFAULT_ZOOM = 13;
    const PADDING = 0.1;

    const STYLE_URL = `https://api.maptiler.com/maps/8b292bff-5b9a-4be2-aaea-22585e67cf10/style.json?key=${PUBLIC_MAPTILER_API_KEY}`;

    // State variables
    let currentData: CellData = {};
    let map: Map | undefined;
    let mapContainer: HTMLElement;
    let hoveredStateId: string | null = null;

    function getLatitudeAdjustmentFactor(latitude: number): number {
        return 1 / Math.cos((latitude * Math.PI) / 180);
    }

    function calculateBounds(centerPoint: CenterPoint, cellSize: number, numCells: number) {
        const latAdjustment = getLatitudeAdjustmentFactor(centerPoint.lat);
        const totalSizeLng = cellSize * numCells;
        const totalSizeLat = (cellSize / latAdjustment) * numCells;
        
        return {
            west: centerPoint.lng - (totalSizeLng / 2),
            east: centerPoint.lng + (totalSizeLng / 2),
            south: centerPoint.lat - (totalSizeLat / 2),
            north: centerPoint.lat + (totalSizeLat / 2)
        };
    }

    const BOUNDS = calculateBounds(CENTER_POINT, CELL_SIZE, NUM_CELLS);
    const MAX_BOUNDS = [
        [BOUNDS.west - PADDING, BOUNDS.south - PADDING],
        [BOUNDS.east + PADDING, BOUNDS.north + PADDING]
    ];

    function generateRandomData(): CellData {
        const data: CellData = {};
        for (let i = 0; i < NUM_CELLS; i++) {
            for (let j = 0; j < NUM_CELLS; j++) {
                const value = Math.random();
                if (value > MIN_VALUE_THRESHOLD) {
                    data[`cell-${i}-${j}`] = value;
                }
            }
        }
        return data;
    }

    export function updateData(newData: CellData) {
        if (!map) return;
        
        currentData = newData;
        const source = map.getSource('grid') as maplibre.GeoJSONSource;
        if (source) {
            source.setData(generateGridFeatures(newData));
        }
    }

    function calculateInnerSquareCoordinates(
        centerLng: number,
        centerLat: number,
        cellSizeLng: number,
        cellSizeLat: number,
        value: number
    ): number[][] {
        // Scale from 10% to 90% of cell size based on value
        const scale = 0.1 + (value * 0.8);
        const halfSizeLng = (cellSizeLng * scale) / 2;
        const halfSizeLat = (cellSizeLat * scale) / 2;

        return [
            [centerLng - halfSizeLng, centerLat - halfSizeLat],
            [centerLng + halfSizeLng, centerLat - halfSizeLat],
            [centerLng + halfSizeLng, centerLat + halfSizeLat],
            [centerLng - halfSizeLng, centerLat + halfSizeLat],
            [centerLng - halfSizeLng, centerLat - halfSizeLat]
        ];
    }

    function generateGridFeatures(data: CellData = {}) {
        const features = [];
        
        const latAdjustment = getLatitudeAdjustmentFactor(CENTER_POINT.lat);
        const latCellSize = CELL_SIZE / latAdjustment;
        
        const totalSizeLng = CELL_SIZE * NUM_CELLS;
        const totalSizeLat = latCellSize * NUM_CELLS;
        const startLng = CENTER_POINT.lng - (totalSizeLng / 2);
        const startLat = CENTER_POINT.lat - (totalSizeLat / 2);
        
        // Generate only for cells with data
        for (let i = 0; i < NUM_CELLS; i++) {
            for (let j = 0; j < NUM_CELLS; j++) {
                const cellId = `cell-${i}-${j}`;
                const value = data[cellId];

                // Only create features for cells with data above threshold
                if (value !== undefined && value > MIN_VALUE_THRESHOLD) {
                    const cellLng = startLng + (i * CELL_SIZE);
                    const cellLat = startLat + (j * latCellSize);
                    const centerLng = cellLng + (CELL_SIZE / 2);
                    const centerLat = cellLat + (latCellSize / 2);

                    // Add the outline
                    features.push({
                        type: 'Feature',
                        properties: {
                            id: `outline-${cellId}`,
                            gridX: i,
                            gridY: j,
                            isOutline: true
                        },
                        geometry: {
                            type: 'Polygon',
                            coordinates: [[
                                [cellLng, cellLat],
                                [cellLng + CELL_SIZE, cellLat],
                                [cellLng + CELL_SIZE, cellLat + latCellSize],
                                [cellLng, cellLat + latCellSize],
                                [cellLng, cellLat]
                            ]]
                        }
                    });

                    // Add the inner data square
                    features.push({
                        type: 'Feature',
                        properties: {
                            id: `data-${cellId}`,
                            gridX: i,
                            gridY: j,
                            value: value,
                            isData: true
                        },
                        geometry: {
                            type: 'Polygon',
                            coordinates: [
                                calculateInnerSquareCoordinates(
                                    centerLng,
                                    centerLat,
                                    CELL_SIZE,
                                    latCellSize,
                                    value
                                )
                            ]
                        }
                    });
                }
            }
        }

        return {
            type: 'FeatureCollection',
            features: features
        };
    }

    onMount(() => {
        if (!mapContainer) return;
        
        currentData = generateRandomData();
        
        map = new maplibre.Map({
            container: mapContainer,
            style: STYLE_URL,
            bounds: [
                [BOUNDS.west, BOUNDS.south],
                [BOUNDS.east, BOUNDS.north]
            ],
            maxBounds: MAX_BOUNDS,
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
            map.addSource('grid', {
                type: 'geojson',
                data: generateGridFeatures(currentData),
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

            map.on('mousemove', 'data-squares', (e) => {
                if (e.features && e.features.length > 0) {
                    const feature = e.features[0];
                    dispatch('cellHover', {
                        id: feature.properties.id,
                        coordinates: feature.geometry.coordinates,
                        mouseX: e.point.x,
                        mouseY: e.point.y,
                        value: feature.properties.value
                    });
                }
            });

            map.on('mouseleave', 'data-squares', () => {
                dispatch('cellLeave');
            });

            map.on('click', 'data-squares', (e) => {
                if (e.features && e.features.length > 0) {
                    const feature = e.features[0];
                    dispatch('cellClick', {
                        id: feature.properties.id,
                        coordinates: feature.geometry.coordinates,
                        value: feature.properties.value
                    });
                }
            });

            map.on('mouseenter', 'data-squares', () => {
                map.getCanvas().style.cursor = 'pointer';
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
