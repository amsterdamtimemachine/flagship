export interface Point2D {
	x: number;
	y: number;
}

interface BaseFeature {
	type: 'Feature';
	properties: {
		url: string;
		title: string;
		start_date: string;
		end_date: string;
		thumb: string;
	};
}

export interface PointFeature extends BaseFeature {
	geometry: {
		type: 'Point';
		coordinates: [number, number];
	};
}

export interface MultiLineStringFeature extends BaseFeature {
	geometry: {
		type: 'MultiLineString';
		coordinates: [number, number][][];
		centroid: Point2D;
	};
}

export interface LineStringFeature extends BaseFeature {
	geometry: {
		type: 'LineString';
		coordinates: [number, number][];
		centroid: Point2D;
	};
}

export interface PolygonFeature extends BaseFeature {
	geometry: {
		type: 'Polygon';
		coordinates: [number, number, number][][];
		centroid: Point2D;
	};
}

export type GeoFeature = PointFeature | MultiLineStringFeature | LineStringFeature | PolygonFeature;
