import type { Point } from '$types/geometry';
import type { Photograph, GeoImage } from '$types/image';

export function transformToGeoImages(data: Photograph[]): GeoImage[] {
  return data.map((photo, index) => {
    // assumes that images of each photo are duplicates of the 0th image
    const image = Array.isArray(photo.image) ? photo.image[0] : photo.image;
    const location = Array.isArray(photo.contentLocation) ? photo.contentLocation[0] : photo.contentLocation;
    
    let point: Point | null = null;
    if (location && location['geo:hasGeometry']) {
      const geometry = Array.isArray(location['geo:hasGeometry']) 
        ? location['geo:hasGeometry'][0] 
        : location['geo:hasGeometry'];
      
      if (geometry['geo:asWKT']) {
        const wkt = geometry['geo:asWKT']['@value'];
        const match = wkt.match(/POINT\((-?\d+\.?\d*)\s+(-?\d+\.?\d*)\)/);
      
        if (match) {
          point = { x: Number(match[1]), y: Number(match[2]) };
        }
      }
    }
    console.log(index, point);
    return {
      url: image.thumbnailUrl,
      location: point
    };
  });
}
