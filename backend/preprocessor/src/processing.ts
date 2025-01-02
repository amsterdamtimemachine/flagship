import { Point2D, 
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





export {
getGridDimensionsFromConfig,
getCellIdForPoint,
}

