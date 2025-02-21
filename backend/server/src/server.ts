import { GridApi } from './api';
import { config } from './config';

async function startServer() {
    console.log(`Using data path: ${config.dataPath}`);
    const api = new GridApi('/atm/data/tagged/dataset.bin');
    
    // Initialize the API (loads binary data)
    try {
        await api.initialize();
        console.log("API successfully initialized");
    } catch (error) {
        console.error("Failed to initialize API:", error);
        process.exit(1);
    }
    
    const server = Bun.serve({
        port: config.port,
        async fetch(req) {
            const url = new URL(req.url);
            
            // Add CORS headers to all responses
            const corsHeaders = {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            };
            
            // Handle preflight requests
            if (req.method === 'OPTIONS') {
                return new Response(null, {
                    status: 204,
                    headers: corsHeaders
                });
            }
            
            try {
                console.log(`${req.method} ${url.pathname}${url.search}`);
                
                // Handle API endpoints
                if (url.pathname === '/grid/metadata') {
                    return await api.getMetadata(req);
                }
                
                if (url.pathname.startsWith('/grid/cell/')) {
                    return await api.getCellFeatures(req);
                }
                
                if (url.pathname === '/grid/heatmap') {
                    return await api.getHeatmap(req);
                }
                
                // Handle 404
                return new Response(JSON.stringify({ error: "Not found" }), {
                    status: 404,
                    headers: { 
                        'Content-Type': 'application/json',
                        ...corsHeaders
                    }
                });
            } catch (error) {
                console.error("Server error:", error);
                
                // More detailed error logging
                if (error instanceof Error) {
                    console.error(error.stack);
                }
                
                return new Response(JSON.stringify({ 
                    error: "Internal server error",
                    message: error instanceof Error ? error.message : String(error)
                }), {
                    status: 500,
                    headers: { 
                        'Content-Type': 'application/json',
                        ...corsHeaders
                    }
                });
            }
        }
    });
    
    console.log(`Server running on port ${server.port}`);
    return server;
}

// Start the server
await startServer();
