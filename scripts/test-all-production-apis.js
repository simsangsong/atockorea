/**
 * Test multiple production API endpoints to diagnose routing issues
 */

const https = require('https');

const productionUrl = 'https://www.atockorea.com';

const endpoints = [
  '/api/tours',  // List API
  '/api/tours/d7691042-120b-4699-90b7-9cd0ac013898',  // Detail API
  '/api/admin/merchants',  // Admin API (will likely fail with auth, but should return JSON, not HTML)
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
            console.log(`   ✅ JSON Response (first 200 chars): ${JSON.stringify(json).substring(0, 200)}...`);
            resolve({ path, status: res.statusCode, type: 'json', success: true });
          } catch (e) {
            console.log(`   ⚠️  JSON parse failed: ${e.message}`);
            resolve({ path, status: res.statusCode, type: 'json-invalid', success: false });
          }
        } else if (isHtml) {
          console.log(`   ❌ HTML Response (Next.js 404 page)`);
          console.log(`   Response length: ${data.length} bytes`);
          resolve({ path, status: res.statusCode, type: 'html', success: false });
        } else {
          console.log(`   ⚠️  Other content type`);
          console.log(`   Response (first 200 chars): ${data.substring(0, 200)}...`);
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
  console.log('🧪 Testing Production API Endpoints\n');
  console.log('='.repeat(60));
  
  const results = [];
  
  for (const endpoint of endpoints) {
    try {
      const result = await testEndpoint(endpoint);
      results.push(result);
      await new Promise(resolve => setTimeout(resolve, 500)); // Small delay between requests
    } catch (error) {
      results.push({ path: endpoint, error: error.message, success: false });
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Summary:\n');
  
  results.forEach(result => {
    const icon = result.success ? '✅' : '❌';
    console.log(`${icon} ${result.path}`);
    console.log(`   Status: ${result.status || 'N/A'}, Type: ${result.type || 'N/A'}`);
  });
  
  const apiRoutesWorking = results.filter(r => r.type === 'json').length;
  const apiRoutesBroken = results.filter(r => r.type === 'html').length;
  
  console.log(`\n📈 Results: ${apiRoutesWorking} working, ${apiRoutesBroken} broken (HTML 404)`);
  
  if (apiRoutesBroken > 0) {
    console.log('\n⚠️  Some API routes are returning HTML 404 pages.');
    console.log('   This suggests the API routes are not being recognized by Next.js/Vercel.');
  }
}

testAll().catch(console.error);



