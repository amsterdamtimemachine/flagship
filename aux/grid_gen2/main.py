import xml.etree.ElementTree as ET
from perlin_noise import PerlinNoise
import math

# Constants and Parameters
USE_CLASSIFIED_SCALE = True  # Set to False for continuous scale
NUM_CLASSES = 5  # Number of classes for classified scale

# Grid parameters
WIDTH, HEIGHT = 1280, 720 
CELL_SIZE = 30  # Size of each square cell

# Color parameters
BASE_COLOR = "#0702FF"  # Hex color code
OUTLINE_COLOR = "#D3D3D3"  # Hex color code

# Noise and size parameters
NOISE_SCALE = 5  # Controls the scale of the Perlin noise
MIN_SIZE = 0.1  # Minimum size of inner square (as a fraction of cell size)
MAX_SIZE = 1.0  # Maximum size of inner square (as a fraction of cell size)
PADDING = 2  # Padding around inner squares (in pixels)

# Visualization options
DRAW_OUTLINE = True  # Set to False to remove all cell outlines

def create_grid_map_svg(width, height, cell_size, base_color, outline_color, noise_scale, min_size, max_size, padding, draw_outline):
    # Calculate the number of rows and columns based on cell size
    cols = width // cell_size
    rows = height // cell_size
    # Adjust width and height to fit perfect squares
    adjusted_width = cols * cell_size
    adjusted_height = rows * cell_size

    # Create the root SVG element
    svg = ET.Element('svg', {
        'width': str(adjusted_width),
        'height': str(adjusted_height),
        'xmlns': 'http://www.w3.org/2000/svg'
    })

    # Initialize Perlin noise
    noise = PerlinNoise(octaves=4, seed=1)

    def get_cell_properties(row, col):
        # Calculate distance from center
        center_row, center_col = rows / 2, cols / 2
        max_distance = math.sqrt((rows/2)**2 + (cols/2)**2)
        distance = math.sqrt((row - center_row)**2 + (col - center_col)**2)
        
        # Normalize distance to [0, 1] range and invert
        distance_factor = 1 - (distance / max_distance)
        
        # Use Perlin noise to generate a value
        x = row / rows * noise_scale
        y = col / cols * noise_scale
        noise_value = noise([x, y])
        
        # Normalize noise value to [0, 1] range
        normalized_noise = (noise_value + 1) / 2
        
        # Combine distance factor and noise
        combined_value = distance_factor * normalized_noise
        
        if USE_CLASSIFIED_SCALE:
            # Classify the combined value into one of NUM_CLASSES classes
            class_value = min(int(combined_value * NUM_CLASSES), NUM_CLASSES - 1)
            # Map class to size value
            size_value = min_size + (max_size - min_size) * (class_value / (NUM_CLASSES - 1))
        else:
            # Use continuous scale
            size_value = min_size + (max_size - min_size) * combined_value
        
        # Calculate fill probability
        fill_prob = combined_value**2  # Quadratic falloff
        
        return fill_prob, size_value

    # Create cells
    for row in range(rows):
        for col in range(cols):
            x = col * cell_size
            y = row * cell_size
            fill_prob, size_value = get_cell_properties(row, col)
            
            # Determine if the cell should be filled based on probability
            if fill_prob > 0.05:  # Adjust this threshold as needed
                # Calculate the size and position of the inner square
                inner_size = cell_size * size_value - (2 * padding)
                inner_x = x + (cell_size - inner_size) / 2
                inner_y = y + (cell_size - inner_size) / 2
                
                # Create rectangle element for the inner square
                ET.SubElement(svg, 'rect', {
                    'x': str(inner_x),
                    'y': str(inner_y),
                    'width': str(inner_size),
                    'height': str(inner_size),
                    'fill': base_color
                })
                
                # Draw outline for this cell if DRAW_OUTLINE is True
                if draw_outline:
                    ET.SubElement(svg, 'rect', {
                        'x': str(x),
                        'y': str(y),
                        'width': str(cell_size),
                        'height': str(cell_size),
                        'fill': 'none',
                        'stroke': outline_color,
                        'stroke-width': '1'
                    })

    # Create the SVG tree and return as a string
    return ET.tostring(svg, encoding='unicode')

# Create the grid map
svg_content = create_grid_map_svg(WIDTH, HEIGHT, CELL_SIZE, BASE_COLOR, OUTLINE_COLOR, NOISE_SCALE, MIN_SIZE, MAX_SIZE, PADDING, DRAW_OUTLINE)

# Save the SVG file
scale_type = 'classified' if USE_CLASSIFIED_SCALE else 'continuous'
outline_type = 'with_selective_outline' if DRAW_OUTLINE else 'no_outline'
file_name = f'grid_map_{scale_type}_{outline_type}.svg'

with open(file_name, 'w', encoding='utf-8') as f:
    f.write(svg_content)

print(f"Grid map has been generated and saved as '{file_name}'")
print(f"Grid dimensions: {WIDTH//CELL_SIZE}x{HEIGHT//CELL_SIZE} cells")
print(f"Scale type: {'Classified' if USE_CLASSIFIED_SCALE else 'Continuous'}")
print(f"Outline: {'Drawn for filled cells' if DRAW_OUTLINE else 'Not drawn'}")
