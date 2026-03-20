# Measurement constants
# 1 meter = 10 pixels
PIXELS_PER_METER = 10

def pixels_to_meters(pixels):
    """Convert pixels to meters."""
    return pixels / PIXELS_PER_METER

def meters_to_pixels(meters):
    """Convert meters to pixels."""
    return meters * PIXELS_PER_METER

