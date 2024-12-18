import { serve, type BunFile} from "bun";
const PORT = 9000;
const CORS_PORT = 5175;
const BINARY_PATH = '/atm/public/new_grid.bin';

/**
* Loads and parses grid metadata from a binary file that was created using a specific format:
* 
* Binary File Structure:
* [4 bytes: Metadata Size as Uint32]
* [N bytes: Metadata as JSON] where N is the size from first 4 bytes
* [Remaining bytes: Features data]
* 
* The metadata JSON contains:
* - cellCounts: Array of [cellId, count] pairs for heatmap visualization
* - entityGridIndices: Array of [featureUrl, cellId] pairs for feature lookup
* - dimensions: Grid configuration including bounds and cell sizes
* - header: Contains totalFeatures count
* 
* @param file - BunFile reference to the binary file (lazy loaded)
* @returns {Promise<{
*   cellCounts: Map<string, number>,      // cellId -> feature count
*   entityGridIndices: Map<string, string>, // featureUrl -> cellId
*   dimensions: GridDimensions,           // Grid configuration
*   header: { totalFeatures: number }     // Metadata about features
* }>}
* 
* Usage:
* const file = Bun.file('./grid.bin');
* const metadata = await loadGridMetadata(file);
* console.log(`Total features: ${metadata.header.totalFeatures}`);
* console.log(`Features in cell '1_1': ${metadata.cellCounts.get('1_1')}`);
*/
async function loadGridMetadata(file: BunFile) {
   // Read first 4 bytes which contain metadata size as Uint32
   const sizeBuffer = await file.slice(0, 4).arrayBuffer();
   const metadataSize = new Uint32Array(sizeBuffer)[0];
   
   // Read exact metadata section (from byte 4 to 4+size)
   const metadataText = await file.slice(4, 4 + metadataSize).text();
   const metadata = JSON.parse(metadataText);
   
   // Convert arrays back to Maps for efficient lookup
   return {
       cellCounts: new Map(metadata.cellCounts),
       entityGridIndices: new Map(metadata.entityGridIndices),
       dimensions: metadata.dimensions,
       header: metadata.header
   };
}

async function startServer() {
    try {
        const gridFile = Bun.file(BINARY_PATH);
        console.log('Loading grid metadata...');
        const metadata = await loadGridMetadata(gridFile);
        console.log('Metadata loaded');

       // serve({
       //     port: PORT,
       //     fetch(req) {
       //         const url = new URL(req.url);
       //         const headers = {
       //             'Access-Control-Allow-Origin': `http://localhost:${CORS_PORT}`,
       //             'Content-Type': 'application/json'
       //         };

       //         // Return just metadata for heatmap
       //         if (url.pathname === '/api/heatmap') {
       //             return new Response(JSON.stringify({
       //                 cells: Array.from(metadata.cellCounts.entries()),
       //                 dimensions: metadata.dimensions
       //             }), { headers });
       //         }

       //         // Load features for specific cell when requested
       //         if (url.pathname.startsWith('/api/cell/')) {
       //             // Features implementation here
       //         }

       //         return new Response('Not Found', { status: 404 });
       //     },
       // });

    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer().catch(console.error);
