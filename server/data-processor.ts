import { GeoData, Point, GeomType } from './types';

export const isPolygonZ = (geom: string | null): boolean => {
    return Boolean(geom?.startsWith('POLYGON Z'));
};

export const isMultiLineString = (geom: string | null): boolean => {
    return Boolean(geom?.startsWith('MULTILINESTRING'));
};

export const isPoint = (geom: string | null): boolean => {
    return Boolean(geom?.startsWith('POINT'));
};

const parsePolygon = (geom: string): Point[] => {
    try {
        return geom
            .replace('POLYGON Z ((', '')
            .replace('))', '')
            .split(',')
            .map(coord => {
                const [x, y] = coord.trim().split(' ').map(Number);
                return { x, y };
            });
    } catch (error) {
        console.error('Error parsing polygon:', error);
        return [];
    }
};

const parseMultiLineString = (geom: string): Point[] => {
    try {
        return geom
            .replace('MULTILINESTRING((', '')
            .replace('))', '')
            .split('),(')
            .flatMap(line => 
                line.split(',').map(coord => {
                    const [x, y] = coord.trim().split(' ').map(Number);
                    return { x, y };
                })
            );
    } catch (error) {
        console.error('Error parsing multilinestring:', error);
        return [];
    }
};

const parsePoint = (geom: string): Point[] => {
    try {
        const [x, y] = geom
            .replace('POINT(', '')
            .replace(')', '')
            .split(' ')
            .map(Number);
        return [{ x, y }];
    } catch (error) {
        console.error('Error parsing point:', error);
        return [];
    }
};

const calculateCentroid = (points: Point[]): Point | undefined => {
    if (!points.length) return undefined;
    try {
        const x = points.reduce((sum, p) => sum + p.x, 0) / points.length;
        const y = points.reduce((sum, p) => sum + p.y, 0) / points.length;
        return { x, y };
    } catch (error) {
        console.error('Error calculating centroid:', error);
        return undefined;
    }
};

export const transformData = (data: Record<string, any>): GeoData[] => {
    const transformed = Object.entries(data)
        .map(([id, item]): GeoData | null => {
            if (!item || typeof item !== 'object') {
                console.warn(`Invalid item for id ${id}`);
                return null;
            }

            let points: Point[] = [];
            let geomType: GeomType = 'unknown';

            if (item.geom) {
                if (isPolygonZ(item.geom)) {
                    points = parsePolygon(item.geom);
                    geomType = 'polygon';
                } else if (isMultiLineString(item.geom)) {
                    points = parseMultiLineString(item.geom);
                    geomType = 'multiline';
                } else if (isPoint(item.geom)) {
                    points = parsePoint(item.geom);
                    geomType = 'point';
                }
            }

            const geoData: GeoData = {
                id,
                url: item.url ?? '',
                title: item.title ?? '',
                start_date: item.start_date ?? '',
                end_date: item.end_date ?? '',
                thumb: item.thumb ?? '',
                geom: points,
                geomType
            };

          let centroid: Point | undefined;
          if (geomType === 'point') {
              centroid = points[0]; 
          } else if (points.length) {
              centroid = calculateCentroid(points);
          }

          if (centroid) {
              geoData.centroid = centroid;
          }

            return geoData;
        });

    return transformed.filter((item): item is GeoData => item !== null);
};

export const filterByTimeRange = (
    data: GeoData[], 
    startDate?: string, 
    endDate?: string
): GeoData[] => {
    if (!startDate && !endDate) return data;
    
    return data.filter(item => {
        const itemStart = new Date(item.start_date);
        const itemEnd = new Date(item.end_date);
        const filterStart = startDate ? new Date(startDate) : new Date(0);
        const filterEnd = endDate ? new Date(endDate) : new Date();
        
        return itemStart >= filterStart && itemEnd <= filterEnd;
    });
};
