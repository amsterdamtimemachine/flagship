<script lang="ts">
	import { PUBLIC_MAPTILER_API_KEY } from '$env/static/public';
	// WIP: this should be env import
	const STYLE_URL = `https://api.maptiler.com/maps/8b292bff-5b9a-4be2-aaea-22585e67cf10/style.json?key=${PUBLIC_MAPTILER_API_KEY}`;
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import maplibre, { 
		type Map, 
		type FeatureCollection, 
		type Feature, 
		type Polygon,
		type GeoJSONProperties
	} from 'maplibre-gl';
	import type { Heatmap, HeatmapCell, GridDimensions } from '@atm/shared-types';
	import debounce from 'lodash.debounce';
	import { mergeCss } from '$utils/utils';

	interface CellProperties extends GeoJSONProperties {
		id: string;
		row: number;
		col: number;
		count: number;
	}

//	let modalData = $state({
//		id: '',
//		coordinates: [] as number[][],
//		position: { x: 0, y: 0 },
//		value: undefined as number | undefined,
//		count: undefined as number | undefined
//	});


	interface Props {
		heatmap: Heatmap;
		heatmapBlueprint: HeatmapCell[];
		dimensions: GridDimensions;
		selectedCellId: string | null;
		className?: string;
		handleCellClick?: (cellId: string | null) => void; 
	}

	let {
		heatmap,
		heatmapBlueprint,
		dimensions,
		selectedCellId = null,
		class: className,
		handleCellClick,
	}: Props = $props();

	let map: Map | undefined = $state();
	let mapContainer: HTMLElement = $state();
	let isMapLoaded = $state(false);
	let activeCellIds = $state(new Set<string>());

	const cellIdMap = $derived.by(() => {
		const idMap = new Map<number, string>();
		heatmapBlueprint.forEach((cell) => {
			const index = cell.row * dimensions.colsAmount + cell.col;
			idMap.set(index, cell.cellId);
		});
		return idMap;
	});

	let activeCells = $derived.by(() => {
		if (!isMapLoaded || !map || !heatmap) {
			return new Map<string, { value: number, count: number }>();
		}
		
		const { densityArray, countArray } = heatmap;
		const result = new Map<string, { value: number, count: number }>();
		
		// Calculate active cells and their values
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
	
	// update heatmap cells when active cells change
	$effect(() => {
		if (!isMapLoaded || !map || !heatmapBlueprint) return;
			
		// Clear ALL cells to default state first
		heatmapBlueprint.forEach(cell => {
			map.setFeatureState(
				{ source: 'grid', id: cell.cellId },
				{
					value: 0,
					count: 0
				}
			);
		});
		
		// Then set feature states only for active cells
		activeCells.forEach((stateValues, cellId) => {
			map.setFeatureState(
				{ source: 'grid', id: cellId },
				stateValues
			);
		});
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

	function generateHeatmapFeatures(blueprint: HeatmapCell[]): FeatureCollection<Polygon, CellProperties> {
		const features = blueprint.map((cell): Feature<Polygon, CellProperties> => ({
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
		}));
		
		return {
			type: 'FeatureCollection',
			features
		};
	}

	function updateFeatureStates(map, heatmapData): void {
		const { densityArray, countArray } = heatmapData;
		const newActiveCellIds = new Set();
		// Only iterate through values that exist in the array
		for (let i = 0; i < countArray.length; i++) {
			const count = countArray[i];
			if (count > 0) {
				const cellId = cellIdMap.get(i);
				if (cellId) {
					// Set the feature state for cells with values
					map.setFeatureState(
						{ source: 'grid', id: cellId },
						{
							value: densityArray[i] || 0,
							count
						}
					);
					newActiveCellIds.add(cellId);
				}
			}
		}
		// Clear cells inactive cells
		activeCellIds.forEach((cellId) => {
			if (!newActiveCellIds.has(cellId)) {
				map.setFeatureState(
					{ source: 'grid', id: cellId },
					{
						value: 0,
						count: 0
					}
				);
			}
		});
		// Update the tracking set
		activeCellIds = newActiveCellIds;
	}

	function updateSelectedCell(cellId: string | null): void {
		if (!isMapLoaded || !map) return;

		// Clear previous highlight
		if (selectedCellId) {
			map.setFeatureState({ source: 'grid', id: selectedCellId }, { selected: false });
		}

		selectedCellId = cellId;

		// Set new highlight
		if (cellId) {
			map.setFeatureState({ source: 'grid', id: cellId }, { selected: true });
		}
	}

	function initializeMap(): void {
		if (!mapContainer) return;

		const { minLon: west, maxLon: east, minLat: south, maxLat: north } = dimensions;

		map = new maplibre.Map({
			container: mapContainer,
			style: STYLE_URL,
			maxBounds: [
				[west, south],
				[east, north]
			],
			center: [4.895645, 52.372219], // amsterdam center
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
			// Add source with blueprint features
			map.addSource('grid', {
				type: 'geojson',
				data: generateHeatmapFeatures(heatmapBlueprint),
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

			map.addLayer({
				id: 'selected-cell',
				type: 'line',
				source: 'grid',
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
					const featureState = map.getFeatureState({ source: 'grid', id: feature.properties.id });
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
					const featureState = map.getFeatureState({ source: 'grid', id: featureId });

					// select only cells with values
					if (featureState.count > 0) {
						// deselect the currently selected cell if its clicked 
						if (featureId === selectedCellId) {
							// Update local selection state
							selectedCellId = null;

							// Update visual state
							map.setFeatureState(
								{ source: 'grid', id: featureId },
								{ selected: false }
							);

							// update parent
							if(handleCellClick) {
								handleCellClick(null);
							}
						} else {
							updateSelectedCell(featureId);

							// update parent
							if(handleCellClick) {
								handleCellClick(feature.properties.id);
							}

						}
					}
				}
			});
			isMapLoaded = true;
		});
	}


</script>

<div class={mergeCss('h-full w-full', className)}>
	<div bind:this={mapContainer} class="h-full w-full"></div>
</div>
