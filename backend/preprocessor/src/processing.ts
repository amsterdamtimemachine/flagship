import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { Point2D, 
         PointFeature,
         MultiLineStringFeature,
         LineStringFeature,
         PolygonFeature,
         GeoFeature,
         Grid,
         GridConfig,
         GridDimensions,
         GridCellCount,
         GridCellBounds } from '@atm/shared-types';

const getGridDimensionsFromConfig = (config: GridConfig): GridDimensions => {
    const minLon = Math.min(config.boundA[0], config.boundB[0]);
    const maxLon = Math.max(config.boundA[0], config.boundB[0]);
    const minLat = Math.min(config.boundA[1], config.boundB[1]);
    const maxLat = Math.max(config.boundA[1], config.boundB[1]);
    
    const latSpan = Math.abs(config.boundA[1] - config.boundB[1]);
    const lonSpan = Math.abs(config.boundA[0] - config.boundB[0]);
    
    return {
        colsAmount: config.colsAmount,
        rowsAmount: config.rowsAmount,
        cellWidth: lonSpan / config.colsAmount,
        cellHeight: latSpan / config.rowsAmount,
        minLon,
        maxLon,
        minLat,
        maxLat
    };
};

const getCellIdForPoint = (
    point: Point2D,
    gridDimensions: GridDimensions,
): string | null => {
    const col = Math.floor((point.x - gridDimensions.minLon) / gridDimensions.cellWidth);
    const row = Math.floor((point.y - gridDimensions.minLat) / gridDimensions.cellHeight);

    if (row >= 0 && row < gridDimensions.rowsAmount && col >= 0 && col < gridDimensions.colsAmount) {
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
    
    const minLon = dimensions.minLon + (col / config.colsAmount) * (dimensions.maxLon - dimensions.minLon);
    const maxLon = dimensions.minLon + ((col + 1) / config.colsAmount) * (dimensions.maxLon - dimensions.minLon);
    const minLat = dimensions.minLat + (row / config.rowsAmount) * (dimensions.maxLat - dimensions.minLat);
    const maxLat = dimensions.minLat + ((row + 1) / config.rowsAmount) * (dimensions.maxLat - dimensions.minLat);

    return { minLon, maxLon, minLat, maxLat };
};

const getHeatmapData = (
    processedData: Grid,
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
    processedData: Grid 
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

const gridifyGeoFeatures = (features: GeoFeature[], config: GridConfig): Grid => {
    const dimensions =getGridDimensionsFromConfig(config);
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
        const cellId = getCellIdForPoint(point, dimensions);
        if (!cellId) return;

        entityGridIndices.set(feature.properties.url, cellId);
        cellCounts.set(cellId, (cellCounts.get(cellId) || 0) + 1);
    });

    return { cellCounts, entityGridIndices, dimensions };
};

function coordsMetersToLatLon(x: number, y: number): [number, number] {
   const halfEarthCircumference = 20037508.34; 
   const lon = (x / halfEarthCircumference) * 180;
   let lat = (y / halfEarthCircumference) * 180;
   lat = (Math.atan(Math.exp(lat * Math.PI / 180)) * 360 / Math.PI) - 90;
   return [lon, lat];
}

interface ExtractFeaturesOptions {
   dropNulls: boolean;
   convertMetersToLatLon: boolean;
}
async function extractGeoFeaturesFromGeoJsonFolder(
   folderPath: string, 
   options: ExtractFeaturesOptions = { dropNulls: false, convertMetersToLatLon: false }
): Promise<GeoFeature[]> {
   const files = await readdir(folderPath);
   const geoJsonFiles = files.filter(f => f.endsWith('.geojson'));
   
   const features: GeoFeature[] = [];
   
   for (const file of geoJsonFiles) {
       const rawData = await Bun.file(join(folderPath, file)).json();
       
       for (const feature of rawData.features) {
           switch (feature.geometry.type) {
               case "Point": {
                   const [x, y] = feature.geometry.coordinates;
                   if (options.dropNulls && (isNaN(x) || isNaN(y))) continue;
                   
                   const coordinates = options.convertMetersToLatLon 
                       ? coordsMetersToLatLon(x, y)
                       : [x, y];

                   features.push({
                       ...feature,
                       geometry: {
                           ...feature.geometry,
                           coordinates
                       }
                   } as PointFeature);
                   break;
               }
                   
               case "MultiLineString": {
                   const validCoordinates = feature.geometry.coordinates.map((line: [number, number][]) => 
                       line.filter(([x, y]) => !options.dropNulls || (!isNaN(x) && !isNaN(y)))
                   ).filter((line: [number, number][]) => line.length > 0);
                   
                   if (options.dropNulls && validCoordinates.length === 0) continue;

                   const convertedCoordinates = options.convertMetersToLatLon
                       ? validCoordinates.map(line => 
                           line.map(([x, y]) => coordsMetersToLatLon(x, y))
                         )
                       : validCoordinates;
                   
                   const multiLine: MultiLineStringFeature = {
                       ...feature,
                       geometry: {
                           ...feature.geometry,
                           coordinates: convertedCoordinates,
                           centroid: calculateMultiLineCentroid(convertedCoordinates)
                       }
                   };
                   features.push(multiLine);
                   break;
               }
               
               case "LineString": {
                   const validCoordinates = feature.geometry.coordinates
                       .filter(([x, y]) => !options.dropNulls || (!isNaN(x) && !isNaN(y)));
                   
                   if (options.dropNulls && validCoordinates.length === 0) continue;

                   const convertedCoordinates = options.convertMetersToLatLon
                       ? validCoordinates.map(([x, y]) => coordsMetersToLatLon(x, y))
                       : validCoordinates;
                   
                   const line: LineStringFeature = {
                       ...feature,
                       geometry: {
                           ...feature.geometry,
                           coordinates: convertedCoordinates,
                           centroid: calculateCentroid(convertedCoordinates)
                       }
                   };
                   features.push(line);
                   break;
               }
               
               case "Polygon": {
                   const validCoordinates = feature.geometry.coordinates.map((ring: [number, number][]) => 
                       ring.filter(([x, y]) => !options.dropNulls || (!isNaN(x) && !isNaN(y)))
                   ).filter((ring: [number, number][]) => ring.length > 0);
                   
                   if (options.dropNulls && validCoordinates.length === 0) continue;

                   const convertedCoordinates = options.convertMetersToLatLon
                       ? validCoordinates.map(ring => 
                           ring.map(([x, y]) => coordsMetersToLatLon(x, y))
                         )
                       : validCoordinates;
                   
                   const coordinates2D = convertedCoordinates[0];
                       
                   const polygon: PolygonFeature = {
                       ...feature,
                       geometry: {
                           ...feature.geometry,
                           coordinates: convertedCoordinates,
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
getGridDimensionsFromConfig,
getCellIdForPoint,
}

