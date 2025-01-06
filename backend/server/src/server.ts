import { decode } from '@msgpack/msgpack';
import type { GeoFeature, BinaryMetadata } from '@atm/shared-types';

// Cache for binary data
let binaryBuffer: ArrayBufferLike | null = null;
let metadata: BinaryMetadata | null = null;
let dataStartOffset: number = 0;

async function initializeBinaryData(binaryPath: string) {
    try {
        if (!binaryBuffer) {
            const mmap = Bun.mmap(binaryPath);
            const buffer = mmap.buffer as ArrayBufferLike;
            binaryBuffer = buffer;
            
            const dataView = new DataView(buffer);
            const metadataSize = dataView.getUint32(0, false);
            const metadataBytes = new Uint8Array(buffer, 4, metadataSize);
            metadata = decode(metadataBytes) as BinaryMetadata;
            dataStartOffset = 4 + metadataSize;
            
            console.log("Binary data initialized successfully");
        }
    } catch (error) {
        console.error("Failed to initialize binary data:", error);
        throw new Error("Failed to initialize binary data");
    }
}

function getCellData(cellId: string): GeoFeature[] | null {
    if (!binaryBuffer || !metadata) {
        throw new Error("Binary data not initialized");
    }

    const buffer = binaryBuffer as ArrayBufferLike;
    const cellIndex = metadata.cellIndices[cellId];
    if (!cellIndex) {
        return null;
    }

    try {
        const cellDataStart = dataStartOffset + cellIndex.startOffset;
        const featureByteLength = cellIndex.endOffset - cellIndex.startOffset;
        
        const featureBytes = new Uint8Array(buffer, cellDataStart, featureByteLength);
        return decode(featureBytes) as GeoFeature[];
    } catch (error) {
        console.error(`Error decoding cell ${cellId}:`, error);
        return null;
    }
}

// Initialize binary data before starting server
const BINARY_PATH = '/atm/public/geodata.bin';

await initializeBinaryData(BINARY_PATH);

const server = Bun.serve({
    port: process.env.PORT || 3000,
    async fetch(req) {
        const url = new URL(req.url);
        
        // Handle metadata endpoint
        if (url.pathname === '/grid/metadata') {
            if (!metadata) {
                return new Response(JSON.stringify({
                    error: "Metadata not initialized"
                }), {
                    status: 500,
                    headers: { 
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    }
                });
            }

            return new Response(JSON.stringify({
                dimensions: metadata.dimensions,
                cellIndices: metadata.cellIndices
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'public, max-age=3600',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }

        // Handle cell data endpoint
        if (url.pathname.startsWith('/grid/cell/')) {
            const cellId = url.pathname.slice('/grid/cell/'.length);
            
            // Validate cell ID format first
            if (!/^\d+_\d+$/.test(cellId)) {
                return new Response(JSON.stringify({
                    error: "Invalid cell ID format. Expected format: number_number"
                }), {
                    status: 400,
                    headers: { 
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    }
                });
            }
            
            try {
                const features = getCellData(cellId);
                
                if (features === null) {
                    return new Response(JSON.stringify({
                        error: "Cell not found"
                    }), {
                        status: 404,
                        headers: { 
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        }
                    });
                }

                return new Response(JSON.stringify({
                    cellId,
                    featureCount: features.length,
                    features
                }), {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/json',
                        'Cache-Control': 'public, max-age=3600',
                        'Access-Control-Allow-Origin': '*'
                    }
                });
            } catch (error) {
                console.error("Error serving cell data:", error);
                return new Response(JSON.stringify({
                    error: "Internal server error"
                }), {
                    status: 500,
                    headers: { 
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    }
                });
            }
        }

        // Handle 404 for unknown routes
        return new Response(JSON.stringify({
            error: "Not found"
        }), {
            status: 404,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
});

console.log(`Server running on port ${server.port}`);
