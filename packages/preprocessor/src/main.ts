// src/main.ts - Main binary generation script for Amsterdam Time Machine
import { 
  generateHeatmapResolutions,
  generateHeatmapBlueprint,
  createTimeSlices
} from './processing/heatmap';
import {
  generateDefaultHistograms
} from './serialization/visualization';
import {
  createVisualizationBinary,
  generateVisualizationStats
} from './serialization/visualization';
import { 
  AMSTERDAM_DATABASE_CONFIG, 
  AMSTERDAM_BOUNDS,
  PRESETS,
  getPreset
} from './config/defaults';
import type { 
  HeatmapDimensions, 
  HeatmapResolutionConfig, 
  RecordType, 
  TimeSlice 
} from '@atm/shared/types';

// Configuration
const PRESET = process.env.PRESET || 'DEVELOPMENT'; // Can be DEVELOPMENT, PRODUCTION, MEMORY_EFFICIENT, HIGH_RESOLUTION
const OUTPUT_PATH = process.env.OUTPUT_PATH || './visualization.bin';
const INCLUDE_TEST_RESOLUTIONS = process.env.INCLUDE_TEST_RESOLUTIONS === 'true';

async function main() {
  console.log('Starting Amsterdam Time Machine Binary Generation');
  console.log(`Using preset: ${PRESET}`);
  console.log(`Output path: ${OUTPUT_PATH}`);
  
  const startTime = Date.now();
  
  try {
    // Get configuration from preset
    const config = getPreset(PRESET as keyof typeof PRESETS);
    console.log(`Grid dimensions: ${config.grid.colsAmount}x${config.grid.rowsAmount}`);
    console.log(`Chunking: ${config.chunking.chunkRows}x${config.chunking.chunkCols} chunks`);

    // Define time periods
    const timeSlices: TimeSlice[] = createTimeSlices([
      { start: 1600, end: 1700 }, // 17th century
      { start: 1700, end: 1800 }, // 18th century  
      { start: 1800, end: 1850 }, // Early 19th century
      { start: 1850, end: 1900 }, // Late 19th century
      { start: 1900, end: 1950 }, // Early 20th century
      { start: 1950, end: 2000 }, // Late 20th century
      { start: 2000, end: 2050 }  // 21st century
    ]);

    console.log(`Time periods: ${timeSlices.length} (${timeSlices[0].label} to ${timeSlices[timeSlices.length-1].label})`);

    // Define record types to process
    const recordTypes: RecordType[] = ['text', 'image'];
    console.log(`Record types: ${recordTypes.join(', ')}`);

    // Define resolutions to generate
    const resolutions: HeatmapResolutionConfig[] = [
      { cols: config.grid.colsAmount, rows: config.grid.rowsAmount }
    ];

    // Add test resolutions if requested
    if (INCLUDE_TEST_RESOLUTIONS) {
      resolutions.push(
        { cols: 8, rows: 8 },     // Low resolution for quick testing
        { cols: 16, rows: 16 },   // Medium resolution
        { cols: 32, rows: 32 }    // Higher resolution
      );
    }

    console.log(`Resolutions: ${resolutions.map(r => `${r.cols}x${r.rows}`).join(', ')}`);

    // Calculate bounds with padding
    const padding = config.grid.padding;
    const lonRange = AMSTERDAM_BOUNDS.maxLon - AMSTERDAM_BOUNDS.minLon;
    const latRange = AMSTERDAM_BOUNDS.maxLat - AMSTERDAM_BOUNDS.minLat;
    
    const bounds = {
      minLon: AMSTERDAM_BOUNDS.minLon - (lonRange * padding),
      maxLon: AMSTERDAM_BOUNDS.maxLon + (lonRange * padding),
      minLat: AMSTERDAM_BOUNDS.minLat - (latRange * padding),
      maxLat: AMSTERDAM_BOUNDS.maxLat + (latRange * padding)
    };

    console.log(`=� Processing bounds: [${bounds.minLon.toFixed(3)}, ${bounds.minLat.toFixed(3)}] to [${bounds.maxLon.toFixed(3)}, ${bounds.maxLat.toFixed(3)}]`);

    // Step 1: Generate heatmap resolutions
    console.log('\n=% Step 1: Generating heatmap resolutions...');
    const heatmapResolutions = await generateHeatmapResolutions(
      config.database,
      bounds,
      config.chunking,
      recordTypes,
      resolutions,
      timeSlices
    );

    console.log(`Generated ${Object.keys(heatmapResolutions).length} heatmap resolutions`);

    // Step 2: Generate default histograms
    console.log('\n Step 2: Generating default histograms...');
    const histograms = await generateDefaultHistograms(
      config.database,
      bounds,
      config.chunking,
      timeSlices,
      recordTypes,
      [] // Start with no specific tags, will extract from data
    );

    console.log(`Generated histograms for ${Object.keys(histograms).length} record types`);

    // Step 3: Generate heatmap dimensions and blueprint
    console.log('\n Step 3: Generating heatmap metadata...');
    const primaryResolution = resolutions[0];
    const heatmapDimensions: HeatmapDimensions = {
      colsAmount: primaryResolution.cols,
      rowsAmount: primaryResolution.rows,
      cellWidth: (bounds.maxLon - bounds.minLon) / primaryResolution.cols,
      cellHeight: (bounds.maxLat - bounds.minLat) / primaryResolution.rows,
      minLon: bounds.minLon,
      maxLon: bounds.maxLon,
      minLat: bounds.minLat,
      maxLat: bounds.maxLat
    };

    const heatmapBlueprint = generateHeatmapBlueprint(heatmapDimensions);
    console.log(` Generated blueprint with ${heatmapBlueprint.cells.length} cells`);

    // Step 4: Extract unique tags from data
    console.log('\n<� Step 4: Extracting tags from heatmap data...');
    const allTags = new Set<string>();
    
    // Extract tags from heatmap data
    for (const [resolutionKey, timeline] of Object.entries(heatmapResolutions)) {
      for (const [timeSliceKey, timeSliceData] of Object.entries(timeline)) {
        for (const [recordType, recordTypeData] of Object.entries(timeSliceData)) {
          for (const tag of Object.keys(recordTypeData.tags)) {
            allTags.add(tag);
          }
        }
      }
    }

    const tags = Array.from(allTags).sort();
    console.log(` Found ${tags.length} unique tags: ${tags.slice(0, 10).join(', ')}${tags.length > 10 ? '...' : ''}`);

    // Step 5: Generate visualization statistics
    console.log('\n=� Step 5: Generating visualization statistics...');
    const stats = generateVisualizationStats(heatmapResolutions, histograms, timeSlices);
    
    console.log(` Statistics generated:`);
    console.log(`   - Total features: ${stats.totalFeatures}`);
    console.log(`   - Features per type: ${Object.entries(stats.featuresPerRecordType).map(([type, count]) => `${type}: ${count}`).join(', ')}`);
    console.log(`   - Time slices: ${stats.timeSliceCount}`);
    console.log(`   - Grid cells: ${stats.gridCellCount}`);
    console.log(`   - Resolutions: ${stats.resolutionCount}`);

    // Step 6: Create visualization binary
    console.log('\n=� Step 6: Creating visualization binary...');
    await createVisualizationBinary(
      OUTPUT_PATH,
      heatmapResolutions,
      histograms,
      heatmapDimensions,
      heatmapBlueprint,
      timeSlices,
      recordTypes,
      resolutions,
      tags,
      bounds,
      stats
    );

    // Step 7: Verify binary file
    console.log('\n Step 7: Verifying binary file...');
    const file = Bun.file(OUTPUT_PATH);
    const fileExists = await file.exists();
    const fileSize = fileExists ? file.size : 0;
    
    if (fileExists) {
      console.log(` Binary file created successfully:`);
      console.log(`   - Path: ${OUTPUT_PATH}`);
      console.log(`   - Size: ${(fileSize / (1024 * 1024)).toFixed(2)} MB`);
      console.log(`   - Resolutions: ${Object.keys(heatmapResolutions).length}`);
      console.log(`   - Time periods: ${timeSlices.length}`);
      console.log(`   - Record types: ${recordTypes.length}`);
      console.log(`   - Tags: ${tags.length}`);
    } else {
      throw new Error('Binary file was not created successfully');
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n<� Binary generation completed successfully in ${totalTime}s`);
    
    // Print usage instructions
    console.log('\n Usage Instructions:');
    console.log(`   1. Copy the binary file to your app server:`);
    console.log(`      cp ${OUTPUT_PATH} /path/to/your/app/data/`);
    console.log(`   2. Set environment variable in your SvelteKit app:`);
    console.log(`      VISUALIZATION_BINARY_PATH=/path/to/your/app/data/visualization.bin`);
    console.log(`   3. Start your SvelteKit app and test the API endpoints:`);
    console.log(`      GET /api/metadata`);
    console.log(`      GET /api/histogram?recordType=text`);
    console.log(`      GET /api/heatmaps?recordType=text`);

  } catch (error) {
    console.error('\nL Binary generation failed:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Handle CLI arguments and environment variables
function parseArgs() {
  const args = process.argv.slice(2);
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--preset' && i + 1 < args.length) {
      process.env.PRESET = args[i + 1];
      i++;
    } else if (arg === '--output' && i + 1 < args.length) {
      process.env.OUTPUT_PATH = args[i + 1];
      i++;
    } else if (arg === '--test-resolutions') {
      process.env.INCLUDE_TEST_RESOLUTIONS = 'true';
    } else if (arg === '--help') {
      console.log(`
Amsterdam Time Machine Binary Generator

Usage: bun run src/main.ts [options]

Options:
  --preset <name>       Configuration preset (DEVELOPMENT, PRODUCTION, MEMORY_EFFICIENT, HIGH_RESOLUTION)
  --output <path>       Output path for binary file (default: ./visualization.bin)
  --test-resolutions    Include additional test resolutions (8x8, 16x16, 32x32)
  --help               Show this help message

Environment Variables:
  PRESET               Same as --preset
  OUTPUT_PATH          Same as --output
  INCLUDE_TEST_RESOLUTIONS  Same as --test-resolutions

Examples:
  bun run src/main.ts --preset DEVELOPMENT --output ./test.bin
  bun run src/main.ts --preset PRODUCTION --test-resolutions
  PRESET=HIGH_RESOLUTION bun run src/main.ts
      `);
      process.exit(0);
    }
  }
}

// Main execution
if (import.meta.main) {
  parseArgs();
  main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}
