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
- [Bun](https://bun.sh) *(optional - for convenient build scripts)*

### Setup
```bash
cp .env.example .env
```

**Required**: Edit `.env` and set:
- `PUBLIC_MAPTILER_API_KEY` - Get a free API key from [MapTiler](https://www.maptiler.com/)

**Optional**: Configure preprocessor settings in `.env` (uncomment and modify any variables you want to change from defaults)

### Quick Start

**With Bun (convenient):**
```bash
bun run docker:up:build
```

**Without Bun (direct Docker Compose):**
```bash
docker compose up --build
```

The app will be available at `http://localhost:3000`

**Note**: On first run, the system will automatically generate visualization data (~4-8 minutes). Subsequent runs will be much faster as the data is cached in `data/docker/`.

### Docker Commands

#### Starting & Stopping
```bash
# With Bun
bun run docker:up              # Start (uses existing data)
bun run docker:up:build       # Start with rebuild
bun run docker:down           # Stop everything

# Direct Docker Compose
docker compose up             # Start (uses existing data) 
docker compose up --build    # Start with rebuild
docker compose down          # Stop everything
```

#### Data Management
```bash
# With Bun
bun run docker:regenerate     # Delete data + rebuild + start

# Direct Docker Compose
rm -f data/docker/visualization.bin && docker compose up --build
```

#### Monitoring & Debugging
```bash
# With Bun
bun run docker:logs           # View all logs
bun run docker:logs:app       # View app logs only
bun run docker:logs:init      # View data generation logs
bun run docker:restart        # Restart all services
bun run docker:restart:app    # Restart just app

# Direct Docker Compose
docker compose logs -f        # View all logs
docker compose logs -f app    # View app logs only
docker compose logs -f data-init  # View data generation logs
docker compose restart       # Restart all services
docker compose restart app   # Restart just app
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
