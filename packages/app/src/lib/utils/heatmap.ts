import type { Heatmap, HeatmapTimeline, RecordType, HeatmapBlueprint } from '@atm/shared/types';

/**
 * Merge multiple heatmaps into a single heatmap by combining counts and recalculating density
 * All heatmaps must have the same grid dimensions and cell alignment
 * 
 * @param heatmaps Array of heatmaps to merge
 * @param blueprint Optional heatmap blueprint for grid size validation
 * @returns Single merged heatmap with combined counts and recalculated density
 */
export function mergeHeatmaps(heatmaps: Heatmap[], blueprint?: HeatmapBlueprint): Heatmap {
  // Filter out invalid heatmaps
  const validHeatmaps = heatmaps.filter(heatmap => 
    heatmap && 
    heatmap.countArray && 
    heatmap.densityArray && 
    heatmap.countArray.length > 0
  );

  if (validHeatmaps.length === 0) {
    // Validate blueprint and calculate grid size safely
    let gridSize = 0;
    if (blueprint) {
      if (blueprint.rows > 0 && blueprint.cols > 0) {
        // Blueprint has rows/cols properties
        gridSize = blueprint.rows * blueprint.cols;
      } else if (Array.isArray(blueprint) || (typeof blueprint === 'object' && Object.keys(blueprint).length > 0)) {
        // Blueprint is an array of cells or object with numeric keys
        gridSize = Array.isArray(blueprint) ? blueprint.length : Object.keys(blueprint).length;
      }
    }
    
    
    return {
      densityArray: new Array(gridSize).fill(0),
      countArray: new Array(gridSize).fill(0)
    };
  }

  if (validHeatmaps.length === 1) {
    return validHeatmaps[0];
  }

  // Get grid size from first valid heatmap
  const gridSize = validHeatmaps[0].countArray.length;
  
  // Validate all valid heatmaps have the same grid size
  for (let i = 1; i < validHeatmaps.length; i++) {
    if (validHeatmaps[i].countArray.length !== gridSize) {
      throw new Error(`Heatmap grid size mismatch: expected ${gridSize}, got ${validHeatmaps[i].countArray.length}`);
    }
    if (validHeatmaps[i].densityArray.length !== gridSize) {
      throw new Error(`Heatmap grid size mismatch: expected ${gridSize}, got ${validHeatmaps[i].densityArray.length}`);
    }
  }

  // Initialize merged arrays
  const mergedCounts = new Array(gridSize).fill(0);
  const mergedDensity = new Array(gridSize).fill(0);

  // Merge counts cell by cell
  for (let cellIndex = 0; cellIndex < gridSize; cellIndex++) {
    let totalCount = 0;
    
    // Sum counts from all valid heatmaps for this cell
    for (const heatmap of validHeatmaps) {
      totalCount += heatmap.countArray[cellIndex];
    }
    
    mergedCounts[cellIndex] = totalCount;
  }

  // Recalculate density based on merged counts
  // Note: This assumes density is proportional to count
  // If density calculation is more complex, this logic may need adjustment
  const maxCount = Math.max(...mergedCounts);
  
  for (let cellIndex = 0; cellIndex < gridSize; cellIndex++) {
    if (maxCount > 0) {
      // Simple density calculation: normalized count (0-1 range)
      mergedDensity[cellIndex] = mergedCounts[cellIndex] / maxCount;
    } else {
      mergedDensity[cellIndex] = 0;
    }
  }

  const result = {
    densityArray: mergedDensity,
    countArray: mergedCounts
  };

  return result;
}

/**
 * Merge heatmaps from multiple recordTypes within a time slice
 * 
 * @param timeSliceData Data for a specific time slice containing multiple recordTypes
 * @param recordTypes Array of recordTypes to merge
 * @returns Merged heatmap or null if no valid data
 */
export function mergeTimeSliceHeatmaps(
  timeSliceData: any,
  recordTypes: RecordType[]
): Heatmap | null {
  const heatmapsToMerge: Heatmap[] = [];

  // Collect base heatmaps from all requested recordTypes
  for (const recordType of recordTypes) {
    const recordTypeData = timeSliceData[recordType];
    if (recordTypeData?.base) {
      heatmapsToMerge.push(recordTypeData.base);
    }
  }

  if (heatmapsToMerge.length === 0) {
    return null;
  }

  return mergeHeatmaps(heatmapsToMerge);
}

/**
 * Merge multiple HeatmapTimelines into a single timeline with merged recordTypes
 * This creates a new timeline where each time slice contains merged heatmaps
 * 
 * @param timeline Original HeatmapTimeline containing multiple recordTypes
 * @param recordTypes Array of recordTypes to merge
 * @param selectedTag Optional tag to use instead of base heatmaps
 * @param blueprint Optional heatmap blueprint for grid size validation
 * @returns New HeatmapTimeline with merged recordTypes for smooth navigation
 */
export function mergeHeatmapTimeline(
  timeline: HeatmapTimeline,
  recordTypes: RecordType[],
  selectedTag?: string,
  blueprint?: HeatmapBlueprint
): HeatmapTimeline {
  const mergedTimeline: HeatmapTimeline = {};

  // Process each time slice
  for (const [timeSliceKey, timeSliceData] of Object.entries(timeline)) {
    const heatmapsToMerge: Heatmap[] = [];
    
    // Collect heatmaps from all requested recordTypes for this time slice
    for (const recordType of recordTypes) {
      const recordTypeData = timeSliceData[recordType];
      
      if (recordTypeData) {
        if (selectedTag && recordTypeData.tags[selectedTag]) {
          // Use tag-specific heatmap if tag is selected
          heatmapsToMerge.push(recordTypeData.tags[selectedTag]);
        } else if (recordTypeData.base) {
          // Use base heatmap
          heatmapsToMerge.push(recordTypeData.base);
        }
      }
    }

    // Only include time slices that have data from at least one recordType
    if (heatmapsToMerge.length > 0) {
      const mergedHeatmap = mergeHeatmaps(heatmapsToMerge, blueprint);
      
      // Create a combined recordType key (e.g., "text+image")
      const combinedRecordType = recordTypes.sort().join('+') as RecordType;
      
      // Structure the merged data as a single recordType in the timeline
      mergedTimeline[timeSliceKey] = {
        [combinedRecordType]: {
          base: mergedHeatmap,
          tags: selectedTag ? { [selectedTag]: mergedHeatmap } : {}
        }
      } as any;
    }
  }

  return mergedTimeline;
}