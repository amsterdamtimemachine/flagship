import os
import json
import geopandas as gpd
from shapely.geometry import box, Point, shape, mapping
import numpy as np
import pandas as pd
from tqdm import tqdm

def load_water_data():
    """Load water features and convert to GeoDataFrame"""
    print("Loading water features...")
    
    # Load raw water data
    with open("amsterdam_data/water_features.json", "r") as f:
        water_data = json.load(f)
    
    # Extract node coordinates
    nodes = {}
    for element in water_data["elements"]:
        if element["type"] == "node":
            nodes[element["id"]] = (element["lon"], element["lat"])
    
    # Process ways into geometries
    features = []
    for element in water_data["elements"]:
        if element["type"] == "way" and "nodes" in element:
            try:
                # Get coordinates for each node in the way
                coords = [nodes[node_id] for node_id in element["nodes"]]
                
                # Only create polygons with at least 3 points
                if len(coords) >= 3:
                    # Close the polygon if not already closed
                    if coords[0] != coords[-1]:
                        coords.append(coords[0])
                    
                    features.append({
                        "type": "Feature",
                        "geometry": {
                            "type": "Polygon",
                            "coordinates": [coords]
                        },
                        "properties": element.get("tags", {})
                    })
            except KeyError:
                # Skip if a node is missing
                continue
    
    # Create GeoDataFrame
    water_gdf = gpd.GeoDataFrame.from_features({
        "type": "FeatureCollection",
        "features": features
    })
    
    print(f"Processed {len(water_gdf)} water features")
    return water_gdf

def dissolve_cells(grid_gdf):
    """Dissolve cells of the same type into larger polygons"""
    print("Dissolving cells into larger polygons...")
    
    # Make a copy to avoid modifying the original
    dissolve_gdf = grid_gdf.copy()
    
    # Ensure geometries are valid before dissolving
    dissolve_gdf["geometry"] = dissolve_gdf.geometry.buffer(0)
    
    # Dissolve based on the 'type' field
    dissolved = dissolve_gdf.dissolve(by='type', aggfunc='count')
    
    # Reset index to make 'type' a regular column again
    dissolved = dissolved.reset_index()
    
    # Simplify geometries slightly to reduce complexity
    # The tolerance value controls how much simplification occurs
    # (in coordinate units, which are degrees in this case)
    #dissolved["geometry"] = dissolved.geometry.simplify(0.0001)
    
    print(f"Dissolved into {len(dissolved)} polygons")
    
    return dissolved

def create_grid(boundary_gdf, cell_size=25):
    """Create a grid of cells covering Amsterdam"""
    print(f"Creating grid with {cell_size}m cells...")
    
    # Get the bounds of Amsterdam
    minx, miny, maxx, maxy = boundary_gdf.total_bounds
    
    # Calculate grid dimensions
    # Convert cell_size from meters to approximate degrees
    # At Amsterdam's latitude (~ 52.3°), 1° latitude ≈ 111km, 1° longitude ≈ 67km
    lat_factor = 111000  # meters per degree latitude (approximately)
    lng_factor = 111000 * np.cos(np.radians(52.3))  # meters per degree longitude at Amsterdam's latitude
    
    cell_size_lat = cell_size / lat_factor  # cell size in degrees latitude
    cell_size_lng = cell_size / lng_factor  # cell size in degrees longitude
    
    # Generate grid cells
    grid_cells = []
    
    # Use tqdm for a progress bar
    x_range = np.arange(minx, maxx, cell_size_lng)
    y_range = np.arange(miny, maxy, cell_size_lat)
    
    print(f"Creating approximately {len(x_range) * len(y_range)} cells...")
    
    for x in tqdm(x_range):
        for y in y_range:
            # Create a box for the cell
            cell = box(x, y, x + cell_size_lng, y + cell_size_lat)
            
            # Check if cell intersects with Amsterdam boundary
            if any(boundary_gdf.intersects(cell)):
                # Create a unique ID for the cell
                cell_id = f"x{x:.6f}_y{y:.6f}"
                
                grid_cells.append({
                    "geometry": cell,
                    "id": cell_id,
                    "x_idx": int((x - minx) / cell_size_lng),
                    "y_idx": int((y - miny) / cell_size_lat)
                })
    
    # Create a GeoDataFrame from the grid cells
    grid_gdf = gpd.GeoDataFrame(grid_cells, crs=boundary_gdf.crs)
    
    print(f"Created {len(grid_gdf)} cells")
    return grid_gdf

