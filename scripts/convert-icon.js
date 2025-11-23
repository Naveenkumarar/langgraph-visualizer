/**
 * Script to convert SVG icon to PNG for VS Code marketplace
 * 
 * Usage:
 * 1. Install sharp: npm install --save-dev sharp
 * 2. Run: node scripts/convert-icon.js
 */

const fs = require('fs');
const path = require('path');

// Check if sharp is installed
try {
    const sharp = require('sharp');

    const inputSvg = path.join(__dirname, '..', 'media', 'icons', 'icon-simple.svg');
    const outputPng = path.join(__dirname, '..', 'media', 'icons', 'icon.png');

    console.log('Converting SVG to PNG...');
    console.log(`Input: ${inputSvg}`);
    console.log(`Output: ${outputPng}`);

    sharp(inputSvg)
        .resize(128, 128)
        .png()
        .toFile(outputPng)
        .then(() => {
            console.log('✓ Icon converted successfully!');
            console.log(`PNG icon created at: ${outputPng}`);
        })
        .catch(err => {
            console.error('Error converting icon:', err);
            process.exit(1);
        });

} catch (error) {
    console.error('Error: sharp package not found.');
    console.error('Please install it first: npm install --save-dev sharp');
    console.error('\nAlternatively, you can convert the SVG manually:');
    console.error('1. Open media/icons/icon-simple.svg in a browser');
    console.error('2. Take a screenshot or use an online converter');
    console.error('3. Save as icon.png (128x128) in media/icons/');
    process.exit(1);
}

