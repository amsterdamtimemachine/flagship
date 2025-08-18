// masonry.ts - Functional masonry layout utility
import debounce from 'lodash.debounce';

export interface MasonryOptions {
  debounceDelay?: number;
}

export interface MasonryInstance {
  layout: (forceLayout?: boolean) => void;
  destroy: () => void;
}

/**
 * Clear all columns by moving their content back to the container
 */
function clearColumns(columns: HTMLElement[]): void {
  columns.forEach(column => {
    // Move all children back to the container (parent of columns)
    while (column.firstChild) {
      const child = column.firstChild;
      column.parentElement?.appendChild(child);
    }
  });
}

/**
 * Distribute items across columns using weighted round-robin
 */
function distributeItems(items: HTMLElement[], columns: HTMLElement[]): void {
  console.log('🎯 Starting distribution:', { itemCount: items.length, columnCount: columns.length });
  
  // Track weight distribution per column
  const columnWeights = columns.map(() => ({ light: 0, medium: 0, heavy: 0 }));
  
  items.forEach((item, index) => {
    // Get weight from data attribute (set by the component)
    const weight = item.dataset.weight as 'light' | 'medium' | 'heavy' || 'light';
    
    if (index < 5) { // Log first 5 items
      console.log(`📦 Item ${index}: weight=${weight}, element=`, item);
    }
    
    // Find ALL columns with the minimum count of this weight type
    const weightCounts = columnWeights.map(weights => weights[weight]);
    const minWeightCount = Math.min(...weightCounts);
    const candidateColumns = weightCounts
      .map((count, index) => ({ index, weightCount: count }))
      .filter(col => col.weightCount === minWeightCount);
    
    let targetColumnIndex: number;
    
    if (candidateColumns.length === 1) {
      // Only one column has minimum weight - use it
      targetColumnIndex = candidateColumns[0].index;
    } else {
      // Multiple columns tied - pick the one with fewest total items
      const totalCounts = candidateColumns.map(col => {
        const weights = columnWeights[col.index];
        return weights.light + weights.medium + weights.heavy;
      });
      const minTotalCount = Math.min(...totalCounts);
      
      // Find all columns with minimum total count
      const finalCandidates = candidateColumns.filter((_, i) => totalCounts[i] === minTotalCount);
      
      // If still tied, pick the first one (but now it's fair since we considered all options)
      targetColumnIndex = finalCandidates[0].index;
    }
    
    // Place item in target column and update weight tracking
    const targetColumn = columns[targetColumnIndex];
    if (targetColumn) {
      targetColumn.appendChild(item);
      columnWeights[targetColumnIndex][weight]++;
      
      if (index < 5) { // Log first 5 placements
        console.log(`✅ Item ${index} placed in column ${targetColumnIndex}`);
      }
    } else {
      console.error(`❌ No target column found for index ${targetColumnIndex}`);
    }
  });
  
  // Log final distribution
  console.log('🏁 Distribution complete:', columnWeights);
  columns.forEach((col, idx) => {
    console.log(`📊 Column ${idx}: ${col.children.length} items`);
  });
}

/**
 * Get current column count from CSS custom property
 */
function getColumnCount(container: HTMLElement): number {
  const count = getComputedStyle(container)
    .getPropertyValue('--column-count')
    .trim();
  return parseInt(count) || 3; // fallback to 3
}

/**
 * Create a functional masonry layout
 */
export function createMasonry(
  container: HTMLElement,
  options: MasonryOptions = {}
): MasonryInstance {
  const { debounceDelay = 100 } = options;
  
  // Get columns once
  const columns = Array.from(container.querySelectorAll('.masonry-column')) as HTMLElement[];
  
  if (columns.length === 0) {
    throw new Error('No columns found with class .masonry-column');
  }

  let lastColumnCount: number | null = null;

  /**
   * Main layout function
   */
  function layout(forceLayout = false): void {
    const currentColumnCount = getColumnCount(container);
    
    // Only re-layout if column count changed or forced
    if (forceLayout || currentColumnCount !== lastColumnCount) {
      
      // Clear all columns
      clearColumns(columns);
      
      // Get all masonry items (including those already moved into columns)
      const items = Array.from(container.querySelectorAll('.masonry-item')) as HTMLElement[];
      
      // Distribute items using round-robin
      const targetColumns = columns.slice(0, currentColumnCount);
      console.log('🎯 Target columns:', targetColumns.length);
      distributeItems(items, targetColumns);
      
      lastColumnCount = currentColumnCount;
    } else {
      console.log('⏭️ Skipping layout - no changes needed');
    }
  }

  // Create debounced resize handler
  const debouncedLayout = debounce(() => layout(), debounceDelay);

  // Bind resize listener
  const bindResize = () => {
    window.addEventListener('resize', debouncedLayout, true);
  };

  // Unbind resize listener
  const unbindResize = () => {
    window.removeEventListener('resize', debouncedLayout, true);
  };

  // Setup
  bindResize();
  layout(true); // Initial layout

  return {
    layout,
    destroy: () => {
      unbindResize();
      clearColumns(columns);
    }
  };
}

