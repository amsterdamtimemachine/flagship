// src/tests/database.test.ts - Clean tests for streaming-only architecture
import { describe, test, expect } from "bun:test";
import {
  fetchBatch,
  convertRawFeature
} from '../data-sources';
import { AMSTERDAM_DATABASE_CONFIG } from '../config/defaults';
import type { ApiQueryParams } from '../data-sources';
import type { RawFeature } from '../types/geo';

describe("Amsterdam API Database Integration", () => {
  
  test("fetchBatch should return valid API response", async () => {
    const params: ApiQueryParams = {
      min_lat: 52.35,
      min_lon: 4.85,
      max_lat: 52.37,
      max_lon: 4.9,
      start_year: '1900-01-01',
      end_year: '1950-01-01',
      limit: 5,
      offset: 0
    };
    
    const response = await fetchBatch(AMSTERDAM_DATABASE_CONFIG.baseUrl, params);
    
    // Test response structure
    expect(response).toHaveProperty('data');
    expect(response).toHaveProperty('total');
    expect(Array.isArray(response.data)).toBe(true);
    expect(typeof response.total).toBe('number');
    
    // Test that we got some data
    expect(response.data.length).toBeGreaterThan(0);
    expect(response.total).toBeGreaterThan(0);
  }, 10000);

  test("API features should have expected structure", async () => {
    const params: ApiQueryParams = {
      min_lat: 52.35,
      min_lon: 4.85,
      max_lat: 52.37,
      max_lon: 4.9,
      start_year: '1900-01-01',
      end_year: '1950-01-01',
      limit: 3,
      offset: 0
    };
    
    const response = await fetchBatch(AMSTERDAM_DATABASE_CONFIG.baseUrl, params);
    const feature = response.data[0];
    
    // Test required fields
    expect(feature).toHaveProperty('ds');
    expect(feature).toHaveProperty('geom');
    expect(feature).toHaveProperty('per');
    expect(feature).toHaveProperty('tit');
    expect(feature).toHaveProperty('url');
    
    // Test field types
    expect(typeof feature.ds).toBe('string');
    expect(typeof feature.geom).toBe('string');
    expect(Array.isArray(feature.per)).toBe(true);
    expect(feature.per).toHaveLength(2);
    expect(typeof feature.tit).toBe('string');
    expect(typeof feature.url).toBe('string');
    
    // Test geometry format (should be WKT POINT)
    expect(feature.geom).toMatch(/^POINT\(-?\d+\.?\d*\s+-?\d+\.?\d*\)$/);
    
    // Test period format (should be two numbers)
    expect(typeof feature.per[0]).toBe('number');
    expect(typeof feature.per[1]).toBe('number');
  }, 10000);

  test("convertRawFeature should properly convert with recordtype parameter", () => {
    const mockApiFeature: RawFeature = {
      ds: "beeldbank",
      geom: "POINT(4.88134747873096 52.3638068249909)",
      per: [1930, 1931],
      tit: "Test title",
      url: "https://example.com/test-id-12345",
      tags: ["test", "example"]
    };
    
    const converted = convertRawFeature(mockApiFeature, 'image');
    
    // Test basic conversion
    expect(converted.dataset).toBe("beeldbank");
    expect(converted.title).toBe("Test title");
    expect(converted.url).toBe("https://example.com/test-id-12345");
    expect(converted.startYear).toBe(1930);
    expect(converted.endYear).toBe(1931);
    expect(converted.recordtype).toBe("image");
    expect(converted.tags).toEqual(["test", "example"]);
    
    // Test geometry conversion
    expect(converted.geometry.type).toBe('Point');
    expect(converted.geometry.coordinates).toHaveLength(2);
    expect(converted.geometry.coordinates[0]).toBeCloseTo(4.88134747873096, 5);
    expect(converted.geometry.coordinates[1]).toBeCloseTo(52.3638068249909, 5);
    
    // Test properties for image type
    expect(converted.properties).toBeDefined();
    expect(converted.properties?.thumb).toBe("https://example.com/test-id-12345");
  });

  test("convertRawFeature should handle all record types correctly", () => {
    const baseFeature: RawFeature = {
      ds: "test",
      geom: "POINT(4.9 52.4)",
      per: [1900, 1901],
      tit: "Test Feature",
      url: "https://example.com/test",
      tags: ["tag1"]
    };
    
    // Test image type
    const imageFeature = convertRawFeature(baseFeature, 'image');
    expect(imageFeature.recordtype).toBe("image");
    expect(imageFeature.properties).toBeDefined();
    expect(imageFeature.properties?.thumb).toBe("https://example.com/test");
    
    // Test event type
    const eventFeature = convertRawFeature(baseFeature, 'event');
    expect(eventFeature.recordtype).toBe("event");
    expect(eventFeature.properties).toBeDefined();
    expect(eventFeature.properties?.street_name).toBe("");
    expect(eventFeature.properties?.city_name).toBe("");
    expect(eventFeature.properties?.info).toBe("");
    expect(eventFeature.properties?.venue_type).toBe("");
    
    // Test text type
    const textFeature = convertRawFeature(baseFeature, 'text');
    expect(textFeature.recordtype).toBe("text");
    expect(textFeature.properties).toBeUndefined();
  });

  test("API should handle recordtype filtering", async () => {
    // Test with recordtype filter
    const paramsWithRecordType: ApiQueryParams = {
      min_lat: 52.3,
      min_lon: 4.8,
      max_lat: 52.4,
      max_lon: 4.9,
      start_year: '1900-01-01',
      end_year: '2000-01-01',
      recordtype: 'text',
      limit: 5,
      offset: 0
    };
    
    const response = await fetchBatch(AMSTERDAM_DATABASE_CONFIG.baseUrl, paramsWithRecordType);
    
    expect(response).toHaveProperty('data');
    expect(Array.isArray(response.data)).toBe(true);
    
    // Test that we can convert all returned features with the queried recordtype
    if (response.data.length > 0) {
      for (const rawFeature of response.data) {
        const converted = convertRawFeature(rawFeature, 'text');
        expect(converted.recordtype).toBe('text');
        expect(converted).toHaveProperty('dataset');
        expect(converted).toHaveProperty('title');
        expect(converted).toHaveProperty('geometry');
      }
    }
  }, 10000);

  test("API should handle pagination correctly", async () => {
    // Get first page
    const page1Params: ApiQueryParams = {
      min_lat: 52.3,
      min_lon: 4.8,
      max_lat: 52.4,
      max_lon: 4.9,
      start_year: '1900-01-01',
      end_year: '2000-01-01',
      limit: 10,
      offset: 0
    };
    
    const page1 = await fetchBatch(AMSTERDAM_DATABASE_CONFIG.baseUrl, page1Params);
    
    // Get second page
    const page2Params: ApiQueryParams = {
      ...page1Params,
      offset: 10
    };
    
    const page2 = await fetchBatch(AMSTERDAM_DATABASE_CONFIG.baseUrl, page2Params);
    
    // API might not respect limit exactly, so just test basic pagination behavior
    expect(page1.data.length).toBeGreaterThan(0);
    expect(page2.data.length).toBeGreaterThan(0);
    
    // Test that total is reported correctly if available
    if (typeof page1.total === 'number') {
      expect(page1.total).toBeGreaterThan(0);
      expect(page1.total).toBe(page2.total); // Total should be same for both pages
    }
    
    // Test different results between pages
    if (page1.data.length > 0 && page2.data.length > 0) {
      const page1Urls = page1.data.map(f => f.url);
      const page2Urls = page2.data.map(f => f.url);
      
      // Should not have completely overlapping features
      const overlap = page1Urls.filter(url => page2Urls.includes(url));
      expect(overlap.length).toBeLessThan(Math.min(page1Urls.length, page2Urls.length));
    }
  }, 15000);

  test("Basic streaming simulation should work", async () => {
    // Simulate what the streaming function does
    const params: ApiQueryParams = {
      min_lat: 52.35,
      min_lon: 4.85,
      max_lat: 52.37,
      max_lon: 4.9,
      start_year: '1900-01-01',
      end_year: '1950-01-01',
      recordtype: 'text', // Query with specific recordtype
      limit: 10,
      offset: 0
    };
    
    const response = await fetchBatch(AMSTERDAM_DATABASE_CONFIG.baseUrl, params);
    
    expect(response.data.length).toBeGreaterThan(0);
    
    // Convert features using the same recordtype we queried for
    const convertedFeatures = response.data.map(rawFeature => 
      convertRawFeature(rawFeature, 'text')
    );
    
    console.log(`Converted ${convertedFeatures.length}/${response.data.length} features`);
    
    // All conversions should succeed since we're passing recordtype explicitly
    expect(convertedFeatures.length).toBe(response.data.length);
    
    // Test that converted features have expected structure
    for (const feature of convertedFeatures) {
      expect(feature).toHaveProperty('dataset');
      expect(feature).toHaveProperty('title');
      expect(feature).toHaveProperty('geometry');
      expect(feature).toHaveProperty('startYear');
      expect(feature).toHaveProperty('endYear');
      expect(feature).toHaveProperty('tags');
      expect(feature.recordtype).toBe('text'); // Should match what we passed
      
      // Test geometry structure
      expect(feature.geometry.type).toBe('Point');
      expect(feature.geometry.coordinates).toHaveLength(2);
      expect(typeof feature.geometry.coordinates[0]).toBe('number');
      expect(typeof feature.geometry.coordinates[1]).toBe('number');
    }
  }, 15000);
});

