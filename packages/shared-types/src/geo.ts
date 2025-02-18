type ContentType = 'image' | 'text' | 'audio' | 'video';
type ContentClass = 'Photograph' |'Event';

export interface BaseProperties {
    title: string;
    start_date: string;
    end_date?: string;
    source?: string;
    ai? : {
      env?: string;
      tags?: string[];
      attributes?: string[];
    }
}

interface EventProperties extends BaseProperties {
    street_name: string;
    city_name: string;
    info: string;
    venue_type: string;
}

interface PhotographProperties extends BaseProperties {
    image_url: string;
    photographer?: string;
    camera_type?: string;
}

type Coordinates = [number, number];

interface Point2D {
    x: number;
    y: number;
}

interface PointGeometry {
    type: "Point";
    coordinates: Coordinates;
}

interface MultiLineStringGeometry {
    type: "MultiLineString";
    coordinates: Coordinates[][];
    centroid: Point2D;
}

interface LineStringGeometry {
    type: "LineString";
    coordinates: Coordinates[];
    centroid: Point2D;
}

interface PolygonGeometry {
    type: "Polygon";
    coordinates: Coordinates[];
    centroid: Point2D;
}

type Geometry = PointGeometry | MultiLineStringGeometry | LineStringGeometry | PolygonGeometry;

export type GeoFeature<C extends ContentClass> = {
    type: "Feature";
    geometry: Geometry;
} & (
    C extends 'Event' ? {
        content_type: Extract<ContentType, 'text'>;  
        content_class: 'Event';
        properties: EventProperties;
    } :
    C extends 'Photograph' ? {
        content_type: Extract<ContentType, 'image'>; 
        content_class: 'Photograph';
        properties: PhotographProperties;
    } : 
    never
);

export type GeoFeatures = GeoFeature<ContentClass>;
