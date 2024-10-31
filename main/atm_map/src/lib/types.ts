export type Point = {
	x: number;
	y: number;
};

export interface LatLong {
	x: number;
	y: number;
}

export interface CenterPoint {
    lng: number;
    lat: number;
}

export interface GridOptions {
    centerPoint: CenterPoint;
    cellSize: number;
    numCells: number;
}

export interface CellData {
    [key: string]: number;
}


export type GeoWKT = {
	'@type': 'geo:wktLiteral';
	'@value': string;
};

export type GeoGeometry = {
	'@id': string;
	'@type': 'geo:Geometry';
	'geo:asWKT': GeoWKT;
};

export type Place = {
	'@id': string;
	'@type': 'schema:Place';
	'geo:hasGeometry': GeoGeometry[];
};

export type ImageObject = {
	'@id': string;
	'@type': 'schema:ImageObject';
	thumbnailUrl: string;
};

export type Photograph = {
	'@id': string;
	'@type': 'Photograph';
	contentLocation: Place | Place[];
	image: ImageObject | ImageObject[];
	name: string;
};

export type GeoImage = {
	url: string;
	location: Point | null;
};

export type ImageContext = {
	schema: string;
	geo: string;
	Photograph: string;
	name: string;
	image: string;
	thumbnailUrl: {
		'@id': string;
		'@type': string;
	};
	contentLocation: string;
};

export type ImageResponse = {
	'@context': ImageContext;
	'@graph': Photograph[];
};
