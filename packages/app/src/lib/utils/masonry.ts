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
 * Distribute items across columns using height-based placement (shortest column first)
 */
function distributeItems(items: HTMLElement[], columns: HTMLElement[]): void {
  
  items.forEach((item, index) => {
    // Find the shortest column BEFORE placing the item
    const shortestColumnIndex = getShortestColumnIndex(columns);
    const targetColumn = columns[shortestColumnIndex];
    
    if (targetColumn) {
      // Place item in shortest column
      targetColumn.appendChild(item);
      
      // Force a layout to get accurate measurements
      item.offsetHeight; // Force reflow
      
      if (index < 5) { // Log first 5 items
        const columnHeight = getColumnHeight(targetColumn);
      }
    } else {
      console.error(`❌ No target column found for index ${shortestColumnIndex}`);
    }
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
      distributeItems(items, targetColumns);
      
      lastColumnCount = currentColumnCount;
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

