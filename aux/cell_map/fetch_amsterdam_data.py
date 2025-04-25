import os
import requests
import json
import geopandas as gpd
from shapely.geometry import shape
import osmnx as ox

def fetch_amsterdam_boundary():
    """Fetch the administrative boundary of Amsterdam"""
    print("Fetching Amsterdam boundary...")
    
    # Use OSMnx to get the city boundary
    amsterdam = ox.geocode_to_gdf("Amsterdam, Netherlands")
    
    print(f"Amsterdam boundary fetched: {amsterdam.shape}")
    return amsterdam

def fetch_water_features():
    """Fetch water features for Amsterdam using Overpass API"""
    print("Fetching water features...")
    
    # Overpass API query for water features in Amsterdam
    overpass_query = """
    [out:json];
    area["name"="Amsterdam"]["admin_level"="8"]->.amsterdam;
    (
      way["natural"="water"](area.amsterdam);
      relation["natural"="water"](area.amsterdam);
      way["waterway"](area.amsterdam);
    );
    out body;
    >;
    out skel qt;
    """
    
    # Execute the query
    response = requests.post('https://overpass-api.de/api/interpreter', 
                            data=overpass_query)
    data = response.json()
    
    print(f"Water features fetched: {len(data['elements'])} elements")
    return data

def fetch_park_features():
    """Fetch park features for Amsterdam using Overpass API"""
    print("Fetching park features...")
    
    # Overpass API query for parks in Amsterdam
    overpass_query = """
    [out:json];
    area["name"="Amsterdam"]["admin_level"="8"]->.amsterdam;
    (
      way["leisure"="park"](area.amsterdam);
      relation["leisure"="park"](area.amsterdam);
      way["landuse"="recreation_ground"](area.amsterdam);
      way["landuse"="forest"](area.amsterdam);
    );
    out body;
    >;
    out skel qt;
    """
    
    # Execute the query
    response = requests.post('https://overpass-api.de/api/interpreter', 
                            data=overpass_query)
    data = response.json()
    
    print(f"Park features fetched: {len(data['elements'])} elements")
    return data

def fetch_building_features():
    """Fetch building outlines for Amsterdam"""
    print("Fetching building features...")
    
    # Overpass API query for buildings in Amsterdam
    # Note: This may be a large dataset, so we might need to limit it
    overpass_query = """
    [out:json];
    area["name"="Amsterdam"]["admin_level"="8"]->.amsterdam;
    (
      way["building"](area.amsterdam);
    );
    out body;
    >;
    out skel qt;
    """
    
    # Execute the query
    response = requests.post('https://overpass-api.de/api/interpreter', 
                            data=overpass_query)
    data = response.json()
    
    print(f"Building features fetched: {len(data['elements'])} elements")
    return data

def save_data(data, filename):
    """Save fetched data to disk"""
    data_dir = "amsterdam_data"
    
    # Create directory if it doesn't exist
    if not os.path.exists(data_dir):
        os.makedirs(data_dir)
    
    # Save the raw JSON data
    filepath = os.path.join(data_dir, filename)
    with open(filepath, 'w') as f:
        json.dump(data, f)
    
    print(f"Data saved to {filepath}")

def main():
    """Main function to fetch and save all needed data"""
    print("Starting data fetching process for Amsterdam cellular map...")

    data_dir = "amsterdam_data"
    if not os.path.exists(data_dir):
        os.makedirs(data_dir)
    
    # Fetch the city boundary
    amsterdam_boundary = fetch_amsterdam_boundary()
    amsterdam_boundary.to_file("amsterdam_data/boundary.geojson", driver="GeoJSON")
    
    # Fetch and save water features
    water_data = fetch_water_features()
    save_data(water_data, "water_features.json")
    
    # Fetch and save park features
    park_data = fetch_park_features()
    save_data(park_data, "park_features.json")
    
    # Fetch and save building features
    building_data = fetch_building_features()
    save_data(building_data, "building_features.json")
    
    print("All data fetching complete!")

if __name__ == "__main__":
    main()
