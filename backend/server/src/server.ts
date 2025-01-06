import { GridApi } from './api';
import { config } from './config';

async function startServer() {
    // Initialize API
    const api = new GridApi(config.dataPath);
    await api.initialize();

    // Start server
    const server = Bun.serve({
        port: config.port,
        async fetch(req) {
            const url = new URL(req.url);
            
            // Simple router
            try {
                if (url.pathname === '/grid/metadata') {
                    return await api.getMetadata(req);
                }
                
                if (url.pathname.startsWith('/grid/cell/')) {
                    return await api.getCellFeatures(req);
                }
                
                // Handle 404
                return new Response(JSON.stringify({ error: "Not found" }), {
                    status: 404,
                    headers: { 
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    }
                });
            } catch (error) {
                console.error("Server error:", error);
                return new Response(JSON.stringify({ error: "Internal server error" }), {
                    status: 500,
                    headers: { 
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    }
                });
            }
        }
    });

    console.log(`Server running on port ${server.port}`);
    return server;
}

await startServer();
