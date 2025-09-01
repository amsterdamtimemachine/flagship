<!-- Map.svelte -->
<script lang="ts">
	import { PUBLIC_MAPTILER_API_KEY } from '$env/static/public';
	const STYLE_URL = `https://api.maptiler.com/maps/8b292bff-5b9a-4be2-aaea-22585e67cf10/style.json?key=${PUBLIC_MAPTILER_API_KEY}`;
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { onMount, onDestroy } from 'svelte';
	import maplibre, { type Map as MapLibreMap } from 'maplibre-gl';
	import type { FeatureCollection, Feature, Polygon, GeoJSONProperties } from 'geojson';
	import type { Heatmap, HeatmapDimensions, HeatmapBlueprintCell } from '@atm/shared/types';
	import { mergeCss } from '$utils/utils';

	interface CellProperties extends GeoJSONProperties {
		id: string;
		row: number;
		col: number;
		count: number;
	}

	export interface MapProps {
		heatmap: Heatmap;
		heatmapBlueprint: HeatmapBlueprintCell[];
		dimensions: HeatmapDimensions;
		selectedCellId: string | null;
		class?: string;
		handleCellClick?: (cellId: string | null) => void;
		handleMapLoaded?: () => void;
	}

	let {
		heatmap,
		heatmapBlueprint,
		dimensions,
		selectedCellId = null,
		class: className,
		handleCellClick,
		handleMapLoaded
	}: MapProps = $props();

	let map: MapLibreMap | undefined = $state();
	let mapContainer: HTMLElement;
	let isMapLoaded = $state(false);

	const cellIdMap = $derived.by(() => {
		const idMap = new Map<number, string>();
		if (!heatmapBlueprint || !dimensions) {
			return idMap;
		}

		heatmapBlueprint.forEach((cell) => {
			const index = cell.row * dimensions.colsAmount + cell.col;
			idMap.set(index, cell.cellId);
		});

		return idMap;
	});

	let activeCells = $derived.by(() => {
		if (!isMapLoaded || !map || !heatmap || !heatmap.countArray || !cellIdMap.size) {
			return new Map<string, { value: number; count: number }>();
		}

		const { densityArray, countArray } = heatmap;
		const result = new Map<string, { value: number; count: number }>();

		for (let i = 0; i < countArray.length; i++) {
			const count = countArray[i];
			if (count > 0) {
				const cellId = cellIdMap.get(i);
				if (cellId) {
					result.set(cellId, {
						value: densityArray[i] || 0,
						count
					});
				}
			}
		}

		return result;
	});

	// Update heatmap cells when active cells change
	$effect(() => {
		if (!isMapLoaded || !map || !heatmapBlueprint) return;
		resetAllCells();
		setActiveCells();
	});

	// Handle selected cell changes - THIS FIXES THE HIGHLIGHTING ISSUE
	$effect(() => {
		if (isMapLoaded && map) {
			updateSelectedCell(selectedCellId);
		}
	});

	onMount(() => {
		initializeMap();
	});

	onDestroy(() => {
		if (map) {
			map.off('mousemove', 'heatmap-squares');
			map.off('mouseleave', 'heatmap-squares');
			map.off('click', 'heatmap-squares');
			map.off('mouseenter', 'heatmap-squares');
			map.remove();
		}
	});

	function resetAllCells(): void {
		if (!map || !cellIdMap.size) return;
		cellIdMap.forEach((cellId) => {
			if (cellId) {
				map.setFeatureState(
					{ source: 'heatmap', id: cellId },
					{
						value: 0,
						count: 0
					}
				);
			}
		});
	}

	function setActiveCells(): void {
		if (!map) return;
		activeCells.forEach((stateValues, cellId) => {
			map.setFeatureState({ source: 'heatmap', id: cellId }, stateValues);
		});
	}

	function generateHeatmapCells(
		blueprint: HeatmapBlueprintCell[]
	): FeatureCollection<Polygon, CellProperties> {
		const features = blueprint.map(
			(cell): Feature<Polygon, CellProperties> => ({
				type: 'Feature',
				id: cell.cellId,
				properties: {
					id: cell.cellId,
					row: cell.row,
					col: cell.col,
					count: 0
				},
				geometry: {
					type: 'Polygon',
					coordinates: [
						[
							[cell.bounds.minLon, cell.bounds.minLat],
							[cell.bounds.maxLon, cell.bounds.minLat],
							[cell.bounds.maxLon, cell.bounds.maxLat],
							[cell.bounds.minLon, cell.bounds.maxLat],
							[cell.bounds.minLon, cell.bounds.minLat]
						]
					]
				}
			})
		);

		return {
			type: 'FeatureCollection',
			features
		};
	}

	function updateSelectedCell(cellId: string | null): void {
		if (!isMapLoaded || !map || !cellIdMap.size) return;

		// Clear all previous highlights
		cellIdMap.forEach((id) => {
			if (id) {
				map.setFeatureState({ source: 'heatmap', id }, { selected: false });
			}
		});

		// Set new highlight
		if (cellId) {
			map.setFeatureState({ source: 'heatmap', id: cellId }, { selected: true });
		}
	}

	function initializeMap(): void {
		if (!mapContainer) return;

		const { minLon: west, maxLon: east, minLat: south, maxLat: north } = dimensions;

		map = new maplibre.Map({
			container: mapContainer,
			style: STYLE_URL,
			//	maxBounds: [
			//		[west, south],
			//		[east, north]
			//	],
			center: [4.895645, 52.372219],
			minZoom: 10,
			maxZoom: 14,
			zoom: 13,
			dragRotate: false,
			touchZoomRotate: false,
			dragPan: true,
			keyboard: true,
			scrollZoom: true
		});

		map.on('load', () => {
			// Heatmap geometry
			const geojsonData = generateHeatmapCells(heatmapBlueprint);

			map.addSource('heatmap', {
				type: 'geojson',
				data: geojsonData,
				promoteId: 'id'
			});

			// Color and opacity of the heatmaps cells
			map.addLayer({
				id: 'heatmap-squares',
				type: 'fill',
				source: 'heatmap',
				paint: {
					'fill-color': '#0000ff',
					'fill-opacity': ['coalesce', ['feature-state', 'value'], 0]
				}
			});

			// Active cell
			map.addLayer({
				id: 'selected-cell',
				type: 'line',
				source: 'heatmap',
				paint: {
					'line-color': '#ff0000',
					'line-width': 2,
					'line-opacity': ['case', ['boolean', ['feature-state', 'selected'], false], 1, 0]
				}
			});

			// Event handlers
			map.on('mousemove', 'heatmap-squares', (e) => {
				if (e.features?.[0]) {
					const feature = e.features[0];
					const featureState = map.getFeatureState({
						source: 'heatmap',
						id: feature.properties.id
					});
					if (featureState.count > 0) {
						map.getCanvas().style.cursor = 'pointer';
					} else {
						map.getCanvas().style.cursor = '';
					}
				}
			});

			map.on('mouseleave', 'heatmap-squares', () => {
				map.getCanvas().style.cursor = '';
			});

			map.on('click', 'heatmap-squares', (e) => {
				if (e.features?.[0]) {
					const feature = e.features[0];
					const featureId = feature.properties.id;
					const featureState = map.getFeatureState({ source: 'heatmap', id: featureId });

					// select only cells with values
					if (featureState.count > 0) {
						// deselect the currently selected cell if its clicked
						if (featureId === selectedCellId) {
							if (handleCellClick) {
								handleCellClick(null);
							}
						} else {
							// parent callback
							if (handleCellClick) {
								handleCellClick(feature.properties.id);
							}
						}
					}
				}
			});

			isMapLoaded = true;

			if (handleMapLoaded) {
				handleMapLoaded();
			}
		});
	}
</script>

<div class={mergeCss('h-full w-full', className)}>
	<div bind:this={mapContainer} class="h-full w-full"></div>
</div>
