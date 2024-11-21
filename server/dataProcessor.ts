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

const parsePolygon = (geom: string, dropNullVertices: boolean = false): Point[] => {
    try {
        const points: Point[] = 
            geom
                .replace('POLYGON Z ((', '')
                .replace('))', '')
                .split(',')
                .map(coord => {
                    // Split and take only x, y coordinates (ignore z if present)
                    const [x, y] = coord.trim().split(' ').map(Number);
                    
                    if (dropNullVertices) {
                        return isNaN(x) || isNaN(y) ? null : { x, y };
                    } else {
                        return { x, y };
                    }
                })
                .filter((coord): coord is Point => coord !== null);
                
        return points;
    } catch (error) {
        console.error('Error parsing polygon:', error);
        return [];
    }
};

const parseMultiLineString = (geom: string, dropNullVertices: boolean): Point[] => {
    try {
        const points: Point[] = 
            geom
                .replace('MULTILINESTRING((', '')
                .replace('))', '')
                .split('),(')
                .flatMap(line => 
                    line.split(',').map(coord => {
                        const [x, y] = coord.trim().split(' ').map(Number);
                        
                        if (dropNullVertices) {
                            return isNaN(x) || isNaN(y) ? null : { x, y };
                        } else {
                            return { x, y };
                        }
                    }).filter((coord): coord is Point => coord !== null)
                );
                
        return points;
    } catch (error) {
        console.error('Error parsing multilinestring:', error);
        return [];
    }
};


const parsePoint = (geom: string, dropNullVertex: boolean): Point[] | null => {
    try {
        const [x, y] = geom
            .replace('POINT(', '')
            .replace(')', '')
            .split(' ')
            .map(Number);
            if (dropNullVertex) {
              return isNaN(x) || isNaN(y) ? null : [{ x, y }];
            } else {
              return [{ x, y }];
            }
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

const processGeometry = (
    geom: string, 
    dropNulls: boolean
): { points: Point[] | null; geomType: GeomType } | null => {
    if (isPolygonZ(geom)) {
        return null;
        // WIP: ignore polygonZ for now since the data is in wrong coord system in the current data sample
    }

    if (isMultiLineString(geom)) {
        const multiline = parseMultiLineString(geom, dropNulls);
        return {
            points: dropNulls ? (multiline.length > 0 ? multiline : null) : multiline,
            geomType: 'multiline'
        };
    }

    if (isPoint(geom)) {
        const pointArray = parsePoint(geom, dropNulls);
        return {
            points: pointArray,
            geomType: 'point'
        };
    }

    return null;
};

const calculateGeometryCentroid = (
    points: Point[], 
    geomType: GeomType
): Point | undefined => {
    if (points.length === 0) {
        return undefined;
    }

    if (geomType === 'point') {
        return points[0];
    }

    return calculateCentroid(points);
};


export const transformData = (
    data: Record<string, any>, 
    dropNulls: boolean
): GeoData[] => {
    const transformed = Object.entries(data)
        .map(([id, item]): GeoData | null => {
            if (!item || typeof item !== 'object') {
                console.warn(`Invalid item for id ${id}`);
                return null;
            }

            let points: Point[] | null = null;
            let geomType: GeomType = 'unknown';

            if (item.geom) {
                const result = processGeometry(item.geom, dropNulls);
                if (result) {
                    ({ points, geomType } = result);
                }
            }

            if (!points || (dropNulls && points.length === 0)) {
                return null;
            }

            const validPoints: Point[] = points;

            const geoData: GeoData = {
                id,
                url: item.url ?? '',
                title: item.title ?? '',
                start_date: item.start_date ?? '',
                end_date: item.end_date ?? '',
                thumb: item.thumb ?? '',
                geom: validPoints,
                geomType
            };

            // Add centroid if possible
            const centroid = calculateGeometryCentroid(validPoints, geomType);
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
