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
            console.log("Opening binary file...");
            const mmap = Bun.mmap(this.binaryPath);
            const buffer = mmap.buffer as ArrayBufferLike;
            this.binaryBuffer = buffer;
            
            console.log("Buffer size:", buffer.byteLength);
            
            if (buffer.byteLength < 4) {
                throw new Error("Binary file too small - missing metadata size");
            }

            const dataView = new DataView(buffer);
            const metadataSize = dataView.getUint32(0, false);
            console.log("Metadata size from binary:", metadataSize);
            
            if (buffer.byteLength < 4 + metadataSize) {
                throw new Error(`Binary file truncated. Expected ${4 + metadataSize} bytes, got ${buffer.byteLength}`);
            }

            try {
                const metadataBytes = new Uint8Array(buffer, 4, metadataSize);
                this.metadata = decode(metadataBytes) as BinaryMetadata;
                this.dataStartOffset = 4 + metadataSize;
                
                console.log("Successfully decoded metadata");
                console.log("Data start offset:", this.dataStartOffset);
                console.log("Number of periods:", Object.keys(this.metadata.timeSliceIndex).length);
                console.log("Number of heatmaps:", Object.keys(this.metadata.heatmaps).length);
            } catch (error) {
                console.error("Failed to decode metadata:", error);
                throw error;
            }
        }
    } catch (error) {
        console.error("Failed to initialize binary data:", error);
        throw error;
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

private getTimeSliceData(period: string): TimeSliceFeatures | null {
    console.log(`Reading time slice ${period}`);
    console.log(`Data start offset: ${this.dataStartOffset}`);
    
    const timeSliceIndex = this.metadata.timeSliceIndex[period];
    console.log(`Time slice index:`, timeSliceIndex);
    
    const readPosition = this.dataStartOffset + timeSliceIndex.offset;
    console.log(`Reading from position ${readPosition} for ${timeSliceIndex.length} bytes`);
    
    const sliceBytes = new Uint8Array(
        this.binaryBuffer,
        readPosition,
        timeSliceIndex.length
    );
    return decode(sliceBytes) as TimeSliceFeatures;
}

getCellFeatures: ApiHandler = async (req) => {
    const url = new URL(req.url);
    const cellId = url.pathname.slice('/grid/cell/'.length);
    const period = url.searchParams.get('period');
    const page = parseInt(url.searchParams.get('page') ?? '1');
    
    if (!period) {
        return errorResponse("Period parameter is required", 400);
    }

    try {
        // First get the time slice structure which has all the offsets
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
                featureCount: 0,
                currentPage: 1,
                totalPages: 0
            });
        }

        // Get the specific page we want
        const pageKey = `page${page}`;
        const pageData = cellData.pages[pageKey];
        if (!pageData) {
            return errorResponse("Page not found", 404);
        }

        // Now we can read just the features for this specific page
        const pageBytes = new Uint8Array(
            this.binaryBuffer,
            this.dataStartOffset + pageData.offset,
            pageData.length
        );
        const features = decode(pageBytes) as GeoFeature[];

        return jsonResponse({
            cellId,
            period,
            features,
            featureCount: cellData.count,
            currentPage: page,
            totalPages: Object.keys(cellData.pages).length
        });
    } catch (error) {
        console.error("Error serving cell data:", error);
        return errorResponse("Internal server error", 500);
    }
}
}
