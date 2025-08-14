#!/bin/bash

# Sync environment variables from root .env to packages
# Only copies variables that each package needs

# Get the project root directory (where this script is located)
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

ROOT_ENV="$PROJECT_ROOT/.env"
APP_ENV="$PROJECT_ROOT/packages/app/.env"
PREPROCESSOR_ENV="$PROJECT_ROOT/packages/preprocessor/.env"

# Check if root .env exists
if [ ! -f "$ROOT_ENV" ]; then
    echo "⚠️  Root .env file not found. Please copy .env.example to .env and configure it."
    exit 1
fi

# Create directories if they don't exist
mkdir -p "$(dirname "$APP_ENV")"
mkdir -p "$(dirname "$PREPROCESSOR_ENV")"

# Sync SvelteKit app variables
echo "# Auto-synced from root .env - DO NOT EDIT DIRECTLY" > "$APP_ENV"
echo "# Edit the root .env file instead" >> "$APP_ENV"
echo "" >> "$APP_ENV"

grep "^PUBLIC_FEATURES_API_URL=" "$ROOT_ENV" >> "$APP_ENV" 2>/dev/null || echo "PUBLIC_FEATURES_API_URL=" >> "$APP_ENV"
grep "^PUBLIC_MAPTILER_API_KEY=" "$ROOT_ENV" >> "$APP_ENV" 2>/dev/null || echo "PUBLIC_MAPTILER_API_KEY=" >> "$APP_ENV"
grep "^PRIVATE_VISUALIZATION_BINARY_PATH=" "$ROOT_ENV" >> "$APP_ENV" 2>/dev/null || echo "PRIVATE_VISUALIZATION_BINARY_PATH=" >> "$APP_ENV"

# Sync preprocessor variables
echo "# Auto-synced from root .env - DO NOT EDIT DIRECTLY" > "$PREPROCESSOR_ENV"
echo "# Edit the root .env file instead" >> "$PREPROCESSOR_ENV"
echo "" >> "$PREPROCESSOR_ENV"

# Core preprocessor variables
grep "^OUTPUT_PATH=" "$ROOT_ENV" >> "$PREPROCESSOR_ENV" 2>/dev/null || echo "OUTPUT_PATH=../../data/visualization.bin" >> "$PREPROCESSOR_ENV"

# Optional config variables (only copy if they exist in root .env)
grep "^DATABASE_BASE_URL=" "$ROOT_ENV" >> "$PREPROCESSOR_ENV" 2>/dev/null || true
grep "^DATABASE_BATCH_SIZE=" "$ROOT_ENV" >> "$PREPROCESSOR_ENV" 2>/dev/null || true
grep "^DATABASE_TIMEOUT=" "$ROOT_ENV" >> "$PREPROCESSOR_ENV" 2>/dev/null || true
grep "^BOUNDS_MIN_LON=" "$ROOT_ENV" >> "$PREPROCESSOR_ENV" 2>/dev/null || true
grep "^BOUNDS_MAX_LON=" "$ROOT_ENV" >> "$PREPROCESSOR_ENV" 2>/dev/null || true
grep "^BOUNDS_MIN_LAT=" "$ROOT_ENV" >> "$PREPROCESSOR_ENV" 2>/dev/null || true
grep "^BOUNDS_MAX_LAT=" "$ROOT_ENV" >> "$PREPROCESSOR_ENV" 2>/dev/null || true
grep "^GRID_COLS=" "$ROOT_ENV" >> "$PREPROCESSOR_ENV" 2>/dev/null || true
grep "^GRID_ROWS=" "$ROOT_ENV" >> "$PREPROCESSOR_ENV" 2>/dev/null || true
grep "^GRID_PADDING=" "$ROOT_ENV" >> "$PREPROCESSOR_ENV" 2>/dev/null || true
grep "^CHUNK_ROWS=" "$ROOT_ENV" >> "$PREPROCESSOR_ENV" 2>/dev/null || true
grep "^CHUNK_COLS=" "$ROOT_ENV" >> "$PREPROCESSOR_ENV" 2>/dev/null || true
grep "^CHUNK_OVERLAP=" "$ROOT_ENV" >> "$PREPROCESSOR_ENV" 2>/dev/null || true
grep "^CHUNK_DELAY_MS=" "$ROOT_ENV" >> "$PREPROCESSOR_ENV" 2>/dev/null || true

echo "✅ Environment variables synced from root to packages"
