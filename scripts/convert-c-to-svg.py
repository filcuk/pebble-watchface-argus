import re

# Paste your C array code here (or read it from a file)
c_code_input = """
#define SVGEXPORT-15_FRAME_WIDTH 14
#define SVGEXPORT-15_FRAME_HEIGHT 14

static const uint32_t svgexport-15_data[1][196] = {
{
0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 
0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 
0x00000000, 0x00000000, 0x00000000, 0x00000000, 0xffffffff, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0xffffffff, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 
0x00000000, 0x00000000, 0x00000000, 0xffffffff, 0xffffffff, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0xffffffff, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 
0x00000000, 0x00000000, 0x00000000, 0x00000000, 0xffffffff, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0xffffffff, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 
0x00000000, 0x00000000, 0x00000000, 0x00000000, 0xffffffff, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0xffffffff, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 
0x00000000, 0x00000000, 0x00000000, 0xffffffff, 0xffffffff, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0xffffffff, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 
0x00000000, 0x00000000, 0x00000000, 0x00000000, 0xffffffff, 0x00000000, 0xffffffff, 0xffffffff, 0x00000000, 0xffffffff, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 
0x00000000, 0x00000000, 0x00000000, 0x00000000, 0xffffffff, 0x00000000, 0xffffffff, 0xffffffff, 0x00000000, 0xffffffff, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 
0x00000000, 0x00000000, 0x00000000, 0xffffffff, 0xffffffff, 0x00000000, 0xffffffff, 0xffffffff, 0x00000000, 0xffffffff, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 
0x00000000, 0x00000000, 0x00000000, 0x00000000, 0xffffffff, 0x00000000, 0xffffffff, 0xffffffff, 0x00000000, 0xffffffff, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 
0x00000000, 0x00000000, 0x00000000, 0x00000000, 0xffffffff, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0xffffffff, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 
0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 
0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000
}
};
"""

def c_array_to_svg(c_text, output_filename="output.svg"):
    # Find image dimensions dynamically from the code
    width_match = re.search(r"FRAME_WIDTH\s+(\d+)", c_text)
    height_match = re.search(r"FRAME_HEIGHT\s+(\d+)", c_text)
    
    width = int(width_match.group(1)) if width_match else 14
    height = int(height_match.group(1)) if height_match else 14
    
    # Extract all hex values (e.g., 0xffffffff) from the code text
    hex_values = [int(x, 16) for x in re.findall(r"0x[0-9a-fA-F]+", c_text)]
    
    # Ensure we only evaluate the exact frame grid boundaries 
    rectangles = []
    for index, val in enumerate(hex_values[:width * height]):
        # Filter for non-transparent pixels (Alpha channel > 0)
        if (val & 0xFF000000) != 0: 
            y = index // width
            x = index % width
            rectangles.append(f'    <rect x="{x}" y="{y}" width="1" height="1" />')

    # Construct the SVG XML structure
    svg_content = [
        '<?xml version="1.0" encoding="utf-8"?>',
        f'<svg xmlns="http://w3.org" viewBox="0 0 {width} {height}" width="{width*10}" height="{height*10}" shape-rendering="crispEdges">',
        '  <g fill="rgb(255,255,255)">'
    ]
    svg_content.extend(rectangles)
    svg_content.extend([
        '  </g>',
        '</svg>'
    ])
    
    # Save the output file
    with open(output_filename, "w", encoding="utf-8") as f:
        f.write("\n".join(svg_content))
    print(f"Successfully saved clean vector file as '{output_filename}'")

# Run the execution logic
c_array_to_svg(c_code_input)
