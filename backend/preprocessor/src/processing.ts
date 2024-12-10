import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { Point2D, 
         PointFeature,
         MultiLineStringFeature,
         LineStringFeature,
         PolygonFeature,
         GeoFeature,
         GridConfig,
         GridDimensions,
         GridCellCount,
         GridCellBounds } from '@atm/shared-types';


interface ProcessedGridData {
    cellCounts: Map<string, number>;
    entityGridIndices: Map<string, string>;
    dimensions: GridDimensions;
}

const calculateGridDimensions = (config: GridConfig): GridDimensions => {
    const minLon = Math.min(config.boundA[0], config.boundB[0]);
    const maxLon = Math.max(config.boundA[0], config.boundB[0]);
    const minLat = Math.min(config.boundA[1], config.boundB[1]);
    const maxLat = Math.max(config.boundA[1], config.boundB[1]);
    
    const latSpan = Math.abs(config.boundA[1] - config.boundB[1]);
    const lonSpan = Math.abs(config.boundA[0] - config.boundB[0]);
    
    return {
        cellWidth: lonSpan / config.width_n,
        cellHeight: latSpan / config.height_n,
        minLon,
        maxLon,
        minLat,
        maxLat
    };
};

const getCellIdForPoint = (
    point: Point2D,
    dimensions: GridDimensions,
    config: GridConfig
): string | null => {
    const col = Math.floor((point.x - dimensions.minLon) / dimensions.cellWidth);
    const row = Math.floor((point.y - dimensions.minLat) / dimensions.cellHeight);

    if (row >= 0 && row < config.height_n && col >= 0 && col < config.width_n) {
        return `${row}_${col}`;
    }
    return null;
};

const getCellBounds = (
    cellId: string, 
    dimensions: GridDimensions,
    config: GridConfig
): GridCellBounds => {
    const [row, col] = cellId.split('_').map(Number);
    
    const minLon = dimensions.minLon + (col / config.width_n) * (dimensions.maxLon - dimensions.minLon);
    const maxLon = dimensions.minLon + ((col + 1) / config.width_n) * (dimensions.maxLon - dimensions.minLon);
    const minLat = dimensions.minLat + (row / config.height_n) * (dimensions.maxLat - dimensions.minLat);
    const maxLat = dimensions.minLat + ((row + 1) / config.height_n) * (dimensions.maxLat - dimensions.minLat);

    return { minLon, maxLon, minLat, maxLat };
};

const gridifyGeoFeatures = (features: GeoFeature[], config: GridConfig): ProcessedGridData => {
    const dimensions = calculateGridDimensions(config);
    const cellCounts = new Map<string, number>();
    const entityGridIndices = new Map<string, string>();

    features.forEach(feature => {
        let point: Point2D | undefined;
        
        if (feature.geometry.type === "Point") {
            point = {
                x: feature.geometry.coordinates[0],
                y: feature.geometry.coordinates[1]
            };
        } else {
            point = feature.geometry.centroid;
        }

        if (!point) return;

        const cellId = getCellIdForPoint(point, dimensions, config);
        if (!cellId) return;

        entityGridIndices.set(feature.properties.url, cellId);
        cellCounts.set(cellId, (cellCounts.get(cellId) || 0) + 1);
    });

    return { cellCounts, entityGridIndices, dimensions };
};

const getHeatmapData = (
    processedData: ProcessedGridData,
    config: GridConfig
): GridCellCount[] => {
    return Array.from(processedData.cellCounts.entries()).map(([cellId, count]) => ({
        cellId,
        count,
        bounds: getCellBounds(cellId, processedData.dimensions, config)
    }));
};

const getCellFeatures = (
    cellId: string,
    features: GeoFeature[],
    processedData: ProcessedGridData
): GeoFeature[] => {
    return features.filter(feature => 
        processedData.entityGridIndices.get(feature.properties.url) === cellId
    );
};

