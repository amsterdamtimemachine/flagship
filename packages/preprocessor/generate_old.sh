#!/bin/bash

# Amsterdam Time Machine Binary Generator Script
# Simple wrapper for main_old.ts with common operations

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Amsterdam Time Machine Binary Generator${NC}"
echo ""

# Parse command line arguments
COMMAND=${1:-"help"}

case $COMMAND in
  "dev"|"development")
    echo -e "${YELLOW}📊 Generating development binary...${NC}"
    echo "This will create a small test binary for development"
    echo ""
    bun run src/main_old.ts --preset DEVELOPMENT --output ./visualization-dev.bin 
    if [ $? -eq 0 ]; then
      echo ""
      echo -e "${GREEN}✅ Development binary created: visualization-dev.bin${NC}"
      echo -e "${BLUE}📋 Next steps:${NC}"
      echo "  1. Copy to your app: cp ./visualization-dev.bin ../app/data/"
      echo "  2. Set env var: VISUALIZATION_BINARY_PATH=./data/visualization-dev.bin"
      echo "  3. Test: curl http://localhost:5173/api/metadata"
    fi
    ;;

  "prod"|"production")
    echo -e "${YELLOW}🏭 Generating production binary...${NC}"
    echo "This will create a full-resolution binary for production use"
    echo "⚠️  This may take several minutes and use significant bandwidth"
    read -p "Continue? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      bun run src/main_old.ts --preset PRODUCTION --output ./visualization.bin
      if [ $? -eq 0 ]; then
        echo ""
        echo -e "${GREEN}✅ Production binary created: visualization.bin${NC}"
        echo -e "${BLUE}📋 Next steps:${NC}"
        echo "  1. Copy to your production server"
        echo "  2. Set env var: VISUALIZATION_BINARY_PATH=/path/to/visualization.bin"
        echo "  3. Deploy your SvelteKit app"
      fi
    else
      echo "Cancelled."
    fi
    ;;

  "test")
    echo -e "${YELLOW}🧪 Generating test binary...${NC}"
    echo "This will create a minimal binary for automated testing"
    echo ""
    bun run src/main_old.ts --preset DEVELOPMENT --output ./test-data.bin 
    if [ $? -eq 0 ]; then
      echo ""
      echo -e "${GREEN}✅ Test binary created: test-data.bin${NC}"
    fi
    ;;

  "quick")
    echo -e "${YELLOW}⚡ Quick test generation...${NC}"
    echo "Creating minimal binary with smallest possible configuration"
    echo ""
    PRESET=DEVELOPMENT OUTPUT_PATH=./quick-test.bin bun run src/main_old.ts
    if [ $? -eq 0 ]; then
      echo ""
      echo -e "${GREEN}✅ Quick test binary created: quick-test.bin${NC}"
      ls -lh quick-test.bin
    fi
    ;;

  "clean")
    echo -e "${YELLOW}🧹 Cleaning generated files...${NC}"
    rm -f *.bin
    echo -e "${GREEN}✅ All .bin files removed${NC}"
    ;;

  "status")
    echo -e "${BLUE}📊 Binary files status:${NC}"
    echo ""
    for file in *.bin; do
      if [ -f "$file" ]; then
        size=$(ls -lh "$file" | awk '{print $5}')
        echo -e "  ${GREEN}✓${NC} $file (${size})"
      fi
    done
    
    if ! ls *.bin >/dev/null 2>&1; then
      echo -e "  ${YELLOW}No binary files found${NC}"
      echo ""
      echo -e "${BLUE}💡 Generate one with:${NC}"
      echo "  ./generate.sh dev     # Development binary"
      echo "  ./generate.sh quick   # Quick test binary"
    fi
    ;;

  "help"|*)
    echo -e "${BLUE}📖 Usage: ./generate_old.sh <command>${NC}"
    echo ""
    echo "Commands:"
    echo "  dev        Generate development binary (recommended for testing)"
    echo "  prod       Generate production binary (full resolution)"
    echo "  test       Generate test binary (for automated testing)"
    echo "  quick      Generate minimal test binary (fastest)"
    echo "  clean      Remove all generated .bin files"
    echo "  status     Show status of generated files"
    echo "  help       Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./generate.sh dev      # Quick start for development"
    echo "  ./generate.sh prod     # Production deployment"
    echo "  ./generate.sh quick    # Fast test"
    echo ""
    echo -e "${BLUE}💡 For custom options, use:${NC}"
    echo "  bun run src/main_old.ts --help"
    ;;
esac
