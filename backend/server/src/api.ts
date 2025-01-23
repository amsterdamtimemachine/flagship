import { decode } from '@msgpack/msgpack';
import type { 
    GeoFeature, 
    BinaryMetadata, 
    HeatmapResponse, 
    MetadataResponse, 
    CellFeaturesResponse,
    TimeSliceFeatures
} from '@atm/shared-types';

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
                
                console.log("Binary data initialized successfully");

                // Debug info about data sizes
                const totalMetadataSize = metadataSize / 1024;
                const heatmapCount = Object.keys(this.metadata.heatmaps).length;
                const timeSliceCount = Object.keys(this.metadata.timeSliceIndex).length;
                
                console.log(`Total metadata size: ${totalMetadataSize.toFixed(2)} KB`);
                console.log(`Number of time slices: ${timeSliceCount}`);
                console.log(`Number of heatmaps: ${heatmapCount}`);
            }
        } catch (error) {
            console.error("Failed to initialize binary data:", error);
            throw error;
        }
    }
    private getTimeSliceData(period: string): TimeSliceFeatures | null {
        if (!this.binaryBuffer || !this.metadata) {
            throw new Error("Binary data not initialized");
        }

        const timeSliceIndex = this.metadata.timeSliceIndex[period];
        if (!timeSliceIndex) {
            return null;
        }

        try {
            const sliceDataStart = this.dataStartOffset + timeSliceIndex.offset;
            const sliceBytes = new Uint8Array(
                this.binaryBuffer, 
                sliceDataStart, 
                timeSliceIndex.length
            );
            return decode(sliceBytes) as TimeSliceFeatures;
        } catch (error) {
            console.error(`Error decoding time slice ${period}:`, error);
            return null;
        }
    }

    getMetadata: ApiHandler = async () => {
        if (!this.metadata) {
            return errorResponse("Metadata not initialized", 500);
        }

        return jsonResponse({
            dimensions: this.metadata.dimensions,
            timeRange: this.metadata.timeRange,
            heatmaps: this.metadata.heatmaps
        } as MetadataResponse);
    }


    getHeatmap: ApiHandler = async (req) => {
        if (!this.metadata) {
            return errorResponse("Metadata not initialized", 500);
        }

        const url = new URL(req.url);
        const period = url.searchParams.get('period');
        const periods = Object.keys(this.metadata.heatmaps);

        // No heatmaps available
        if (periods.length === 0) {
            return errorResponse("No heatmaps available", 404);
        }

        // If period not specified or invalid, return first period's heatmap
        const targetPeriod = !period || !this.metadata.heatmaps[period] 
            ? periods[0] 
            : period;

        return jsonResponse({
            ...this.metadata.heatmaps[targetPeriod],
            timeRange: this.metadata.timeRange,
            availablePeriods: periods
        } as HeatmapResponse);
    }


    getCellFeatures: ApiHandler = async (req) => {
        const url = new URL(req.url);
        const cellId = url.pathname.slice('/grid/cell/'.length);
        const period = url.searchParams.get('period');
        
        if (!period) {
            return errorResponse("Period parameter is required", 400);
        }

        if (!/^\d+_\d+$/.test(cellId)) {
            return errorResponse("Invalid cell ID format. Expected format: number_number", 400);
        }
        
        try {
            const timeSlice = this.getTimeSliceData(period);
            if (!timeSlice) {
                return errorResponse("Time period not found", 404);
            }

            const cellData = timeSlice.cells[cellId];
            if (!cellData) {
                return jsonResponse({
                    cellId,
                    period,
                    features: [],
                    featureCount: 0
                } as CellFeaturesResponse);
            }

            return jsonResponse({
                cellId,
                period,
                features: cellData.features,
                featureCount: cellData.count
            } as CellFeaturesResponse);
        } catch (error) {
            console.error("Error serving cell data:", error);
            return errorResponse("Internal server error", 500);
        }
    }
}
