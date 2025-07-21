# Docker Setup for Amsterdam Time Machine

This setup provides a containerized version of the Amsterdam Time Machine application with separate containers for the SvelteKit app and the data preprocessor.

## Architecture

```
┌─────────────────┐    ┌──────────────────┐
│   App Container │    │ Preprocessor     │
│   (SvelteKit)   │    │ Container        │
│                 │    │                  │
│   Port: 3000    │    │ Runs: discovery  │
└─────────────────┘    │ script once      │
         │              └──────────────────┘
         └───────────────────────┘
                     │
            ┌─────────────────┐
            │ Shared Volume   │
            │ ./data/         │
            │ - visualization.bin
            │ - vocabulary.json
            └─────────────────┘
```

## Quick Start

### 1. Build and Start Containers
```bash
bun run docker:build
bun run docker:up
```

### 2. Check Logs
```bash
# View all logs
bun run docker:logs

# View app logs only
bun run docker:logs:app

# View preprocessor logs only
bun run docker:logs:preprocessor
```

### 3. Access the Application
- **App**: http://localhost:3000
- **Health Check**: http://localhost:3000/api/metadata

## Data Flow

1. **Initial Setup**: The existing `visualization.bin` is copied to `./data/` directory
2. **App Container**: Serves the SvelteKit app, reads binary from `/app/data/visualization.bin`
3. **Preprocessor Container**: Runs discovery script once, outputs new binary to `/app/data/`
4. **Shared Volume**: Both containers share the same data directory

## Environment Variables

### App Container
- `PRIVATE_VISUALIZATION_BINARY_PATH=/app/data/visualization.bin` - Path to visualization binary
- `NODE_ENV=production` - Production mode

### Preprocessor Container  
- `OUTPUT_PATH=/app/data/visualization.bin` - Output path for generated binary
- `VOCABULARY_PATH=/app/data/vocabulary.json` - Output path for vocabulary file

## File Locations

```
/
├── data/                           # Shared data directory (host)
│   ├── visualization.bin          # Visualization binary
│   └── vocabulary.json            # Discovered vocabulary
├── docker-compose.yml             # Container orchestration
├── Dockerfile.app                 # SvelteKit app container
├── Dockerfile.preprocessor        # Preprocessor container  
└── crontab                        # Cron configuration (for future use)
```

## Container Details

### App Container
- **Base**: `oven/bun:latest`
- **Port**: 3000
- **Health Check**: `/api/metadata` endpoint
- **Volume**: `./data:/app/data:rw`

### Preprocessor Container
- **Base**: `oven/bun:latest` 
- **Function**: Runs discovery script once on startup
- **Volume**: `./data:/app/data:rw`
- **Future**: Ready for cron scheduling (crontab included but not active)

## Available Scripts

```bash
# Docker management
bun run docker:build          # Build containers
bun run docker:up            # Start containers in background  
bun run docker:down          # Stop containers
bun run docker:restart       # Restart containers
bun run docker:logs          # View all logs
bun run docker:logs:app      # View app logs only
bun run docker:logs:preprocessor # View preprocessor logs only

# Direct preprocessing (outside Docker)
bun run preprocess:discovery  # Run discovery script locally
```

## Development vs Production

### Development Mode
```bash
# Run locally with file watching
bun run dev
```

### Production Mode (Docker)
```bash
# Build and deploy containers
bun run docker:build
bun run docker:up
```

## Future Cron Setup

The preprocessor container includes cron configuration for daily runs:
- **Schedule**: Daily at 2 AM
- **Log File**: `/var/log/preprocessor.log`
- **Configuration**: `/etc/cron.d/preprocessor-cron`

To enable cron scheduling in the future, modify the preprocessor container CMD to:
```dockerfile
CMD ["sh", "-c", "cron && tail -f /var/log/preprocessor.log"]
```

## Troubleshooting

### Container won't start
```bash
# Check container logs
docker-compose logs preprocessor
docker-compose logs app

# Check if ports are available
ss -tlnp | grep 3000
```

### Binary not found
```bash
# Check shared volume
ls -la ./data/

# Check container volume mount
docker exec atm-app ls -la /app/data/
```

### Preprocessor issues  
```bash
# Run preprocessor manually for debugging
docker exec atm-preprocessor bun run src/main_discovery.ts

# Check preprocessor container
docker exec -it atm-preprocessor /bin/bash
```

### Force rebuild
```bash
# Clean rebuild
docker-compose down
docker system prune -f
bun run docker:build --no-cache
bun run docker:up
```