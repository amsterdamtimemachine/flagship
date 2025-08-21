// masonryMemoized.ts - Memory-aware masonry layout utility
import debounce from 'lodash.debounce';

export interface MasonryMemoizedOptions {
  debounceDelay?: number;
  layoutMemory?: Map<string, number>; // featureId -> columnIndex
}

export interface MasonryMemoizedInstance {
  layout: (forceLayout?: boolean) => void;
  clearMemory: () => void;
  destroy: () => void;
}

/**
 * Extract feature URL from masonry item element (used as unique identifier)
 */
function getFeatureId(item: HTMLElement): string | null {
  // Look for data-feature-url attribute on the masonry-item
  const featureUrl = item.getAttribute('data-feature-url');
  if (featureUrl) return featureUrl;
  
  // Fallback: look for feature URL in child FeatureCard
  const featureCard = item.querySelector('[data-feature-url]');
  return featureCard?.getAttribute('data-feature-url') || null;
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
 * Get the current height of a column by measuring its content
 */
function getColumnHeight(column: HTMLElement): number {
  let totalHeight = 0;
  for (let i = 0; i < column.children.length; i++) {
    const child = column.children[i] as HTMLElement;
    totalHeight += child.offsetHeight;
    
    // Add gap between items (matching CSS gap: 1rem = 16px)
    if (i < column.children.length - 1) {
      totalHeight += 16;
    }
  }
  return totalHeight;
}

/**
 * Find the column with the shortest total height
 */
function getShortestColumnIndex(columns: HTMLElement[]): number {
  let shortestIndex = 0;
  let shortestHeight = getColumnHeight(columns[0]);
  
  for (let i = 1; i < columns.length; i++) {
    const height = getColumnHeight(columns[i]);
    if (height < shortestHeight) {
      shortestIndex = i;
      shortestHeight = height;
    }
  }
  
  return shortestIndex;
}

/**
 * Memory-aware distribution: check memory first, fallback to height-based placement
 */
function distributeItemsWithMemory(
  items: HTMLElement[], 
  columns: HTMLElement[], 
  layoutMemory: Map<string, number>
): void {
  console.log('🧠 Starting memory-aware distribution:', { 
    itemCount: items.length, 
    columnCount: columns.length,
    memorySize: layoutMemory.size 
  });
  
  let memoryHits = 0;
  let newPlacements = 0;
  
  items.forEach((item, index) => {
    const featureId = getFeatureId(item);
    
    if (featureId && layoutMemory.has(featureId)) {
      // Try to use remembered placement
      const rememberedColumnIndex = layoutMemory.get(featureId)!;
      
      // Validate remembered column still exists
      if (rememberedColumnIndex < columns.length) {
        const rememberedColumn = columns[rememberedColumnIndex];
        rememberedColumn.appendChild(item);
        memoryHits++;
        
        if (index < 3) {
          console.log(`💾 Item ${index} (${featureId}): placed in remembered column ${rememberedColumnIndex}`);
        }
      } else {
        // Remembered column doesn't exist anymore, use height-based + update memory
        const shortestColumnIndex = getShortestColumnIndex(columns);
        columns[shortestColumnIndex].appendChild(item);
        layoutMemory.set(featureId, shortestColumnIndex);
        newPlacements++;
        
        if (index < 3) {
          console.log(`🔄 Item ${index} (${featureId}): remembered column ${rememberedColumnIndex} invalid, placed in column ${shortestColumnIndex}`);
        }
      }
    } else {
      // New feature or no ID - use height-based placement + store in memory
      const shortestColumnIndex = getShortestColumnIndex(columns);
      columns[shortestColumnIndex].appendChild(item);
      
      if (featureId) {
        layoutMemory.set(featureId, shortestColumnIndex);
      }
      newPlacements++;
      
      if (index < 3) {
        console.log(`✨ Item ${index} (${featureId || 'no-id'}): new placement in column ${shortestColumnIndex}`);
      }
    }
    
    // Force layout for accurate measurements
    item.offsetHeight;
  });
  
  console.log(`🏁 Memory-aware distribution complete - Memory hits: ${memoryHits}, New placements: ${newPlacements}`);
  
  // Log final distribution
  const finalHeights = columns.map(getColumnHeight);
  console.log('📊 Final column heights:', finalHeights);
  columns.forEach((col, idx) => {
    console.log(`📊 Column ${idx}: ${col.children.length} items, ${finalHeights[idx]}px height`);
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
 * Create a memory-aware masonry layout
 */
export function createMasonryMemoized(
  container: HTMLElement,
  options: MasonryMemoizedOptions = {}
): MasonryMemoizedInstance {
  const { debounceDelay = 100, layoutMemory = new Map() } = options;
  
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
      
      // Distribute items using memory-aware algorithm
      const targetColumns = columns.slice(0, currentColumnCount);
      distributeItemsWithMemory(items, targetColumns, layoutMemory);
      
      lastColumnCount = currentColumnCount;
    } else {
      console.log('⏭️ Skipping layout - no changes needed');
    }
  }

  /**
   * Clear layout memory
   */
  function clearMemory(): void {
    console.log('🧹 Clearing masonry layout memory');
    layoutMemory.clear();
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
    clearMemory,
    destroy: () => {
      unbindResize();
      clearColumns(columns);
    }
  };
}