/**
 * Test tour availability API to see if nested dynamic routes work
 */

const https = require('https');

const productionUrl = 'https://www.atockorea.com';
const tourId = 'd7691042-120b-4699-90b7-9cd0ac013898';

const endpoints = [
  `/api/tours/${tourId}`,  // Main route (not working)
  `/api/tours/${tourId}/availability?date=2025-12-26&guests=1`,  // Nested route (should work if structure is fine)
];

function testEndpoint(path) {
  return new Promise((resolve, reject) => {
    const url = `${productionUrl}${path}`;
    console.log(`\n🔍 Testing: ${url}`);
    
    https.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const contentType = res.headers['content-type'] || '';
        const isJson = contentType.includes('application/json');
        const isHtml = contentType.includes('text/html');
        
        console.log(`   Status: ${res.statusCode}`);
        console.log(`   Content-Type: ${contentType}`);
        console.log(`   x-matched-path: ${res.headers['x-matched-path'] || 'N/A'}`);
        
        if (isJson) {
          try {
            const json = JSON.parse(data);
            console.log(`   ✅ JSON Response`);
            console.log(`   Response: ${JSON.stringify(json).substring(0, 200)}...`);
            resolve({ path, status: res.statusCode, type: 'json', success: true });
          } catch (e) {
            console.log(`   ⚠️  JSON parse failed`);
            resolve({ path, status: res.statusCode, type: 'json-invalid', success: false });
          }
        } else if (isHtml) {
          console.log(`   ❌ HTML Response (Next.js 404 page)`);
          resolve({ path, status: res.statusCode, type: 'html', success: false });
        } else {
          console.log(`   ⚠️  Other content type`);
          resolve({ path, status: res.statusCode, type: 'other', success: false });
        }
      });
    }).on('error', (err) => {
      console.error(`   ❌ Request Error: ${err.message}`);
      reject({ path, error: err.message });
    });
  });
}

async function testAll() {
  console.log('🧪 Testing Tour API Routes\n');
  console.log('='.repeat(60));
  
  const results = [];
  
  for (const endpoint of endpoints) {
    try {
      const result = await testEndpoint(endpoint);
      results.push(result);
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      results.push({ path: endpoint, error: error.message || error.error, success: false });
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Summary:\n');
  
  results.forEach(result => {
    const icon = result.success ? '✅' : '❌';
    console.log(`${icon} ${result.path}`);
    console.log(`   Status: ${result.status || 'N/A'}, Type: ${result.type || 'N/A'}`);
  });
  
  if (results[0]?.type === 'html' && results[1]?.type === 'json') {
    console.log('\n💡 INSIGHT: Nested route works but main route doesn\'t!');
    console.log('   This suggests a routing conflict or priority issue.');
  }
}

testAll().catch(console.error);

