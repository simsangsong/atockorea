/**
 * Test production tour API endpoint
 * Usage: node scripts/test-production-tour-api.js <tourId>
 * Example: node scripts/test-production-tour-api.js d7691042-120b-4699-90b7-9cd0ac013898
 */

const https = require('https');

const tourId = process.argv[2];
const productionUrl = 'https://www.atockorea.com';

if (!tourId) {
  console.error('❌ Please provide a tour ID');
  console.error('Usage: node scripts/test-production-tour-api.js <tourId>');
  console.error('Example: node scripts/test-production-tour-api.js d7691042-120b-4699-90b7-9cd0ac013898');
  process.exit(1);
}

const apiUrl = `${productionUrl}/api/tours/${encodeURIComponent(tourId)}`;

console.log(`\n🔍 Testing production API: ${apiUrl}\n`);

https.get(apiUrl, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log(`📡 Status Code: ${res.statusCode}`);
    console.log(`📋 Headers:`, JSON.stringify(res.headers, null, 2));
    
    try {
      const json = JSON.parse(data);
      console.log(`\n📦 Response Body:`, JSON.stringify(json, null, 2));
      
      if (res.statusCode === 200) {
        console.log('\n✅ SUCCESS: Tour found!');
        if (json.tour) {
          console.log(`   ID: ${json.tour.id}`);
          console.log(`   Title: ${json.tour.title}`);
          console.log(`   City: ${json.tour.city}`);
        }
      } else if (res.statusCode === 404) {
        console.log('\n❌ ERROR: Tour not found (404)');
        console.log(`   Error message: ${json.error || 'Unknown error'}`);
        console.log(`   Error code: ${json.code || 'N/A'}`);
      } else {
        console.log(`\n⚠️  Unexpected status code: ${res.statusCode}`);
      }
    } catch (e) {
      console.log(`\n📄 Raw Response (not JSON):`);
      console.log(data);
    }
  });
}).on('error', (err) => {
  console.error(`\n❌ Request Error: ${err.message}`);
  process.exit(1);
});






