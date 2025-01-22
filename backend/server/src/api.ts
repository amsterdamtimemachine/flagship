import { decode } from '@msgpack/msgpack';
import type { GeoFeature, BinaryMetadata, HeatmapResponse, MetadataResponse, CellFeaturesResponse } from '@atm/shared-types';

export type ApiHandler = (req: Request) => Promise<Response>;

function jsonResponse(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=3600'
        }
    });
}

function errorResponse(message: string, status = 400) {
    return jsonResponse({ error: message }, status);
}

export class GridApi {
    private binaryBuffer: ArrayBufferLike | null = null;
    private metadata: BinaryMetadata | null = null;
    private dataStartOffset: number = 0;

    constructor(private binaryPath: string) {}

    async initialize() {
        try {
            if (!this.binaryBuffer) {
                const mmap = Bun.mmap(this.binaryPath);
                const buffer = mmap.buffer as ArrayBufferLike;
                this.binaryBuffer = buffer;
                
                const dataView = new DataView(buffer);
                const metadataSize = dataView.getUint32(0, false);
                const metadataBytes = new Uint8Array(buffer, 4, metadataSize);
                this.metadata = decode(metadataBytes) as BinaryMetadata;
                this.dataStartOffset = 4 + metadataSize;

              // // Calculate sizes
              //  const heatmapsSize = JSON.stringify(this.metadata.heatmaps).length;
              //  const totalMetadataSize = JSON.stringify(this.metadata).length;
              //  
              //  console.log("Metadata size breakdown:");
              //  console.log(`- Total metadata size: ${(totalMetadataSize / 1024).toFixed(2)} KB`);
              //  console.log(`- Heatmaps size: ${(heatmapsSize / 1024).toFixed(2)} KB`);
              //  console.log(`- Heatmaps count: ${this.metadata.heatmaps.length}`);
              //  console.log(`- Total cells in heatmaps: ${this.metadata.heatmaps.reduce((sum, h) => sum + h.cells.length, 0)}`);
                
            console.log("Binary data initialized successfully");
                
                console.log("Binary data initialized successfully");
            }
        } catch (error) {
            console.error("Failed to initialize binary data:", error);
            throw new Error("Failed to initialize binary data");
        }
    }

    private getCellData(cellId: string): GeoFeature[] | null {
        if (!this.binaryBuffer || !this.metadata) {
            throw new Error("Binary data not initialized");
        }

        const buffer = this.binaryBuffer as ArrayBufferLike;
        const cellIndex = this.metadata.cellIndices[cellId];
        if (!cellIndex) {
            return null;
        }

        try {
            const cellDataStart = this.dataStartOffset + cellIndex.startOffset;
            const featureByteLength = cellIndex.endOffset - cellIndex.startOffset;
            
            const featureBytes = new Uint8Array(buffer, cellDataStart, featureByteLength);
            return decode(featureBytes) as GeoFeature[];
        } catch (error) {
            console.error(`Error decoding cell ${cellId}:`, error);
            return null;
        }
    }

    getMetadata: ApiHandler = async () => {
        if (!this.metadata) {
            return errorResponse("Metadata not initialized", 500);
        }

        return jsonResponse({
            dimensions: this.metadata.dimensions,
            cellIndices: this.metadata.cellIndices,
            heatmaps: this.metadata.heatmaps  
        } as MetadataResponse);
    }

      getHeatmap: ApiHandler = async (req) => {
            // WIP: this might be redundant endpoint since all heatmaps are sent via the /metadata endpoint
            // keeping this for now if it shows that sending all heatmaps with metadata slows the app start up too much
            if (!this.metadata) {
                return errorResponse("Metadata not initialized", 500);
            }

            const url = new URL(req.url);
            const period = url.searchParams.get('period');

            if (!period && this.metadata.heatmaps.length > 0) {
                return jsonResponse({
                    ...this.metadata.heatmaps[0],
                    timeRange: this.metadata.timeRange,
                    availablePeriods: this.metadata.heatmaps.map(h => h.period)
                } as HeatmapResponse);
            }

            const heatmap = this.metadata.heatmaps.find(h => h.period === period);
            if (!heatmap) {
                return errorResponse("Invalid time period", 400);
            }
            return jsonResponse({
                period: heatmap.period,
                cells: heatmap.cells,
                timeRange: this.metadata.timeRange,
                availablePeriods: this.metadata.heatmaps.map(h => h.period)
            });
        }

    getCellFeatures: ApiHandler = async (req) => {
        const url = new URL(req.url);
        const cellId = url.pathname.slice('/grid/cell/'.length);
        
        // Validate cell ID format
        if (!/^\d+_\d+$/.test(cellId)) {
            return errorResponse("Invalid cell ID format. Expected format: number_number", 400);
        }
        
        try {
            const features = this.getCellData(cellId);
            
            if (features === null) {
                return errorResponse("Cell not found", 404);
            }

            return jsonResponse({
                cellId,
                featureCount: features.length,
                features
            } as CellFeaturesResponse);
        } catch (error) {
            console.error("Error serving cell data:", error);
            return errorResponse("Internal server error", 500);
        }
    }
}
