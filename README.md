# Flagship

 Flagship is a web app for exploration of geolocated heritage data.

## Development

### Prerequisites
- [Bun](https://bun.sh) (latest version)

### Setup
```bash
bun install
cp .env.example .env
```

**Required**: Edit `.env` and set:
- `PUBLIC_MAPTILER_API_KEY` - Get a free API key from [MapTiler](https://www.maptiler.com/)

**Optional**: Configure preprocessor settings in `.env` (uncomment and modify any variables you want to change from defaults)

### Development Server
```bash
bun run dev
```

The app will be available at `http://localhost:5175`

## Production (Docker)

### Prerequisites
- [Docker](https://docker.com) with Docker Compose
- [Bun](https://bun.sh) (for running build scripts)

### Setup
```bash
cp .env.example .env
```

**Required**: Edit `.env` and set:
- `PUBLIC_MAPTILER_API_KEY` - Get a free API key from [MapTiler](https://www.maptiler.com/)

**Optional**: Configure preprocessor settings in `.env` (uncomment and modify any variables you want to change from defaults)

### Quick Start
```bash
# Start everything (builds containers if needed)
bun run docker:up:build
```

The app will be available at `http://localhost:3000`

**Note**: On first run, the system will automatically generate visualization data (~4-8 minutes). Subsequent runs will be much faster as the data is cached in `data/docker/`.

### Docker Commands

#### Starting & Stopping
```bash
# Start (normal - uses existing data if available)
bun run docker:up

# Start with rebuild (when code changes)
bun run docker:up:build

# Stop everything
bun run docker:down
```

#### Data Management
```bash
# Force regenerate data + restart everything (when data logic changes)
bun run docker:regenerate
```

#### Monitoring & Debugging
```bash
# View all logs
bun run docker:logs

# View app logs only
bun run docker:logs:app

# View data generation logs only  
bun run docker:logs:init

# Restart services
bun run docker:restart        # Restart all
bun run docker:restart:app    # Restart just app
```

### How It Works

The Docker setup uses **Docker Compose** with two services:

1. **data-init**: Generates visualization data from the Amsterdam database
   - Runs once on startup if `data/docker/visualization.bin` doesn't exist
   - Exits after successful generation
   - Takes ~4-8 minutes on first run

2. **app**: Serves the web application  
   - Waits for data-init to complete successfully
   - Serves the app on port 3000
   - Automatically restarts if it crashes

### Data Isolation
- **Local development**: Uses `data/visualization.bin`
- **Docker production**: Uses `data/docker/visualization.bin` 

Each environment maintains separate data to avoid conflicts during development.

## State

Currently the app is in a prototypical state, with documentation missing. Hence the private visibility. 
