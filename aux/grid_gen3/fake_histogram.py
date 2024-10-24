import xml.etree.ElementTree as ET
import random
import math

# Constants
HEIGHT = 200
LENGTH = 2579 
BARS_AMOUNT = 400 
FILL_COLOR = "#0702FF" 
EXPLOSION_POINT = 0.7  # Point where the histogram expands horizontally (0.0 to 1.0)

def custom_distribution(x):
    if x < EXPLOSION_POINT:
        # Gradual growth with randomness before explosion point
        base_height = 0.3 * math.pow(x / EXPLOSION_POINT, 2)
        randomness = random.uniform(-0.05, 0.05)
        return max(0, min(base_height + randomness, 0.5))
    else:
        # Higher values after explosion point, but less dramatic
        return random.uniform(0.5, 0.8)

def create_histogram_svg(height, length, bars_amount, fill_color):
    bar_width = length / bars_amount
    
    svg = ET.Element('svg', {
        'width': str(length),
        'height': str(height),
        'xmlns': 'http://www.w3.org/2000/svg'
    })
    
    # Generate bar heights
    bar_heights = [custom_distribution(i / (bars_amount - 1)) for i in range(bars_amount)]
    
    # Create bars
    for i, bar_height in enumerate(bar_heights):
        bar_height_px = bar_height * height
        x = i * bar_width
        y = height - bar_height_px
        
        ET.SubElement(svg, 'rect', {
            'x': str(x),
            'y': str(y),
            'width': str(bar_width),
            'height': str(bar_height_px),
            'fill': fill_color
        })
    
    return ET.tostring(svg, encoding='unicode')

# Create the histogram
svg_content = create_histogram_svg(HEIGHT, LENGTH, BARS_AMOUNT, FILL_COLOR)

# Save the SVG file
file_name = 'gradual_randomized_histogram.svg'

with open(file_name, 'w', encoding='utf-8') as f:
    f.write(svg_content)

print(f"Gradual randomized histogram has been generated and saved as '{file_name}'")
print(f"Height: {HEIGHT}px, Length: {LENGTH}px, Number of bars: {BARS_AMOUNT}")
print(f"Fill color: {FILL_COLOR}")
print(f"Transition point: {EXPLOSION_POINT}")