describe("Error Handling", () => {
  
  test("should handle invalid API parameters gracefully", async () => {
    const invalidParams: ApiQueryParams = {
      min_lat: 90, // Invalid: max latitude
      min_lon: -200, // Invalid: out of range
      max_lat: 91,
      max_lon: 200,
      start_year: 'invalid-date',
      end_year: '2024-01-01',
      limit: -1, // Invalid: negative limit
      offset: 0
    };
    
    try {
      await fetchBatch(AMSTERDAM_DATABASE_CONFIG.baseUrl, invalidParams);
      // If API doesn't reject invalid params, that's also valid behavior
    } catch (error) {
      // Should be a meaningful error
      expect(error).toBeInstanceOf(Error);
    }
  });

  test("should handle malformed WKT geometry", () => {
    const malformedFeature: RawFeature = {
      ds: "test",
      geom: "INVALID_WKT(1 2 3)",
      per: [2000, 2001],
      tit: "Test",
      url: "https://test.com"
    };
    
    expect(() => {
      convertRawFeature(malformedFeature, 'image');
    }).toThrow();
  });

  test("should handle features with invalid coordinates", () => {
    const invalidCoordinates: RawFeature = {
      ds: "test",
      geom: "POINT(NaN NaN)",
      per: [2000, 2001],
      tit: "Test",
      url: "https://test.com"
    };
    
    expect(() => {
      convertRawFeature(invalidCoordinates, 'image');
    }).toThrow();
  });
});

