import type{ Point } from '$types/geo';
import type { 
  Feature, 
  FeatureCollection, 
  Polygon,
  Position
} from 'geojson';

interface Cell {
  count: number;
}

export function generateDensityMapData(
  points: Point[],
  latLongMin: Point,
  latLongMax: Point,
  numCells: number
): FeatureCollection<Polygon, { count: number; opacity: number }> {
  const width = latLongMax.x - latLongMin.x;
  const height = latLongMin.y - latLongMax.y; // Corrected: y-axis is inverted in geo-coordinates
  const cellWidth = width / numCells;
  const cellHeight = height / numCells;

  // Initialize grid
  const grid: Cell[][] = Array(numCells).fill(null).map(() => 
    Array(numCells).fill(null).map(() => ({ count: 0 }))
  );

  // Count points in each cell
  points.forEach(point => {
    const cellX = Math.floor((point.x - latLongMin.x) / cellWidth);
    const cellY = Math.floor((latLongMin.y - point.y) / cellHeight); // Corrected: y-axis inversion
    if (cellX >= 0 && cellX < numCells && cellY >= 0 && cellY < numCells) {
      grid[cellY][cellX].count++;
    }
  });

  // Find max count for normalization
  const maxCount = Math.max(...grid.flat().map(cell => cell.count));

  // Generate GeoJSON
  const features: Feature<Polygon, { count: number; opacity: number }>[] = [];

  for (let y = 0; y < numCells; y++) {
    for (let x = 0; x < numCells; x++) {
      const cell = grid[y][x];
      const x1 = latLongMin.x + x * cellWidth;
      const y1 = latLongMin.y - y * cellHeight; // Corrected: y-axis inversion
      const x2 = x1 + cellWidth;
      const y2 = y1 - cellHeight; // Corrected: y-axis inversion

      const coordinates: Position[][] = [[
        [x1, y1],
        [x2, y1],
        [x2, y2],
        [x1, y2],
        [x1, y1] // Closing the polygon
      ]];

      features.push({
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: coordinates
        },
        properties: {
          count: cell.count,
          opacity: maxCount > 0 ? cell.count / maxCount : 0 // Avoid division by zero
        }
      });
    }
  }

  return {
    type: 'FeatureCollection',
    features: features
  };
}
