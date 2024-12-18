// grid-processor.ts
import { GeoData, Point, GridConfig, CellCount, CellBounds } from './types';

export class GridManager {
    private config: GridConfig;
    private cellWidth: number;
    private cellHeight: number;
    private cellCounts: Map<string, number>;
    private entityGridIndices: Map<string, string>; // entityId -> cellId
    private minLon: number;
    private maxLon: number;
    private minLat: number;
    private maxLat: number;

    constructor(config: GridConfig) {
        this.config = config;
        this.cellCounts = new Map();
        this.entityGridIndices = new Map();
        this.minLon = Math.min(config.boundA[0], config.boundB[0]);
        this.maxLon = Math.max(config.boundA[0], config.boundB[0]);
        this.minLat = Math.min(config.boundA[1], config.boundB[1]);
        this.maxLat = Math.max(config.boundA[1], config.boundB[1]);
        
        const latSpan = Math.abs(config.boundA[1] - config.boundB[1]);
        const lonSpan = Math.abs(config.boundA[0] - config.boundB[0]);
        
        const centerLat = (config.boundA[1] + config.boundB[1]) / 2;
        //const adjustmentFactor = this.getLatitudeAdjustmentFactor(centerLat);
        
        this.cellHeight = latSpan / config.height_n;
        this.cellWidth = (lonSpan / config.width_n); //* adjustmentFactor;
    }

    private getLatitudeAdjustmentFactor(latitude: number): number {
        return 1 / Math.cos((latitude * Math.PI) / 180);
    }

    private getCellIdForPoint(point: Point): string | null {
        const minLon = Math.min(this.config.boundA[0], this.config.boundB[0]);
        const minLat = Math.min(this.config.boundA[1], this.config.boundB[1]);

        const col = Math.floor((point.x - minLon) / this.cellWidth);
        const row = Math.floor((point.y - minLat) / this.cellHeight);

        if (row >= 0 && row < this.config.height_n && col >= 0 && col < this.config.width_n) {
            return `${row}_${col}`;
        }
        return null;
    }

   // private getCellBounds(cellId: string): CellBounds {
   //     const [row, col] = cellId.split('_').map(Number);
   //     const minLon = Math.min(this.config.boundA[0], this.config.boundB[0]);
   //     const minLat = Math.min(this.config.boundA[1], this.config.boundB[1]);

   //     return {
   //         minLon: minLon + (col * this.cellWidth),
   //         maxLon: minLon + ((col + 1) * this.cellWidth),
   //         minLat: minLat + (row * this.cellHeight),
   //         maxLat: minLat + ((row + 1) * this.cellHeight)
   //     };
   // }

    private getCellBounds(cellId: string): CellBounds {
        const [row, col] = cellId.split('_').map(Number);
        
        const minLon = this.minLon + (col / this.config.width_n) * (this.maxLon - this.minLon);
        const maxLon = this.minLon + ((col + 1) / this.config.width_n) * (this.maxLon - this.minLon);
        const minLat = this.minLat + (row / this.config.height_n) * (this.maxLat - this.minLat);
        const maxLat = this.minLat + ((row + 1) / this.config.height_n) * (this.maxLat - this.minLat);

        return { minLon, maxLon, minLat, maxLat };
    }

    public processData(data: GeoData[]): void {
        this.cellCounts.clear();
        this.entityGridIndices.clear();

        data.forEach(item => {
            let point: Point;
            
            if (item.geomType === 'point') {
                point = item.geom[0];
            } else if (item.centroid) {
                point = item.centroid;
            } else {
                return;
            } 
            const cellId = this.getCellIdForPoint(point);

            if (cellId) {
                this.entityGridIndices.set(item.id, cellId);
                this.cellCounts.set(cellId, (this.cellCounts.get(cellId) || 0) + 1);
            }
        });
    }

    public getHeatmapData(): CellCount[] {
        return Array.from(this.cellCounts.entries()).map(([cellId, count]) => ({
            cellId,
            count,
            bounds: this.getCellBounds(cellId)
        }));
    }

    public getCellEntities(cellId: string, data: GeoData[]): GeoData[] {
        return data.filter(item => this.entityGridIndices.get(item.id) === cellId);
    }
}
