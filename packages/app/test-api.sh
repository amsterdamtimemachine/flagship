#!/bin/bash

# API Test Script for Amsterdam Time Machine
echo "🧪 Testing Amsterdam Time Machine API endpoints..."

BASE_URL="http://localhost:5175"

echo ""
echo "1. Testing Metadata API..."
curl -s "$BASE_URL/api/metadata" | jq '.success, .recordTypes, (.timeSlices | length)'

echo ""
echo "2. Testing Histogram API (text)..."
curl -s "$BASE_URL/api/histogram?recordType=text" | jq '.success, .histogram.totalFeatures'

echo ""
echo "3. Testing Histogram API (image)..."
curl -s "$BASE_URL/api/histogram?recordType=image" | jq '.success, .histogram.totalFeatures'

echo ""
echo "4. Testing Heatmaps API (text)..."
curl -s "$BASE_URL/api/heatmaps?recordType=text" | jq '.success, .resolution'

echo ""
echo "5. Testing Heatmaps API (event)..."
curl -s "$BASE_URL/api/heatmaps?recordType=event" | jq '.success, .resolution'

echo ""
echo "✅ API tests completed!"
