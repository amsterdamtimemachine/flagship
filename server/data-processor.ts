interface GeoData {
  id: string;
  url: string;
  title: string;
  start_date: string;
  end_date: string;
  thumb: string;
  geom: string;
  centroid?: { x: number; y: number };
}

export const isPolygonZ = (geom: string | null): boolean => {
  return geom?.startsWith('POLYGON Z') ?? false;
};

export const isMultiLineString = (geom: string | null): boolean => {
  return geom?.startsWith('MULTILINESTRING') ?? false;
};

export const isPoint = (geom: string | null): boolean => {
  return geom?.startsWith('POINT') ?? false;
};

const calculatePolygonCentroid = (geom: string): { x: number; y: number } => {
  try {
    const coordinates = geom
      .replace('POLYGON Z ((', '')
      .replace('))', '')
      .split(',')
      .map(coord => coord.trim().split(' ').map(Number));
    
    const x = coordinates.reduce((sum, coord) => sum + coord[0], 0) / coordinates.length;
    const y = coordinates.reduce((sum, coord) => sum + coord[1], 0) / coordinates.length;
    
    return { x, y };
  } catch (error) {
    console.error('Error calculating polygon centroid:', error);
    return { x: 0, y: 0 };
  }
};

const calculateMultiLineCentroid = (geom: string): { x: number; y: number } => {
  try {
    const coords = geom
      .replace('MULTILINESTRING((', '')
      .replace('))', '')
      .split('),(')
      .flatMap(line => 
        line.split(',').map(coord => 
          coord.trim().split(' ').map(Number)
        )
      );
    
    const x = coords.reduce((sum, coord) => sum + coord[0], 0) / coords.length;
    const y = coords.reduce((sum, coord) => sum + coord[1], 0) / coords.length;
    
    return { x, y };
  } catch (error) {
    console.error('Error calculating multiline centroid:', error);
    return { x: 0, y: 0 };
  }
};

export const transformData = (data: Record<string, any>): GeoData[] => {
  if (!data) return [];
  
  return Object.entries(data).map(([id, item]) => {
    if (!item || typeof item !== 'object') {
      console.error(`Invalid item for id ${id}`);
      return null;
    }

    const transformed: GeoData = {
      id,
      url: item.url ?? '',
      title: item.title ?? '',
      start_date: item.start_date ?? '',
      end_date: item.end_date ?? '',
      thumb: item.thumb ?? '',
      geom: item.geom ?? ''
    };

    if (isPolygonZ(item.geom)) {
      transformed.centroid = calculatePolygonCentroid(item.geom);
    } else if (isMultiLineString(item.geom)) {
      transformed.centroid = calculateMultiLineCentroid(item.geom);
    }

    return transformed;
  }).filter(Boolean) as GeoData[];
};

export const filterByTimeRange = (
  data: GeoData[], 
  startDate?: string, 
  endDate?: string
): GeoData[] => {
  if (!data || !Array.isArray(data)) return [];
  if (!startDate && !endDate) return data;
  
  return data.filter(item => {
    try {
      const itemStart = new Date(item.start_date);
      const itemEnd = new Date(item.end_date);
      const filterStart = startDate ? new Date(startDate) : new Date(0);
      const filterEnd = endDate ? new Date(endDate) : new Date();
      
      return itemStart >= filterStart && itemEnd <= filterEnd;
    } catch (error) {
      console.error('Error filtering date range:', error);
      return false;
    }
  });
};
