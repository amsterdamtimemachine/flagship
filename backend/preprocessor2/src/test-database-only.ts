// src/test-database-only.ts - Simple test for your API

import {
  fetchBatch,
  createDatabaseDataSource,
  analyzeFeatures
} from './data-sources';
import { AMSTERDAM_DATABASE_CONFIG } from './config/defaults';
import type { ApiQueryParams } from './data-sources/types';

async function testDatabaseFetching() {
  console.log('🏛️  Amsterdam Time Machine - Database Fetching Test');
  console.log('===================================================\n');
  
  try {
    // TEST 1: Direct API call with your actual endpoint
    console.log('📡 Test 1: Direct API call');
    
    const testParams: ApiQueryParams = {
      min_lat: 52.35,
      min_lon: 4.85,
      max_lat: 52.37,
      max_lon: 4.9,
      start_year: '1900-01-01',
      end_year: '1950-01-01',
      limit: 10,
      offset: 0
    };
    
    console.log('Parameters:', testParams);
    
    const response = await fetchBatch(AMSTERDAM_DATABASE_CONFIG.baseUrl, testParams);
    
    console.log('✅ API Response received:');
    console.log(`   Features: ${response.data.length}`);
    console.log(`   Total available: ${response.total}`);
    
    // TEST 2: Analyze the response structure
    if (response.data && response.data.length > 0) {
      console.log('\n📄 Sample features:');
      
      response.data.slice(0, 3).forEach((feature, index) => {
        console.log(`\n   Feature ${index + 1}:`);
        console.log(`     Dataset: ${feature.ds}`);
        console.log(`     Title: ${feature.tit.substring(0, 60)}...`);
        console.log(`     Period: ${feature.per[0]} - ${feature.per[1]}`);
        console.log(`     Geometry: ${feature.geom}`);
        console.log(`     RecordType: ${feature.recordtype || 'not set'}`);
        console.log(`     Tags: ${feature.tags?.join(', ') || 'none'}`);
        console.log(`     URL: ${feature.url.substring(0, 60)}...`);
      });
    }
    
    // TEST 3: Test the DataSource interface
    console.log('\n🔄 Test 3: DataSource interface');
    
    const dataSource = createDatabaseDataSource({
      ...AMSTERDAM_DATABASE_CONFIG,
      batchSize: 20 // Small batch for testing
    });
    
    console.log('Fetching small sample via DataSource...');
    const features = await dataSource.loadFeatures();
    
    console.log(`✅ DataSource fetched: ${features.length} processed features`);
    
    // TEST 4: Feature analysis
    if (features.length > 0) {
      console.log('\n📊 Test 4: Feature Analysis');
      
      const analysis = analyzeFeatures(features);
      
      console.log('\n📈 Dataset Analysis:');
      console.log(`   Total features: ${analysis.totalFeatures}`);
      console.log(`   Time range: ${analysis.timeRange.earliest} - ${analysis.timeRange.latest}`);
      console.log('\n   Datasets:');
      Object.entries(analysis.datasets).forEach(([dataset, count]) => {
        console.log(`     ${dataset}: ${count} features`);
      });
      
      if (Object.keys(analysis.recordTypes).length > 0) {
        console.log('\n   Record Types:');
        Object.entries(analysis.recordTypes).forEach(([type, count]) => {
          console.log(`     ${type}: ${count} features`);
        });
      } else {
        console.log('\n   ⚠️  No recordtype field found in features');
      }
      
      console.log('\n🏷️  Tag Analysis:');
      console.log(`   Total tags: ${analysis.tagStats.totalTags}`);
      console.log(`   Unique tags: ${analysis.tagStats.uniqueTags}`);
      
      if (analysis.tagStats.topTags.length > 0) {
        console.log('   Top tags:');
        analysis.tagStats.topTags.slice(0, 5).forEach(({ tag, count }) => {
          console.log(`     ${tag}: ${count} times`);
        });
      } else {
        console.log('   ⚠️  No tags found in features');
      }
      
      // TEST 5: Geometry parsing
      console.log('\n🗺️  Test 5: Geometry Parsing');
      
      const sampleFeature = features[0];
      console.log(`   Original WKT: ${response.data[0].geom}`);
      console.log(`   Parsed coordinates: [${sampleFeature.geometry.coordinates.join(', ')}]`);
      console.log(`   Point object: x=${sampleFeature.point.x}, y=${sampleFeature.point.y}`);
    }
    
    console.log('\n🎉 All database tests passed!');
    
    return {
      apiWorking: true,
      featuresFound: features.length,
      datasetsFound: Object.keys(analyzeFeatures(features).datasets),
      recordTypesFound: Object.keys(analyzeFeatures(features).recordTypes),
      tagsFound: analyzeFeatures(features).tagStats.uniqueTags
    };
    
  } catch (error) {
    console.error('\n❌ Database test failed:', error);
    
    // Provide specific debugging help
    if (error instanceof Error) {
      if (error.message.includes('fetch')) {
        console.log('💡 Check if the API endpoint is accessible');
        console.log('💡 Try the URL manually in your browser');
      } else if (error.message.includes('JSON')) {
        console.log('💡 The API might be returning a different format than expected');
      } else if (error.message.includes('WKT')) {
        console.log('💡 Issue parsing the geometry field');
      }
    }
    
    throw error;
  }
}

// Run the test
if (import.meta.main) {
  testDatabaseFetching()
    .then(result => {
      console.log('\n📋 Test Summary:');
      console.log(`   API Working: ${result.apiWorking ? '✅' : '❌'}`);
      console.log(`   Features Found: ${result.featuresFound}`);
      console.log(`   Datasets: ${result.datasetsFound.join(', ')}`);
      console.log(`   Record Types: ${result.recordTypesFound.join(', ') || 'none'}`);
      console.log(`   Unique Tags: ${result.tagsFound}`);
    })
    .catch(error => {
      console.error('💥 Test failed:', error.message);
      process.exit(1);
    });
}

/*
Usage:
  bun run src/test-database-only.ts

Expected output if successful:
🏛️  Amsterdam Time Machine - Database Fetching Test
===================================================

📡 Test 1: Direct API call
📡 Fetching: https://atmbackend.create.humanities.uva.nl/api/geodata?min_lat=52.35&...
✅ API Response received:
   Features: 10
   Total available: 1247

📄 Sample features:
   Feature 1:
     Dataset: beeldbank
     Title: Groepsfoto in de grote feestzaal met marmeren zuilen van het...
     Period: 1930 - 1931
     Geometry: POINT(4.88134747873096 52.3638068249909)
     RecordType: not set
     Tags: none
     URL: https://ams-migrate.memorix.io/resources/records/00132eec...

🎉 All database tests passed!
*/
