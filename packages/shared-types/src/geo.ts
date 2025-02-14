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

type ClassTypeMap = {
  'Photograph': 'image';
  'Painting': 'image';
  'FilmScreening': 'text';
  'PersonPublicRecord': 'text';
  'AudioRecording': 'audio';
};

type AITags = Record<string, string | number | boolean>;

// Properties definitions
interface BaseProperties {
  url: string;
  title: string;
  start_date: string;
  end_date: string;
  dataType: DataType;
  featureClass: FeatureClass;
  aiTags?: AITags;
}

interface ImageProperties extends BaseProperties {
  dataType: 'image';
  featureClass: Extract<FeatureClass, keyof ClassTypeMap>;
  thumb: string;
}

interface TextProperties extends BaseProperties {
  dataType: 'text';
  featureClass: Extract<FeatureClass, keyof ClassTypeMap>;
  content: string;
}

interface AudioProperties extends BaseProperties {
  dataType: 'audio';
  featureClass: Extract<FeatureClass, keyof ClassTypeMap>;
  audioUrl: string;
  duration: number;
}

type FeatureProperties = ImageProperties | TextProperties | AudioProperties;

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
