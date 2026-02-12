/**
 * Test if tour actually exists in database
 */

const https = require('https');

const productionUrl = 'https://www.atockorea.com';
const testTourId = 'd7691042-120b-4699-90b7-9cd0ac013898';

// First, get all tours to see what exists
function testGetAllTours() {
  return new Promise((resolve, reject) => {
    const url = `${productionUrl}/api/tours`;
    console.log(`\n🔍 Step 1: Testing /api/tours (should work)`);
    console.log(`URL: ${url}`);
    
    https.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          console.log(`✅ Status: ${res.statusCode}`);
          console.log(`✅ Found ${json.tours?.length || 0} tours\n`);
          
          if (json.tours && json.tours.length > 0) {
            console.log(`📋 First few tour IDs:`);
            json.tours.slice(0, 5).forEach((tour, idx) => {
              console.log(`   ${idx + 1}. ${tour.id} - ${tour.title}`);
            });
            
            // Check if our test tour ID exists
            const testTour = json.tours.find(t => t.id === testTourId);
            if (testTour) {
              console.log(`\n✅ Test tour ID found in list!`);
              console.log(`   ID: ${testTour.id}`);
              console.log(`   Title: ${testTour.title}`);
              console.log(`   Slug: ${testTour.slug || 'N/A'}`);
              console.log(`   Active: ${testTour.isActive !== false}`);
            } else {
              console.log(`\n❌ Test tour ID NOT found in list`);
              console.log(`   Looking for: ${testTourId}`);
            }
          }
          
          resolve(json);
        } catch (e) {
          console.error(`❌ Failed to parse JSON:`, e.message);
          reject(e);
        }
      });
    }).on('error', (err) => {
      console.error(`❌ Request error:`, err.message);
      reject(err);
    });
  });
}

// Then try to get specific tour
function testGetSpecificTour(tourId) {
  return new Promise((resolve, reject) => {
    const url = `${productionUrl}/api/tours/${tourId}`;
    console.log(`\n🔍 Step 2: Testing /api/tours/[id] (the broken one)`);
    console.log(`URL: ${url}`);
    
    https.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const contentType = res.headers['content-type'] || '';
        const matchedPath = res.headers['x-matched-path'] || 'N/A';
        
        console.log(`Status: ${res.statusCode}`);
        console.log(`Content-Type: ${contentType}`);
        console.log(`x-matched-path: ${matchedPath}`);
        console.log(`Response length: ${data.length} bytes`);
        
        if (contentType.includes('application/json')) {
          try {
            const json = JSON.parse(data);
            console.log(`✅ JSON Response:`);
            console.log(JSON.stringify(json, null, 2));
            resolve({ success: true, data: json });
          } catch (e) {
            console.log(`❌ Invalid JSON`);
            resolve({ success: false, error: 'Invalid JSON' });
          }
        } else if (contentType.includes('text/html')) {
          console.log(`❌ HTML Response (404 page)`);
          console.log(`   This means the route is NOT being recognized`);
          resolve({ success: false, error: 'HTML 404', matchedPath });
        } else {
          console.log(`⚠️  Other content type`);
          resolve({ success: false, error: 'Unknown content type' });
        }
      });
    }).on('error', (err) => {
      console.error(`❌ Request error:`, err.message);
      reject(err);
    });
  });
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('🧪 Comprehensive Tour API Test');
  console.log('='.repeat(60));
  
  try {
    // Step 1: Get all tours
    const allTours = await testGetAllTours();
    
    // Step 2: Try to get specific tour
    const result = await testGetSpecificTour(testTourId);
    
    // Step 3: Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));
    
    if (allTours.tours && allTours.tours.length > 0) {
      const testTour = allTours.tours.find(t => t.id === testTourId);
      
      if (testTour) {
        console.log(`✅ Tour exists in database`);
        console.log(`   Title: ${testTour.title}`);
        
        if (!result.success) {
          console.log(`\n❌ BUT API route returns ${result.error}`);
          console.log(`\n🔴 PROBLEM: Tour exists but API route is not working`);
          console.log(`   This confirms it's a Vercel routing issue, not a data issue.`);
        } else {
          console.log(`\n✅ API route works correctly`);
        }
      } else {
        console.log(`\n❌ Tour does NOT exist in database`);
        console.log(`   This might be a data issue, not a routing issue.`);
      }
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}

runTests().catch(console.error);






