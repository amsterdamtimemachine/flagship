export type Coordinates = {lon: number, lat: number};

export interface PointGeometry {
    type: "Point";
    coordinates: Coordinates;
}

export interface MultiLineStringGeometry {
    type: "MultiLineString";
    coordinates: Coordinates[][];
    centroid: Coordinates;
}

export interface LineStringGeometry {
    type: "LineString";
    coordinates: Coordinates[];
    centroid: Coordinates;
}

export interface PolygonGeometry {
    type: "Polygon";
    coordinates: Coordinates[][];
    centroid: Coordinates;
}

export type Geometry = PointGeometry | MultiLineStringGeometry | LineStringGeometry | PolygonGeometry;


