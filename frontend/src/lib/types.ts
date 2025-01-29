export type Point = {
	x: number;
	y: number;
};

export interface CellData {
	[key: string]: number;
}

export type GeomType = 'polygon' | 'multiline' | 'point' | 'unknown';
export interface GeoData {
	id: string;
	url: string;
	title: string;
	start_date: string;
	end_date: string;
	thumb: string;
	geom: Point[];
	geomType: GeomType;
	centroid?: Point;
}

export interface HeatmapResponse {
	cells: {
		cellId: string;
		count: number;
		bounds: {
			minLon: number;
			maxLon: number;
			minLat: number;
			maxLat: number;
		};
	}[];
	bounds: {
		boundA: [number, number]; // [lon, lat]
		boundB: [number, number]; // [lon, lat]
	};
	dimensions: {
		width: number;
		height: number;
	};
}

export type CellResponse = { cellData: GeoData[] };
