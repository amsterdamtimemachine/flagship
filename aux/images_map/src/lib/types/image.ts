import type { Point } from '$types/geometry';

export type GeoWKT = {
  "@type": "geo:wktLiteral";
  "@value": string;
};

export type GeoGeometry = {
  "@id": string;
  "@type": "geo:Geometry";
  "geo:asWKT": GeoWKT;
};

export type Place = {
  "@id": string;
  "@type": "schema:Place";
  "geo:hasGeometry": GeoGeometry[];
};

export type ImageObject = {
  "@id": string;
  "@type": "schema:ImageObject";
  thumbnailUrl: string;
};

export type Photograph = {
  "@id": string;
  "@type": "Photograph";
  contentLocation: Place | Place[];
  image: ImageObject | ImageObject[];
  name: string;
};

export type Context = {
  schema: string;
  geo: string;
  Photograph: string;
  name: string;
  image: string;
  thumbnailUrl: {
    "@id": string;
    "@type": string;
  };
  contentLocation: string;
};

export type ImageData = {
  "@context": Context;
  "@graph": Photograph[];
};

export type ImageResponse = {
  images: ImageData;
};

export type GeoImage = {
  url: string;
  location: Point | null;
};
