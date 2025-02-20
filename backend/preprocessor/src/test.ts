async function testBinaryLoading(binaryPath: string) {
   console.log("Testing binary loading...");
   const mmap = Bun.mmap(binaryPath);
   const buffer = mmap.buffer;
   
   // Read metadata
   const dataView = new DataView(buffer);
   const metadataSize = dataView.getUint32(0, false);
   console.log("Metadata size:", metadataSize);
   
   const metadataBytesRead = new Uint8Array(buffer, 4, metadataSize);
   const metadata = decode(metadataBytesRead) as BinaryMetadata;
   
   // Print some metadata info
   console.log("\nMetadata Overview:");
   console.log("Time range:", metadata.timeRange.start, "to", metadata.timeRange.end);
   console.log("Number of time periods:", Object.keys(metadata.timeSliceIndex).length);
   
   // Test reading from first time slice
   const firstPeriod = Object.keys(metadata.timeSliceIndex)[0];
   const firstSlice = metadata.timeSliceIndex[firstPeriod];
   console.log("\nReading first time slice:", firstPeriod);
   
   // Get first cell
   const firstCellId = Object.keys(firstSlice.cells)[0];
   const cellData = firstSlice.cells[firstCellId];
   console.log("\nReading cell:", firstCellId);

   // Try reading each content class
   for (const contentClass of ['Image', 'Event'] as ContentClass[]) {
       const contentOffset = cellData.contentOffsets[contentClass];
       if (contentOffset.length > 0) {
           console.log(`\n${contentClass} features:`);
           console.log(`Offset: ${contentOffset.offset}, Length: ${contentOffset.length}`);
           
           const featureBytes = new Uint8Array(
               buffer, 
               4 + metadataSize + contentOffset.offset, 
               contentOffset.length
           );
           const features = decode(featureBytes) as GeoFeatures[];
           
           console.log(`Found ${features.length} ${contentClass} features`);
           if (features.length > 0) {
               console.log("First feature title:", features[0].properties.title);
               console.log("First feature date:", features[0].properties.start_date);
           }
       }
   }

   // Check heatmap data
   const heatmap = metadata.heatmaps[firstPeriod];
   if (heatmap) {
       console.log("\nHeatmap data for first period:");
       console.log("Total cells:", heatmap.cells.length);
       
       const firstHeatmapCell = heatmap.cells[0];
       console.log("\nFirst cell densities:");
       console.log("Image density:", firstHeatmapCell.densities.Image.toFixed(3));
       console.log("Event density:", firstHeatmapCell.densities.Event.toFixed(3));
       console.log("Total density:", firstHeatmapCell.densities.total.toFixed(3));
   }
}
