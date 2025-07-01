# Amsterdam Time Machine - Complete Integration Guide

This guide walks you through generating the binary file and testing the API integration.

## 🚀 Quick Start (Development)

### 1. Generate Development Binary

```bash
cd packages/preprocessor
./generate.sh dev
```

This creates `visualization-dev.bin` (~1-5MB) with test data optimized for development.

### 2. Test API Integration

```bash
cd packages/app
npm run dev
```

Visit: `http://localhost:5173/test-api` and click "Test Real API"

### 3. Verify Endpoints

The following should work:
- `http://localhost:5173/api/metadata` - Dataset information
- `http://localhost:5173/api/histogram?recordType=text` - Histogram data
- `http://localhost:5173/api/heatmaps?recordType=text` - Heatmap timeline

## 📊 Complete Workflow

### Step 1: Preprocessor Setup
```bash
cd packages/preprocessor

# Install dependencies if needed
npm install

# Check available commands
./generate.sh help

# Generate development binary (recommended first)
./generate.sh dev
```

### Step 2: App Configuration
```bash
cd packages/app

# The .env should already point to the dev binary:
# VISUALIZATION_BINARY_PATH=../preprocessor/visualization-dev.bin

# Install dependencies if needed  
npm install
```

### Step 3: Test Integration
```bash
# Start the app
npm run dev

# Test with browser
open http://localhost:5173/test-api

# Or test with curl
curl http://localhost:5173/api/metadata
curl "http://localhost:5173/api/histogram?recordType=text"
curl "http://localhost:5173/api/heatmaps?recordType=text"
```

## 🏭 Production Deployment

### 1. Generate Production Binary
```bash
cd packages/preprocessor
./generate.sh prod  # This may take 10-30 minutes
```

### 2. Deploy Binary
```bash
# Copy to your production server
scp visualization.bin user@server:/data/atm/

# Or copy locally for testing
cp visualization.bin ../app/data/
```

### 3. Configure Production Environment
```bash
# In your production environment
export VISUALIZATION_BINARY_PATH=/data/atm/visualization.bin

# Or in your app's .env
echo "VISUALIZATION_BINARY_PATH=/data/atm/visualization.bin" > .env
```

### 4. Build and Deploy App
```bash
cd packages/app
npm run build
# Deploy with your preferred method (Docker, PM2, etc.)
```

## 🧪 Testing Options

### Quick Tests
```bash
# Minimal test binary (fastest)
cd packages/preprocessor
./generate.sh quick

# Test specific endpoints
curl http://localhost:5173/api/test?endpoint=histogram&recordType=text
```

### Command Line Testing
```bash
cd packages/app
./test-api.sh  # Runs automated API tests
```

### Browser Testing
Visit `http://localhost:5173/test-api` for interactive testing with detailed results.

## 📁 File Structure

```
packages/
├── preprocessor/
│   ├── src/main.ts              # Main binary generator
│   ├── generate.sh              # Convenient CLI wrapper
│   ├── visualization-dev.bin    # Generated dev binary
│   └── visualization.bin        # Generated prod binary
└── app/
    ├── src/
    │   ├── routes/api/           # API endpoints
    │   │   ├── histogram/+server.ts
    │   │   ├── heatmaps/+server.ts
    │   │   └── metadata/+server.ts
    │   └── lib/server/           # Server-side logic
    │       ├── binary-handler.ts # Memory mapping
    │       └── api-service.ts    # Business logic
    ├── .env                      # Environment config
    └── test-api.sh               # Testing script
```

## 🔧 Configuration Options

### Preprocessor Presets
- **DEVELOPMENT**: 20x20 grid, single chunk, fast processing
- **PRODUCTION**: 100x100 grid, 4 chunks, balanced performance  
- **MEMORY_EFFICIENT**: 100x100 grid, 16 chunks, lower memory usage
- **HIGH_RESOLUTION**: 200x200 grid, 16 chunks, maximum detail

### Custom Generation
```bash
# Custom preset and output
bun run src/main.ts --preset PRODUCTION --output ./custom.bin

# Include test resolutions for development
bun run src/main.ts --preset DEVELOPMENT --test-resolutions

# Environment variables
PRESET=HIGH_RESOLUTION OUTPUT_PATH=./hires.bin bun run src/main.ts
```

## 🚨 Troubleshooting

### Binary File Issues
```bash
# Check if binary exists and is readable
ls -la packages/preprocessor/*.bin

# Verify binary structure
curl http://localhost:5173/api/metadata
```

### API Connection Issues
```bash
# Test mock endpoints first
curl http://localhost:5173/api/test?endpoint=histogram&recordType=text

# Check environment variables
echo $VISUALIZATION_BINARY_PATH

# Check server logs
npm run dev  # Look for "Binary file opened" messages
```

### Performance Issues
```bash
# Generate smaller binary for testing
cd packages/preprocessor
./generate.sh quick

# Use development preset for faster iteration
./generate.sh dev
```

## 📈 Expected File Sizes

| Preset | Grid Size | File Size | Generation Time |
|--------|-----------|-----------|-----------------|
| DEVELOPMENT | 20x20 | ~1-5 MB | 1-3 minutes |
| PRODUCTION | 100x100 | ~50-200 MB | 10-30 minutes |
| HIGH_RESOLUTION | 200x200 | ~200-500 MB | 30-60 minutes |

## ✅ Success Indicators

### Preprocessor Success
- Binary file created with expected size
- No error messages during generation  
- Final statistics show processed features

### API Success
- `/api/metadata` returns dataset information
- `/api/histogram` returns temporal data with bins
- `/api/heatmaps` returns spatial data with time periods
- Response times under 1 second

### Integration Success
- Browser test page shows green checkmarks
- Mock API and Real API both work
- No console errors in browser dev tools

## 🔄 Development Workflow

1. **Start with development binary**: `./generate.sh dev`
2. **Test API integration**: Visit test page, verify endpoints
3. **Develop frontend features**: Use mock data for UI development
4. **Generate production binary**: `./generate.sh prod` when ready
5. **Deploy**: Copy binary to server, update environment variables

This workflow allows you to develop and test the frontend without waiting for large binary generation, while ensuring compatibility with production data structures.