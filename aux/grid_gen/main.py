import random
import xml.etree.ElementTree as ET

def create_grid_map_svg(width, height, cell_size, base_color, outline_color, randomness_factor):
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

    def get_cell_properties(row, col):
        # Calculate distance from center
        center_row, center_col = rows / 2, cols / 2
        max_distance = ((rows/2)**2 + (cols/2)**2)**0.5
        distance = ((row - center_row)**2 + (col - center_col)**2)**0.5
        
        # Normalize distance to [0, 1] range and invert
        normalized_distance = 1 - (distance / max_distance)
        
        # Add controlled randomness
        random_factor = random.uniform(-randomness_factor, randomness_factor)
        adjusted_distance = max(0, min(1, normalized_distance + random_factor))
        
        # Calculate fill probability and alpha value
        fill_prob = adjusted_distance**2  # Quadratic falloff
        
        # Add some randomness to alpha value as well
        base_alpha = int(40 + 140 * adjusted_distance)
        alpha_random = random.uniform(-randomness_factor, randomness_factor) * 128
        alpha_value = max(40, min(140, int(base_alpha + alpha_random)))
        
        return fill_prob, alpha_value

    # Create cells
    for row in range(rows):
        for col in range(cols):
            x = col * cell_size
            y = row * cell_size

            fill_prob, alpha_value = get_cell_properties(row, col)

            # Determine if the cell should be filled based on probability
            if random.random() < fill_prob:
                # Create color with calculated transparency
                fill_color = f"{base_color}{alpha_value:02x}"

                # Create rectangle element for the cell
                ET.SubElement(svg, 'rect', {
                    'x': str(x),
                    'y': str(y),
                    'width': str(cell_size),
                    'height': str(cell_size),
                    'fill': fill_color
                })

    # Create grid lines
    for i in range(rows + 1):
        y = i * cell_size
        ET.SubElement(svg, 'line', {
            'x1': '0',
            'y1': str(y),
            'x2': str(adjusted_width),
            'y2': str(y),
            'stroke': outline_color,
            'stroke-width': '1'
        })

    for i in range(cols + 1):
        x = i * cell_size
        ET.SubElement(svg, 'line', {
            'x1': str(x),
            'y1': '0',
            'x2': str(x),
            'y2': str(adjusted_height),
            'stroke': outline_color,
            'stroke-width': '1'
        })

    # Create the SVG tree and return as a string
    return ET.tostring(svg, encoding='unicode')


# Set parameters
width, height = 1280, 720 
cell_size = 30  # Size of each square cell
base_color = "#0702FF"  # Hex color code
outline_color = "#D3D3D3"  # Hex color code

randomness_factor = 0.2  # Controls the amount of randomness (0.0 to 1.0)
# Create the grid map
svg_content = create_grid_map_svg(width, height, cell_size, base_color, outline_color, randomness_factor)

# Save the SVG file
with open('grid_map_gradient.svg', 'w', encoding='utf-8') as f:
    f.write(svg_content)

print(f"Grid map has been generated and saved as 'grid_map_gradient.svg'")
print(f"Grid dimensions: {width//cell_size}x{height//cell_size} cells")
