import { TEST, GeoData, Point, GridConfig, CellCount, CellBounds } from '@atm/shared-types';

type GridDimensions = {
    cellWidth: number;
    cellHeight: number;
    minLon: number;
    maxLon: number;
    minLat: number;
    maxLat: number;
};

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
    point: Point, 
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
): CellBounds => {
    const [row, col] = cellId.split('_').map(Number);
    
    const minLon = dimensions.minLon + (col / config.width_n) * (dimensions.maxLon - dimensions.minLon);
    const maxLon = dimensions.minLon + ((col + 1) / config.width_n) * (dimensions.maxLon - dimensions.minLon);
    const minLat = dimensions.minLat + (row / config.height_n) * (dimensions.maxLat - dimensions.minLat);
    const maxLat = dimensions.minLat + ((row + 1) / config.height_n) * (dimensions.maxLat - dimensions.minLat);

    return { minLon, maxLon, minLat, maxLat };
};

const processGeoData = (data: GeoData[], config: GridConfig): {
    cellCounts: Map<string, number>;
    entityGridIndices: Map<string, string>;
} => {
    const dimensions = calculateGridDimensions(config);
    const cellCounts = new Map<string, number>();
    const entityGridIndices = new Map<string, string>();

    data.forEach(item => {
        const point = item.geomType === 'point' ? item.geom[0] : item.centroid;
        if (!point) return;

        const cellId = getCellIdForPoint(point, dimensions, config);
        if (!cellId) return;

        entityGridIndices.set(item.id, cellId);
        cellCounts.set(cellId, (cellCounts.get(cellId) || 0) + 1);
    });

    return { cellCounts, entityGridIndices };
};

const getHeatmapData = (
    cellCounts: Map<string, number>,
    config: GridConfig
): CellCount[] => {
    const dimensions = calculateGridDimensions(config);
    return Array.from(cellCounts.entries()).map(([cellId, count]) => ({
        cellId,
        count,
        bounds: getCellBounds(cellId, dimensions, config)
    }));
};

export {
    calculateGridDimensions,
    processGeoData,
    getHeatmapData,
    getCellBounds,
    getCellIdForPoint
};
