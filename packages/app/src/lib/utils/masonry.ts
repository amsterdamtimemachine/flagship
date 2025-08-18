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
 * Clear all columns by removing their content
 */
function clearColumns(columns: HTMLElement[]): void {
  columns.forEach(column => {
    column.innerHTML = '';
  });
}

/**
 * Distribute items across columns using round-robin
 */
function distributeItems(items: HTMLElement[], columns: HTMLElement[]): void {
  items.forEach((item, index) => {
    const columnIndex = index % columns.length;
    const targetColumn = columns[columnIndex];
    if (targetColumn) {
      targetColumn.appendChild(item);
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
      
      // Get all masonry items
      const items = Array.from(container.querySelectorAll('.masonry-item')) as HTMLElement[];
      
      // Distribute items using round-robin
      distributeItems(items, columns.slice(0, currentColumnCount));
      
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

/**
 * Simple one-shot layout function (no resize handling)
 */
export function layoutMasonry(container: HTMLElement): void {
  const columns = Array.from(container.querySelectorAll('.masonry-column')) as HTMLElement[];
  const items = Array.from(container.querySelectorAll('.masonry-item')) as HTMLElement[];
  const currentColumnCount = getColumnCount(container);
  
  if (columns.length === 0 || items.length === 0) return;
  
  clearColumns(columns);
  distributeItems(items, columns.slice(0, currentColumnCount));
}
