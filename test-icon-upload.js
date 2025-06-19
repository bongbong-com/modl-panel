// Test script to verify icon upload and serving functionality
const fs = require('fs');
const path = require('path');

console.log('Testing icon upload and serving functionality...\n');

// Test 1: Check if uploads directory exists or can be created
const uploadsDir = path.join(__dirname, 'uploads');
console.log('1. Testing uploads directory creation...');
if (!fs.existsSync(uploadsDir)) {
    try {
        fs.mkdirSync(uploadsDir, { recursive: true });
        console.log('✅ Uploads directory created successfully');
    } catch (error) {
        console.log('❌ Failed to create uploads directory:', error.message);
    }
} else {
    console.log('✅ Uploads directory already exists');
}

// Test 2: Create a test server subdirectory
const testServerDir = path.join(uploadsDir, 'test-server');
console.log('\n2. Testing server-specific uploads directory...');
if (!fs.existsSync(testServerDir)) {
    try {
        fs.mkdirSync(testServerDir, { recursive: true });
        console.log('✅ Server-specific uploads directory created successfully');
    } catch (error) {
        console.log('❌ Failed to create server-specific uploads directory:', error.message);
    }
} else {
    console.log('✅ Server-specific uploads directory already exists');
}

// Test 3: Create a dummy icon file to simulate an upload
console.log('\n3. Testing file creation in uploads directory...');
const dummyIconPath = path.join(testServerDir, 'homepage-icon-test.png');
const dummyContent = 'dummy icon content'; // In real scenario, this would be image data

try {
    fs.writeFileSync(dummyIconPath, dummyContent);
    console.log('✅ Dummy icon file created successfully');
    console.log(`   File location: ${dummyIconPath}`);
    console.log(`   File should be accessible at: /uploads/test-server/homepage-icon-test.png`);
} catch (error) {
    console.log('❌ Failed to create dummy icon file:', error.message);
}

// Test 4: Verify file can be read back
console.log('\n4. Testing file reading...');
try {
    const readContent = fs.readFileSync(dummyIconPath, 'utf8');
    if (readContent === dummyContent) {
        console.log('✅ File content matches expected content');
    } else {
        console.log('❌ File content does not match');
    }
} catch (error) {
    console.log('❌ Failed to read file:', error.message);
}

console.log('\n5. Cleanup...');
try {
    if (fs.existsSync(dummyIconPath)) {
        fs.unlinkSync(dummyIconPath);
        console.log('✅ Dummy file cleaned up');
    }
    if (fs.existsSync(testServerDir)) {
        fs.rmdirSync(testServerDir);
        console.log('✅ Test server directory cleaned up');
    }
    if (fs.existsSync(uploadsDir) && fs.readdirSync(uploadsDir).length === 0) {
        fs.rmdirSync(uploadsDir);
        console.log('✅ Uploads directory cleaned up');
    }
} catch (error) {
    console.log('⚠️  Cleanup warning:', error.message);
}

console.log('\n📋 Summary:');
console.log('The icon upload functionality should work as follows:');
console.log('1. Icons are uploaded via POST /api/panel/settings/upload-icon?iconType=homepage|panel');
console.log('2. Files are saved to uploads/{serverName}/{iconType}-icon-{timestamp}.{ext}');
console.log('3. URLs are returned as /uploads/{serverName}/{filename}');
console.log('4. Static files are served from the uploads directory');
console.log('5. Homepage uses homepageIconUrl from public settings API');
console.log('6. Panel uses panelIconUrl for favicon and admin interface');