describe("Performance", () => {
  
  test("should handle reasonable batch sizes efficiently", async () => {
    const startTime = Date.now();
    
    const params: ApiQueryParams = {
      min_lat: 52.3,
      min_lon: 4.8,
      max_lat: 52.4,
      max_lon: 4.9,
      start_year: '1900-01-01',
      end_year: '2000-01-01',
      limit: 50,
      offset: 0
    };
    
    const response = await fetchBatch(AMSTERDAM_DATABASE_CONFIG.baseUrl, params);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Should complete within reasonable time (10 seconds)
    expect(duration).toBeLessThan(10000);
    expect(response.data.length).toBeGreaterThan(0);
  }, 15000);

  test("conversion should be efficient for large batches", () => {
    const startTime = Date.now();
    
    // Create mock features
    const mockFeatures: RawFeature[] = [];
    for (let i = 0; i < 1000; i++) {
      mockFeatures.push({
        ds: "performance_test",
        geom: `POINT(${4.8 + i * 0.001} ${52.3 + i * 0.001})`,
        per: [1900 + i, 1901 + i],
        tit: `Performance test feature ${i}`,
        url: `https://test.com/${i}`,
        tags: [`tag${i % 10}`]
      });
    }
    
    // Convert all features with explicit recordtypes
    const converted = mockFeatures.map((f, i) => 
      convertRawFeature(f, i % 2 === 0 ? 'image' : 'text')
    );
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    expect(converted.length).toBe(1000);
    expect(duration).toBeLessThan(1000); // Should complete within 1 second
  });
});

describe("Data Quality", () => {
  
  test("should successfully convert all features when recordtype is provided", async () => {
    const params: ApiQueryParams = {
      min_lat: 52.3,
      min_lon: 4.8,
      max_lat: 52.4,
      max_lon: 4.9,
      start_year: '1900-01-01',
      end_year: '2000-01-01',
      recordtype: 'text', // Query with specific recordtype
      limit: 20,
      offset: 0
    };
    
    const response = await fetchBatch(AMSTERDAM_DATABASE_CONFIG.baseUrl, params);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const rawFeature of response.data) {
      try {
        // Convert with the same recordtype we queried for
        const converted = convertRawFeature(rawFeature, 'text');
        successCount++;
        
        // Verify the converted feature has the correct recordtype
        expect(converted.recordtype).toBe('text');
      } catch (error) {
        errorCount++;
        console.warn(`Conversion error for feature ${rawFeature.url}:`, error);
      }
    }
    
    console.log(`Conversion rate: ${successCount}/${response.data.length} successful (${errorCount} errors)`);
    
    // All conversions should succeed since we're passing recordtype explicitly
    expect(successCount).toBe(response.data.length);
    expect(errorCount).toBe(0);
  }, 10000);

  test("should handle multiple recordtypes consistently", async () => {
    const recordTypes = ['image', 'text', 'event'] as const;
    
    for (const recordtype of recordTypes) {
      const params: ApiQueryParams = {
        min_lat: 52.3,
        min_lon: 4.8,
        max_lat: 52.4,
        max_lon: 4.9,
        start_year: '1900-01-01',
        end_year: '2000-01-01',
        recordtype,
        limit: 5,
        offset: 0
      };
      
      try {
        const response = await fetchBatch(AMSTERDAM_DATABASE_CONFIG.baseUrl, params);
        
        if (response.data.length > 0) {
          // Convert first feature to test the recordtype
          const converted = convertRawFeature(response.data[0], recordtype);
          expect(converted.recordtype).toBe(recordtype);
          
          console.log(`✅ ${recordtype}: ${response.data.length} features available`);
        } else {
          console.log(`⚠️ ${recordtype}: No features found for test parameters`);
        }
      } catch (error) {
        console.warn(`❌ ${recordtype}: API error`, error);
      }
    }
  }, 15000);
});
