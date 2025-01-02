import { serve } from "bun";

const PORT = 9000;
const BINARY_PATH = '/atm/public/new_grid.bin';

interface GridMetadata {
    dimensions: any;
    cellIndices: Record<string, {
        startOffset: number;
        endOffset: number;
        featureCount: number;
    }>;
}

const mmap = Bun.mmap(BINARY_PATH);
const metadataSize = new DataView(mmap.buffer).getUint32(0, true);
const metadata: GridMetadata = JSON.parse(
    new TextDecoder().decode(mmap.slice(4, 4 + metadataSize))
);

function getFeaturesForCell(mmap: Uint8Array, metadata: GridMetadata, cellId: string) {
    const cellIndex = metadata.cellIndices[cellId];
    if (!cellIndex) return [];
    
    const metadataOffset = 4 + metadataSize;
    const start = metadataOffset + cellIndex.startOffset;
    const end = metadataOffset + cellIndex.endOffset;
    
    console.log(`Reading cell ${cellId} (${cellIndex.featureCount} features)`);
    console.log(`Byte range: ${start}-${end} (${end - start} bytes)`);
    
    const features = [];
    const lines = new TextDecoder().decode(mmap.slice(start, end)).split('\n');
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;
        try {
            features.push(JSON.parse(line));
        } catch (e) {
            console.error(`Error parsing feature at line ${i}:`, line);
        }
    }
    
    return features;
}

serve({
    port: PORT,
    fetch(req) {
        const url = new URL(req.url);
        const headers = {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
        };

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
    }
});

// Test endpoints
setTimeout(async () => {
    const metadata = await fetch('http://localhost:9000/api/metadata').then(r => r.json());
    console.log('\nMetadata response:', metadata);
    
    const cellId = '5_2'; // Test cell with most features
    console.log(`\nTesting cell ${cellId}`);
    const features = await fetch(`http://localhost:9000/api/cell/${cellId}`).then(r => r.json());
    console.log(`Found ${features.length} features`);
    if (features.length > 0) {
        console.log('Sample feature:', JSON.stringify(features[0], null, 2));
    }
}, 1000);
