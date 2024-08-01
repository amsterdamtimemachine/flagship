import type { ImageData, GeoImage } from '$types/image';
import { transformToGeoImages } from '$utils/image';

declare const self: Worker;

self.onmessage = (event: MessageEvent<ImageData>) => {
  const result: GeoImage[] = transformToGeoImages(event.data);
  self.postMessage(result);
};

export {};
