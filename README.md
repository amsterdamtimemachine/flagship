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
- [Docker](https://docker.com)
- [Bun](https://bun.sh) (for running build scripts)

### Setup
```bash
cp .env.example .env
```

**Required**: Edit `.env` and set:
- `PUBLIC_MAPTILER_API_KEY` - Get a free API key from [MapTiler](https://www.maptiler.com/)

**Optional**: Configure preprocessor settings in `.env` (uncomment and modify any variables you want to change from defaults)

### Build Images
```bash
bun run docker:build
```

### Run Production
```bash
# Start containers
bun run docker:up

# View logs
bun run docker:logs

# Stop containers
bun run docker:down
```

The production app will be available at `http://localhost:3000`

**Note**: On first run, Docker will automatically generate visualization data which takes ~20 minutes. Subsequent runs will be much faster as the data is cached in `data/docker/`.

### Docker Commands

```bash
# Generate Docker visualization data separately
bun run docker:generate

# Restart just the app container (after data changes)
bun run docker:restart:app

# Regenerate data and restart app (complete refresh)
bun run docker:regenerate

# Stop all containers
bun run docker:down

# Kill data generation process
bun run docker:kill-generation

# View logs
bun run docker:logs:app
```

### Data Isolation
- **Local development**: Uses `data/visualization.bin`
- **Docker**: Uses `data/docker/visualization.bin` 

Each environment maintains separate data to avoid conflicts during development.

## State

Currently the app is in a prototypical state, with documentation missing. Hence the private visibility. 
