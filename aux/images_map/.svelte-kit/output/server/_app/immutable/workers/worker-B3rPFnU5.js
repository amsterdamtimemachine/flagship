(function() {
  "use strict";
  function transformToGeoImages(data) {
    return data["@graph"].flatMap((photo) => {
      const images = Array.isArray(photo.image) ? photo.image : [photo.image];
      const locations = Array.isArray(photo.contentLocation) ? photo.contentLocation : [photo.contentLocation];
      return images.map((img, index) => {
        let location = null;
        const place = locations[index];
        if (place && place["geo:hasGeometry"]?.[0]) {
          const wkt = place["geo:hasGeometry"][0]["geo:asWKT"]["@value"];
          const match = wkt.match(/POINT\((-?\d+\.?\d*)\s+(-?\d+\.?\d*)\)/);
          if (match) {
            location = { x: Number(match[1]), y: Number(match[2]) };
          }
        }
        return {
          url: img.thumbnailUrl,
          location
        };
      });
    });
  }
  self.onmessage = (event) => {
    const result = transformToGeoImages(event.data);
    self.postMessage(result);
  };
})();
