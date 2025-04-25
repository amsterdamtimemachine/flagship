#!/bin/bash

# Simple script to generate vector tiles from Amsterdam cellular map GeoJSONs
# requirements:
# mb-util (install via pip install mbutil)
# tippecanoe (build and install via https://github.com/felt/tippecanoe)

# Configuration
GEOJSON_FILE="amsterdam_data/amsterdam_dissolved_50m.geojson"
OUTPUT_DIR="amsterdam_tiles"
MBTILES_FILE="$OUTPUT_DIR/amsterdam_dissolved.mbtiles"
TILES_DIR="$OUTPUT_DIR/tiles"

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo "Generating vector tiles from $GEOJSON_FILE..."

# Generate vector tiles with Tippecanoe (with force option)
tippecanoe \
  -o "$MBTILES_FILE" \
  -z15 \
  -Z10 \
  --drop-densest-as-needed \
  --force \
  "$GEOJSON_FILE"

echo "Vector tiles generated at $MBTILES_FILE"

# Force removal of existing tiles directory
echo "Removing any existing tiles directory..."
rm -rf "$TILES_DIR"

# Extract tiles to directory structure
echo "Extracting tiles to directory structure..."
mb-util \
  --image_format=pbf \
  "$MBTILES_FILE" \
  "$TILES_DIR"

echo "Tiles extracted to $TILES_DIR"
echo "Done!"
