export interface Point2D {
    x: number;
    y: number;
}

type DataType = 'image' | 'text' | 'audio' | 'video';

type FeatureClass = 
  | 'Photograph' 
  | 'Painting' 
  | 'FilmScreening'
  | 'PersonPublicRecord'
  | 'AudioRecording';

type AITags = Record<string, string | number | boolean>;

interface BaseProperties {
    data_type: DataType;
    title: string;
    feature_class: FeatureClass;
    start_date: string;
    end_date?: string;
    source?: string;
    aiTags?: AITags;
}

// Specific feature class interfaces
interface FilmScreeningProperties extends BaseProperties {
    data_type: 'text';
    feature_class: 'FilmScreening';
    street_name: string;
    city_name: string;
    info: string;
    venue_type: string;
}

type FeatureProperties = FilmScreeningProperties;

interface BaseFeature {
  type: "Feature";
  properties: FeatureProperties;
}

export interface PointFeature extends BaseFeature {
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
}

export interface MultiLineStringFeature extends BaseFeature {
  geometry: {
    type: "MultiLineString";
    coordinates: [number, number][][];
    centroid: Point2D;
  };
}

export interface LineStringFeature extends BaseFeature {
  geometry: {
    type: "LineString";
    coordinates: [number, number][];
    centroid: Point2D;
  };
}

export interface PolygonFeature extends BaseFeature {
  geometry: {
    type: "Polygon";
    coordinates: [number, number, number][][];
    centroid: Point2D;
  };
}

export type GeoFeature = PointFeature | MultiLineStringFeature | LineStringFeature | PolygonFeature;
