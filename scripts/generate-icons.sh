#!/bin/bash

# Script to generate PNG icons from SVG
# Requires ImageMagick or rsvg-convert

echo "🎨 Generating icons from SVG..."

# Check if we have the necessary tools
if command -v rsvg-convert &> /dev/null; then
    CONVERTER="rsvg-convert"
    echo "✓ Using rsvg-convert"
elif command -v convert &> /dev/null; then
    CONVERTER="imagemagick"
    echo "✓ Using ImageMagick"
else
    echo "❌ Error: Neither rsvg-convert nor ImageMagick (convert) found."
    echo "Install one of them:"
    echo "  - macOS: brew install librsvg  (or)  brew install imagemagick"
    echo "  - Linux: sudo apt-get install librsvg2-bin  (or)  sudo apt-get install imagemagick"
    exit 1
fi

# Create output directory if it doesn't exist
mkdir -p media/icons

# Generate PNG icons at different sizes
if [ "$CONVERTER" = "rsvg-convert" ]; then
    echo "Generating 128x128 icon..."
    rsvg-convert -w 128 -h 128 media/icons/icon.svg -o media/icons/icon-128.png
    
    echo "Generating 256x256 icon..."
    rsvg-convert -w 256 -h 256 media/icons/icon.svg -o media/icons/icon.png
    
    echo "Generating 512x512 icon..."
    rsvg-convert -w 512 -h 512 media/icons/icon.svg -o media/icons/icon-512.png
else
    echo "Generating 128x128 icon..."
    convert -background none -resize 128x128 media/icons/icon.svg media/icons/icon-128.png
    
    echo "Generating 256x256 icon..."
    convert -background none -resize 256x256 media/icons/icon.svg media/icons/icon.png
    
    echo "Generating 512x512 icon..."
    convert -background none -resize 512x512 media/icons/icon.svg media/icons/icon-512.png
fi

# Generate banner PNG
echo "Generating banner..."
if [ "$CONVERTER" = "rsvg-convert" ]; then
    rsvg-convert -w 1200 -h 300 media/banner.svg -o media/banner.png
else
    convert -background none -resize 1200x300 media/banner.svg media/banner.png
fi

echo "✅ Done! Generated icons:"
echo "  - media/icons/icon-128.png"
echo "  - media/icons/icon.png (256x256)"
echo "  - media/icons/icon-512.png"
echo "  - media/banner.png"

