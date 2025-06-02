import { Heatmaps } from "@atm/shared-types";

export function fixDecodedHeatmapsTypedArrays(
  heatmaps: Heatmaps,
  expectedLength: number,
) {
  // MessagePack doesn't know the length of typed arrays when decoding them
  // length needs to be set manually
  for (const period in heatmaps) {
    // Get all content classes dynamically from the data
    const contentClasses = Object.keys(heatmaps[period].contentClasses);

    for (const contentClass of contentClasses) {
      const base = heatmaps[period].contentClasses[contentClass].base;

      // Fix count array
      base.countArray = new Uint32Array(
        base.countArray.slice(0, expectedLength),
      );

      // Fix density array
      base.densityArray = new Float32Array(
        base.densityArray.slice(0, expectedLength),
      );

      // Fix tag arrays
      for (const tag in heatmaps[period].contentClasses[contentClass].tags) {
        const tagData = heatmaps[period].contentClasses[contentClass].tags[tag];
        tagData.countArray = new Uint32Array(
          tagData.countArray.slice(0, expectedLength),
        );
        tagData.densityArray = new Float32Array(
          tagData.densityArray.slice(0, expectedLength),
        );
      }
    }
  }

  return heatmaps;
}
