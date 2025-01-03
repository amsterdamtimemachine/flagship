import { serve } from "bun";

const PORT = 9000;
const BINARY_PATH = '/atm/public/new_grid.bin';

interface GridMetadata {
    dimensions: {
        colsAmount: number;
        rowsAmount: number;
        cellWidth: number;
        cellHeight: number;
        minLon: number;
        maxLon: number;
        minLat: number;
        maxLat: number;
    };
    cellIndices: Record<string, {
        startOffset: number;
        endOffset: number;
        featureCount: number;
    }>;
}

// Initialize mmap and metadata
const mmap = Bun.mmap(BINARY_PATH);
const metadataSize = new DataView(mmap.buffer).getUint32(0, true);
const metadata: GridMetadata = JSON.parse(
    new TextDecoder().decode(mmap.slice(4, 4 + metadataSize))
);

function getFeaturesForCell(mmap: Uint8Array, metadata: GridMetadata, cellId: string): any[] {
    const cellIndex = metadata.cellIndices[cellId];
    if (!cellIndex) {
        console.log(`No cell index found for ${cellId}`);
        return [];
    }
    
    // Get the exact byte range from metadata
    const metadataOffset = 4 + metadataSize;
    const start = metadataOffset + cellIndex.startOffset;
    const end = metadataOffset + cellIndex.endOffset;
    
    try {
        // Get the raw text for the cell
        const cellText = new TextDecoder().decode(mmap.slice(start, end));
        
        // Split by newlines and parse each feature
        const features: any[] = [];
        const lines = cellText.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            try {
                const feature = JSON.parse(line);
                if (feature && typeof feature === 'object') {
                    features.push(feature);
                }
            } catch (parseError) {
                console.error(`Error parsing feature at line ${i} in cell ${cellId}:`, parseError.message);
                console.error('Problematic line:', line);
                // Continue processing other features
            }
        }
        
        // Validation
        if (features.length !== cellIndex.featureCount) {
            console.warn(`Warning: Found ${features.length} features but expected ${cellIndex.featureCount} for cell ${cellId}`);
        }
        
        return features;
        
    } catch (error) {
        console.error(`Error processing cell ${cellId}:`, error);
        return [];
    }
}

const server = serve({
    port: PORT,
    async fetch(req) {
        const url = new URL(req.url);
        const headers = {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
        };

        try {
            if (url.pathname === '/api/metadata') {
                return new Response(JSON.stringify({
                    dimensions: metadata.dimensions,
                    cellCounts: Object.entries(metadata.cellIndices)
                        .map(([id, data]) => [id, data.featureCount])
                }), { headers });
            }

            const cellMatch = url.pathname.match(/^\/api\/cell\/(\d+_\d+)$/);
            if (cellMatch) {
                const features = getFeaturesForCell(mmap, metadata, cellMatch[1]);
                return new Response(JSON.stringify(features), { headers });
            }

            return new Response('Not Found', { status: 404 });
            
        } catch (error) {
            console.error('Server error:', error);
            return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
                status: 500,
                headers 
            });
        }
    }
});

// Validation on startup
console.log('Server starting with metadata validation:');
console.log('Grid dimensions:', metadata.dimensions);
console.log('Total cells:', Object.keys(metadata.cellIndices).length);
const totalFeatures = Object.values(metadata.cellIndices)
    .reduce((sum, cell) => sum + cell.featureCount, 0);
console.log('Total features:', totalFeatures);

// Optional: Test endpoints
setTimeout(async () => {
    try {
        const metadata = await fetch('http://localhost:9000/api/metadata').then(r => r.json());
        console.log('\nMetadata response:', metadata);
        
        // Find cell with most features for testing
        const cellCounts = metadata.cellCounts;
        const [testCellId, count] = cellCounts.reduce((max, curr) => 
            curr[1] > max[1] ? curr : max
        );
        
        console.log(`\nTesting cell with most features: ${testCellId} (${count} features)`);
        const features = await fetch(`http://localhost:9000/api/cell/${testCellId}`).then(r => r.json());
        console.log(`Retrieved ${features.length} features`);
        if (features.length > 0) {
            console.log('Sample feature:', JSON.stringify(features[0], null, 2));
        }
    } catch (error) {
        console.error('Test endpoint error:', error);
    }
}, 1000);
