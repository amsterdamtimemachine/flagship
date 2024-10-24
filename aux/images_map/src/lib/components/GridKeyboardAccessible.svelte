<!-- AccessibleGrid.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  
  interface GridCell {
    id: string;
    x: number;
    y: number;
    value: number;
    dataPoints: number;
  }

  let cells: GridCell[] = [];
  let focusedCell: string | null = null;
  let gridElement: HTMLDivElement;
  
  const CELL_SIZE = 50;
  const GRID_SIZE = 10;
  
  const generateGridData = () => {
    const totalCells = GRID_SIZE * GRID_SIZE;
    return Array.from({ length: totalCells }, (_, i) => ({
      id: `cell-${i}`,
      x: (i % GRID_SIZE) * CELL_SIZE,
      y: Math.floor(i / GRID_SIZE) * CELL_SIZE,
      value: Math.random(),
      dataPoints: Math.floor(Math.random() * 100)
    }));
  };

  onMount(() => {
    cells = generateGridData();
  });

  function handleCellFocus(cellId: string) {
    focusedCell = cellId;
  }

  function handleKeyNavigation(event: KeyboardEvent, cellIndex: number) {
    const gridSize = Math.sqrt(cells.length);
    let newIndex = cellIndex;

    switch (event.key) {
      case 'ArrowRight':
        newIndex = cellIndex + 1;
        break;
      case 'ArrowLeft':
        newIndex = cellIndex - 1;
        break;
      case 'ArrowUp':
        newIndex = cellIndex - gridSize;
        break;
      case 'ArrowDown':
        newIndex = cellIndex + gridSize;
        break;
    }

    if (newIndex >= 0 && newIndex < cells.length) {
      const buttons = gridElement.getElementsByTagName('button');
      buttons[newIndex]?.focus();
    }
  }

  $: focusedCellData = focusedCell 
    ? cells.find(c => c.id === focusedCell)
    : null;
</script>

<div 
  class="relative w-[500px] h-[500px] border border-gray-200 rounded-lg overflow-hidden"
  role="grid"
  aria-label="Historical data heatmap"
  bind:this={gridElement}
>
  <!-- SVG Grid Background -->
  <svg class="absolute inset-0 w-full h-full">
    <defs>
      <pattern 
        id="grid" 
        width={CELL_SIZE} 
        height={CELL_SIZE} 
        patternUnits="userSpaceOnUse"
      >
        <rect 
          width={CELL_SIZE - 2}
          height={CELL_SIZE - 2}
          x="1"
          y="1"
          fill="none" 
          stroke="#ddd" 
          stroke-width="1"
        />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#grid)" />
    
    <!-- Data Cells -->
    {#each cells as cell, i}
      <rect
        x={cell.x + 1}
        y={cell.y + 1}
        width={CELL_SIZE - 2}
        height={CELL_SIZE - 2}
        fill="rgb(0, 0, {Math.floor(cell.value * 255)})"
        opacity={focusedCell === cell.id ? 0.8 : 0.6}
      />
    {/each}
  </svg>

  <!-- Accessible Interactive Layer -->
  <div 
    class="absolute inset-0 grid"
    style="grid-template-columns: repeat({GRID_SIZE}, {CELL_SIZE}px); grid-template-rows: repeat({GRID_SIZE}, {CELL_SIZE}px)"
    role="row"
  >
    {#each cells as cell, i}
      <button
        class="focus:outline-none focus:ring-1 focus:ring-blue-500 focus:ring-inset focus:relative focus:z-10"
        on:focus={() => handleCellFocus(cell.id)}
        on:keydown={(e) => handleKeyNavigation(e, i)}
        aria-label="Grid cell {i + 1} with {Math.floor(cell.value * 100)}% data density"
        tabindex="0"
      >
        <span class="sr-only">
          Contains {cell.dataPoints} historical records
        </span>
      </button>
    {/each}
  </div>

  <!-- Tooltip -->
  {#if focusedCellData}
    <div
      role="tooltip"
      class="absolute p-4 bg-white shadow-lg rounded-lg z-20"
      style="left: {focusedCellData.x}px; top: {focusedCellData.y}px"
    >
      <h3 class="font-bold text-sm">Cell Details</h3>
      <p class="text-sm">
        Data density: {Math.floor(focusedCellData.value * 100)}%
        <br />
        Records: {focusedCellData.dataPoints}
      </p>
    </div>
  {/if}
</div>