const filterByTimeRange = (
    features: GeoFeature[],
    startDate?: string,
    endDate?: string
): GeoFeature[] => {
    if (!startDate && !endDate) return features;
    
    return features.filter(feature => {
        const itemStart = new Date(feature.properties.start_date);
        const itemEnd = new Date(feature.properties.end_date);
        const filterStart = startDate ? new Date(startDate) : new Date(0);
        const filterEnd = endDate ? new Date(endDate) : new Date();
        
        return itemStart >= filterStart && itemEnd <= filterEnd;
    });
};

function calculateCentroid(coordinates: [number, number][]): Point2D {
    const sum = coordinates.reduce(
        (acc, [x, y]) => ({
            x: acc.x + x,
            y: acc.y + y
        }),
        { x: 0, y: 0 }
    );
    
    return {
        x: sum.x / coordinates.length,
        y: sum.y / coordinates.length
    };
}

function calculateMultiLineCentroid(coordinates: [number, number][][]): Point2D {
    const allPoints = coordinates.flat();
    return calculateCentroid(allPoints);
}

async function extractGeoFeaturesFromGeoJsonFolder(
    folderPath: string, 
    options = { dropNulls: true }
): Promise<GeoFeature[]> {
    const files = await readdir(folderPath);
    const geoJsonFiles = files.filter(f => f.endsWith('.json'));
    
    const features: GeoFeature[] = [];
    
    for (const file of geoJsonFiles) {
        const rawData = await Bun.file(join(folderPath, file)).json();
        
        for (const feature of rawData.features) {
            switch (feature.geometry.type) {
                case "Point": {
                    const [x, y] = feature.geometry.coordinates;
                    if (options.dropNulls && (isNaN(x) || isNaN(y))) continue;
                    features.push(feature as PointFeature);
                    break;
                }
                    
                case "MultiLineString": {
                    const validCoordinates = options.dropNulls 
                        ? feature.geometry.coordinates.map((line: [number, number][]) => 
                            line.filter(([x, y]: [number, number]) => !isNaN(x) && !isNaN(y))
                          ).filter((line: [number, number][]) => line.length > 0)
                        : feature.geometry.coordinates;
                    
                    if (options.dropNulls && validCoordinates.length === 0) continue;
                    
                    const multiLine: MultiLineStringFeature = {
                        ...feature,
                        geometry: {
                            ...feature.geometry,
                            coordinates: validCoordinates,
                            centroid: calculateMultiLineCentroid(validCoordinates)
                        }
                    };
                    features.push(multiLine);
                    break;
                }
                
                case "LineString": {
                    const validCoordinates = options.dropNulls 
                        ? feature.geometry.coordinates.filter(([x, y]) => !isNaN(x) && !isNaN(y))
                        : feature.geometry.coordinates;
                    
                    if (options.dropNulls && validCoordinates.length === 0) continue;
                    
                    const line: LineStringFeature = {
                        ...feature,
                        geometry: {
                            ...feature.geometry,
                            coordinates: validCoordinates,
                            centroid: calculateCentroid(validCoordinates)
                        }
                    };
                    features.push(line);
                    break;
                }
                
                case "Polygon": {
                    const validCoordinates = feature.geometry.coordinates.map((ring: [number, number][]) => 
                        options.dropNulls 
                            ? ring.filter(([x, y]) => !isNaN(x) && !isNaN(y))
                            : ring
                    ).filter((ring: [number, number][]) => ring.length > 0);
                    
                    if (options.dropNulls && validCoordinates.length === 0) continue;
                    
                    const coordinates2D = validCoordinates[0]
                        .map(([x, y]) => [x, y] as [number, number]);
                        
                    const polygon: PolygonFeature = {
                        ...feature,
                        geometry: {
                            ...feature.geometry,
                            coordinates: validCoordinates,
                            centroid: calculateCentroid(coordinates2D)
                        }
                    };
                    features.push(polygon);
                    break;
                }
            }
        }
    }
    
    return features;
}

export {
    gridifyGeoFeatures,
    extractGeoFeaturesFromGeoJsonFolder
}