def classify_cells(grid_gdf, water_gdf, threshold=0.3):
    """Classify each cell as land or water based on intersection"""
    print("Classifying cells as land or waterclassify_cells_optimized...")
    
    # Initialize the classification column
    grid_gdf["type"] = "land"
    
    # Make sure geometries are valid
    water_gdf = water_gdf.copy()
    water_gdf["geometry"] = water_gdf.geometry.buffer(0)  # This fixes most topology issues
    
    # For each cell, check overlap with water features
    for idx, cell in tqdm(grid_gdf.iterrows(), total=len(grid_gdf)):
        try:
            cell_geom = cell.geometry
            
            # Find water features that intersect with this cell
            intersecting_water = water_gdf[water_gdf.intersects(cell_geom)]
            
            if len(intersecting_water) > 0:
                # Calculate the area of intersection with all water features
                total_water_area = 0
                
                for _, water in intersecting_water.iterrows():
                    try:
                        # Use buffer(0) to fix potential topology issues
                        intersection = water.geometry.buffer(0).intersection(cell_geom.buffer(0))
                        total_water_area += intersection.area
                    except Exception as e:
                        # Skip this water feature if there's an error
                        continue
                
                cell_area = cell_geom.area
                
                # If water covers more than the threshold of the cell, classify as water
                if total_water_area / cell_area > threshold:
                    grid_gdf.at[idx, "type"] = "water"
        except Exception as e:
            # If anything goes wrong with a cell, default to land
            print(f"Error processing cell {idx}: {e}")
            continue
    
    # Count of land and water cells
    land_count = sum(grid_gdf["type"] == "land")
    water_count = sum(grid_gdf["type"] == "water")
    
    print(f"Classification complete: {land_count} land cells, {water_count} water cells")
    return grid_gdf

import multiprocessing
from functools import partial
from rtree import index
import numpy as np

def classify_cells_optimized(grid_gdf, water_gdf, threshold=0.3, n_processes=None):
    """Classify cells as land or water in parallel with spatial indexing"""
    print("Classifying cells as land or water (optimized)...")
    
    # Simplify water geometries for faster processing
    water_gdf = water_gdf.copy()
    water_gdf["geometry"] = water_gdf.geometry.buffer(0).simplify(0.0001)
    
    # Create spatial index for water features
    print("Building spatial index...")
    idx = index.Index()
    for i, geom in enumerate(water_gdf.geometry):
        idx.insert(i, geom.bounds)
    
    # Initialize cell types as all land
    grid_gdf["type"] = "land"
    
    # Split cells into batches for parallel processing
    if n_processes is None:
        n_processes = max(1, multiprocessing.cpu_count() - 1)
    
    cell_indices = list(range(len(grid_gdf)))
    batch_size = len(cell_indices) // n_processes + 1
    batches = [cell_indices[i:i+batch_size] for i in range(0, len(cell_indices), batch_size)]
    
    print(f"Processing {len(grid_gdf)} cells in {len(batches)} batches using {n_processes} processes...")
    
    # Function to process a batch of cells
    def process_batch(batch_indices, grid_geometries, water_geometries):
        results = {}
        for i in batch_indices:
            cell_geom = grid_geometries[i]
            
            # Use spatial index to find candidate water features
            candidates = list(idx.intersection(cell_geom.bounds))
            if not candidates:
                results[i] = "land"
                continue
                
            # Check actual intersection with candidates
            total_water_area = 0
            cell_area = cell_geom.area
            
            for j in candidates:
                try:
                    water_geom = water_geometries[j]
                    if cell_geom.intersects(water_geom):
                        intersection = cell_geom.intersection(water_geom)
                        total_water_area += intersection.area
                except Exception:
                    continue
            
            # Classify based on water coverage
            if total_water_area / cell_area > threshold:
                results[i] = "water"
            else:
                results[i] = "land"
                
        return results
    
    # Prepare data for parallel processing
    grid_geometries = grid_gdf.geometry.tolist()
    water_geometries = water_gdf.geometry.tolist()
    
    # Process in parallel
    with multiprocessing.Pool(processes=n_processes) as pool:
        func = partial(process_batch, grid_geometries=grid_geometries, water_geometries=water_geometries)
        all_results = pool.map(func, batches)
    
    # Combine results
    combined_results = {}
    for result in all_results:
        combined_results.update(result)
    
    # Update the DataFrame
    for idx, cell_type in combined_results.items():
        grid_gdf.at[idx, "type"] = cell_type
    
    # Count of land and water cells
    land_count = sum(grid_gdf["type"] == "land")
    water_count = sum(grid_gdf["type"] == "water")
    
    print(f"Classification complete: {land_count} land cells, {water_count} water cells")
    return grid_gdf

def save_grid(grid_gdf, cell_size, dissolved=True):
    """Save the grid or dissolved polygons to a GeoJSON file"""
    print("Saving results to GeoJSON...")
    
    # Choose a filename based on whether this is dissolved or not
    suffix = "dissolved" if dissolved else "grid"
    output_file = f"amsterdam_data/amsterdam_{suffix}_{cell_size}m.geojson"
    
    # Make sure the output directory exists
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    
    # Save to GeoJSON
    grid_gdf.to_file(output_file, driver="GeoJSON")
    
    print(f"Data saved to {output_file}")
    return output_file

def main():
    """Process the data to create a land/water cellular grid"""
    print("Starting grid creation process...")
    
    # Define cell size in meters
    cell_size = 3
    
    # Load Amsterdam boundary
    boundary_gdf = gpd.read_file("amsterdam_data/boundary.geojson")
    
    # Load and process water data
    water_gdf = load_water_data()
    
    # Create grid covering Amsterdam
    grid_gdf = create_grid(boundary_gdf, cell_size)
    
    # Classify cells as land or water
    classified_grid = classify_cells_optimized(grid_gdf, water_gdf, 0.3)

# Dissolve cells into larger polygons
    dissolved_grid = dissolve_cells(classified_grid)

# Save the dissolved result instead of the original grid
    output_file = save_grid(dissolved_grid, cell_size)
    
    
    print("Grid creation complete!")

if __name__ == "__main__":
    main()
