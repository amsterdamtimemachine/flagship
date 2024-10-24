import xml.etree.ElementTree as ET
from perlin_noise import PerlinNoise
import math

# Constants and Parameters
USE_CLASSIFIED_SCALE = True  # Set to False for continuous scale
NUM_CLASSES = 5  # Number of classes for classified scale

# Grid parameters
WIDTH, HEIGHT = 1280, 720 
CELL_SIZE = 30  # Size of each square cell
CELL_PADDING = 1  # Padding between cells

# Color parameters
STROKE_COLOR = "#0702FF"  # Hex color code

# Noise and size parameters
NOISE_SCALE = 5  # Controls the scale of the Perlin noise
MIN_STROKE = 0  # Minimum stroke width
MAX_STROKE = (CELL_SIZE - CELL_PADDING * 2) / 2  # Maximum stroke width (half of cell size minus padding)

# Threshold for drawing outlines
OUTLINE_THRESHOLD = 0.05  # Adjust this value to control when outlines are drawn

def create_grid_map_svg(width, height, cell_size, cell_padding, stroke_color, noise_scale, min_stroke, max_stroke, outline_threshold):
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
            # Map class to stroke width
            stroke_width = min_stroke + (max_stroke - min_stroke) * (class_value / (NUM_CLASSES - 1))
        else:
            # Use continuous scale
            stroke_width = min_stroke + (max_stroke - min_stroke) * combined_value
        
        return combined_value, stroke_width

    # Create cells
    for row in range(rows):
        for col in range(cols):
            x = col * cell_size + cell_padding
            y = row * cell_size + cell_padding
            cell_value, stroke_width = get_cell_properties(row, col)
            
            # Only draw cells with value > outline_threshold
            if cell_value > outline_threshold:
                inner_size = cell_size - 2 * cell_padding - stroke_width
                # Create rectangle element for the cell
                ET.SubElement(svg, 'rect', {
                    'x': str(x + stroke_width / 2),
                    'y': str(y + stroke_width / 2),
                    'width': str(inner_size),
                    'height': str(inner_size),
                    'fill': 'none',
                    'stroke': stroke_color,
                    'stroke-width': str(stroke_width)
                })

    # Create the SVG tree and return as a string
    return ET.tostring(svg, encoding='unicode')

# Create the grid map
svg_content = create_grid_map_svg(WIDTH, HEIGHT, CELL_SIZE, CELL_PADDING, STROKE_COLOR, NOISE_SCALE, MIN_STROKE, MAX_STROKE, OUTLINE_THRESHOLD)

# Save the SVG file
scale_type = 'classified' if USE_CLASSIFIED_SCALE else 'continuous'
file_name = f'grid_map_{scale_type}_inward_stroke.svg'

with open(file_name, 'w', encoding='utf-8') as f:
    f.write(svg_content)

print(f"Grid map has been generated and saved as '{file_name}'")
print(f"Grid dimensions: {WIDTH//CELL_SIZE}x{HEIGHT//CELL_SIZE} cells")
print(f"Scale type: {'Classified' if USE_CLASSIFIED_SCALE else 'Continuous'}")
print(f"Visualization: Inward-growing variable stroke width with selective outlines and cell padding")
