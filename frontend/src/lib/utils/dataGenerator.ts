import type {CenterPoint, CellData} from "$types";

    export function getLatitudeAdjustmentFactor(latitude: number): number {
        return 1 / Math.cos((latitude * Math.PI) / 180);
    }

    export function calculateBounds(centerPoint: CenterPoint, cellSize: number, numCells: number) {
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

    export function calculateInnerSquareCoordinates(
        centerLng: number,
        centerLat: number,
        cellSizeLng: number,
        cellSizeLat: number,
        value: number
    ): number[][] {
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

    export function generateGridFeatures(cellSize: number, numCells: number, minValThreshold: number, centerPoint: CenterPoint, data: CellData = {}) {
        const features = [];
        
        const latAdjustment = getLatitudeAdjustmentFactor(centerPoint.lat);
        const latCellSize = cellSize / latAdjustment;
        
        const totalSizeLng = cellSize * cellSize;
        const totalSizeLat = latCellSize * numCells;
        const startLng = centerPoint.lng - (totalSizeLng / 2);
        const startLat = centerPoint.lat - (totalSizeLat / 2);
        
        // Generate only for cells with data
        for (let i = 0; i < numCells; i++) {
            for (let j = 0; j < numCells; j++) {
                const cellId = `cell-${i}-${j}`;
                const value = data[cellId];

                if (value !== undefined && value > minValThreshold) {
                    const cellLng = startLng + (i * cellSize);
                    const cellLat = startLat + (j * latCellSize);
                    const centerLng = cellLng + (cellSize / 2);
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
                                [cellLng + cellSize, cellLat],
                                [cellLng + cellSize, cellLat + latCellSize],
                                [cellLng, cellLat + latCellSize],
                                [cellLng, cellLat]
                            ]]
                        }
                    });

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
                                    cellSize,
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
