<!-- MapWithGrid.svelte -->
<script lang="ts">
    import { PUBLIC_MAPTILER_API_KEY } from '$env/static/public';
    import { onMount, onDestroy } from 'svelte';
    import maplibre, { type Map, type LngLatLike, type LngLatBounds } from 'maplibre-gl';

    export let center: LngLatLike = [4.9, 52.37];
    export let zoom: number = 6;

    interface GridCell {
        id: string;
        coordinates: [number, number];
        value: number;
        dataPoints: number;
    }

    let map: Map | undefined;
    let mapContainer: HTMLElement;
    let viewportCells: GridCell[] = [];
    let focusedCell: string | null = null;

    const STYLE_URL = `https://api.maptiler.com/maps/8b292bff-5b9a-4be2-aaea-22585e67cf10/style.json?key=${PUBLIC_MAPTILER_API_KEY}`;
    const BASE_CELL_SIZE_DEGREES = 0.01; // Roughly 1km at equator

    function calculateGridCells(bounds: LngLatBounds) {
        const cellSize = BASE_CELL_SIZE_DEGREES;
        
        const west = Math.floor(bounds.getWest() / cellSize) * cellSize;
        const east = Math.ceil(bounds.getEast() / cellSize) * cellSize;
        const south = Math.floor(bounds.getSouth() / cellSize) * cellSize;
        const north = Math.ceil(bounds.getNorth() / cellSize) * cellSize;

        const newCells: GridCell[] = [];
        
        for (let lng = west; lng < east; lng += cellSize) {
            for (let lat = south; lat < north; lat += cellSize) {
                newCells.push({
                    id: `cell-${lng}-${lat}`,
                    coordinates: [lng, lat],
                    value: Math.random(),
                    dataPoints: Math.floor(Math.random() * 100)
                });
            }
        }

        return newCells;
    }

    function updateGrid() {
        if (!map) return;
        const bounds = map.getBounds();
        viewportCells = calculateGridCells(bounds);
    }

    function projectToPixel(lngLat: [number, number]): [number, number] {
        if (!map) return [0, 0];
        const point = map.project(lngLat);
        return [point.x, point.y];
    }

    function getNextCoordinate(coord: number, cellSize: number): number {
        return coord + cellSize;
    }

    function handleCellFocus(cellId: string) {
        focusedCell = cellId;
    }

    function getGridCellStyle(coordinates: [number, number]) {
        if (!map) return '';
        
        // Get the pixel coordinates for current point and next point
        const [x1, y1] = projectToPixel(coordinates);
        const [x2, y2] = projectToPixel([
            getNextCoordinate(coordinates[0], BASE_CELL_SIZE_DEGREES),
            getNextCoordinate(coordinates[1], BASE_CELL_SIZE_DEGREES)
        ]);

        // Calculate width and height in pixels
        const width = Math.abs(x2 - x1);
        const height = Math.abs(y2 - y1);

        return `
            position: absolute;
            left: ${x1}px;
            top: ${y1}px;
            width: ${width}px;
            height: ${height}px;
        `;
    }

    onMount(() => {
        if (!mapContainer) return;
        
        map = new maplibre.Map({
            container: mapContainer,
            style: STYLE_URL,
            center: center,
            zoom: zoom,
            interactive: true // Explicitly enable interactions
        });

        map.on('load', () => {
            updateGrid();
        });

        // Update grid on map movement
        map.on('moveend', updateGrid);
        map.on('zoomend', updateGrid);
    });

    onDestroy(() => {
        if (map) {
            map.remove();
        }
    });

    $: focusedCellData = focusedCell 
        ? viewportCells.find(c => c.id === focusedCell)
        : null;
</script>

<div bind:this={mapContainer} class="map-container">
    <!-- SVG Overlay -->
    <svg class="absolute inset-0 w-full h-full pointer-events-none">
        {#each viewportCells as cell}
            {@const [x1, y1] = projectToPixel(cell.coordinates)}
            {@const [x2, y2] = projectToPixel([
                getNextCoordinate(cell.coordinates[0], BASE_CELL_SIZE_DEGREES),
                getNextCoordinate(cell.coordinates[1], BASE_CELL_SIZE_DEGREES)
            ])}
            <rect
                x={x1}
                y={y1}
                width={Math.abs(x2 - x1)}
                height={Math.abs(y2 - y1)}
                fill="rgb(0, 0, {Math.floor(cell.value * 255)})"
                opacity={focusedCell === cell.id ? 0.8 : 0.6}
            />
        {/each}
    </svg>

    <!-- Accessible Interactive Layer -->
    <div 
        class="absolute inset-0"
        role="grid"
        aria-label="Historical data heatmap"
    >
        {#each viewportCells as cell}
            <button
                class="absolute focus:outline-none focus:ring-1 focus:ring-blue-500 focus:ring-inset focus:z-10 hover:ring-1 hover:ring-blue-300"
                style={getGridCellStyle(cell.coordinates)}
                on:focus={() => handleCellFocus(cell.id)}
                aria-label="Grid cell with {Math.floor(cell.value * 100)}% data density"
                tabindex="0"
            >
                <span class="sr-only">
                    Contains {cell.dataPoints} historical records
                </span>
            </button>
        {/each}
    </div>

    <!-- Tooltip -->
    {#if focusedCellData}
        {@const [x, y] = projectToPixel(focusedCellData.coordinates)}
        <div
            role="tooltip"
            class="absolute p-4 bg-white shadow-lg rounded-lg z-20"
            style="left: {x}px; top: {y}px"
        >
            <h3 class="font-bold text-sm">Cell Details</h3>
            <p class="text-sm">
                Coordinates: {focusedCellData.coordinates[0].toFixed(4)}, {focusedCellData.coordinates[1].toFixed(4)}
                <br />
                Data density: {Math.floor(focusedCellData.value * 100)}%
                <br />
                Records: {focusedCellData.dataPoints}
            </p>
        </div>
    {/if}
</div>

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
