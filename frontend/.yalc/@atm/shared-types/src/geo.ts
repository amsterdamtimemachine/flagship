type ContentType = 'image' | 'text' | 'audio' | 'video';
export type ContentClass = 'Image' | 'Event';

export interface BaseProperties {
	title: string;
	start_date: string;
	end_date?: string;
	source?: string;
	ai?: {
		environment?: string;
		tags?: string[];
		attributes?: string[];
	};
}

interface EventProperties extends BaseProperties {
	street_name: string;
	city_name: string;
	info: string;
	venue_type: string;
}

interface ImageProperties extends BaseProperties {
	url: string;
	thumb: string;
}

type Coordinates = [number, number];

export interface Point2D {
	x: number;
	y: number;
}

export interface PointGeometry {
	type: 'Point';
	coordinates: Coordinates;
}

export interface MultiLineStringGeometry {
	type: 'MultiLineString';
	coordinates: Coordinates[][];
	centroid: Point2D;
}

export interface LineStringGeometry {
	type: 'LineString';
	coordinates: Coordinates[];
	centroid: Point2D;
}

export interface PolygonGeometry {
	type: 'Polygon';
	coordinates: Coordinates[];
	centroid: Point2D;
}

export type Geometry =
	| PointGeometry
	| MultiLineStringGeometry
	| LineStringGeometry
	| PolygonGeometry;

export type GeoFeature<C extends ContentClass> = {
	type: 'Feature';
	geometry: Geometry;
} & (C extends 'Event'
	? {
			content_type: Extract<ContentType, 'text'>;
			content_class: 'Event';
			properties: EventProperties;
		}
	: C extends 'Image'
		? {
				content_type: Extract<ContentType, 'image'>;
				content_class: 'Image';
				properties: ImageProperties;
			}
		: never);

export type GeoFeatures = GeoFeature<ContentClass>;
