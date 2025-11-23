const fs = require('fs');
const { execSync } = require('child_process');

console.log('🎨 Generating PNG icons from SVG...');

// Check if sharp is available (npm install sharp)
try {
    // Try using sharp if available
    const sharp = require('sharp');
    
    async function generateIcons() {
        const iconSvg = fs.readFileSync('media/icons/icon.svg');
        const bannerSvg = fs.readFileSync('media/banner.svg');
        
        // Generate icon at different sizes
        await sharp(iconSvg)
            .resize(128, 128)
            .png()
            .toFile('media/icons/icon-128.png');
        console.log('✓ Generated media/icons/icon-128.png');
        
        await sharp(iconSvg)
            .resize(256, 256)
            .png()
            .toFile('media/icons/icon.png');
        console.log('✓ Generated media/icons/icon.png (256x256)');
        
        await sharp(iconSvg)
            .resize(512, 512)
            .png()
            .toFile('media/icons/icon-512.png');
        console.log('✓ Generated media/icons/icon-512.png');
        
        // Generate banner
        await sharp(bannerSvg)
            .resize(1200, 300)
            .png()
            .toFile('media/banner.png');
        console.log('✓ Generated media/banner.png');
        
        console.log('✅ All icons generated successfully!');
    }
    
    generateIcons().catch(err => {
        console.error('Error generating icons:', err);
        process.exit(1);
    });
    
} catch (err) {
    console.log('\n⚠️  Sharp not installed. Please install it to generate PNG icons:');
    console.log('   npm install --save-dev sharp');
    console.log('\nOr use an online SVG to PNG converter:');
    console.log('   - https://svgtopng.com/');
    console.log('   - https://cloudconvert.com/svg-to-png');
    console.log('\nConvert these files:');
    console.log('   - media/icons/icon.svg → media/icons/icon.png (256x256)');
    console.log('   - media/banner.svg → media/banner.png (1200x300)');
    process.exit(1);
}

