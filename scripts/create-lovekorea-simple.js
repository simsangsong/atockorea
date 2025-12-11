/**
 * Simple script to create LoveKorea merchant account
 * This uses the API endpoint instead of direct Supabase access
 * 
 * Usage: 
 *   1. Make sure dev server is running: npm run dev
 *   2. Run: node scripts/create-lovekorea-simple.js
 */

const https = require('https');
const http = require('http');

const API_URL = process.env.API_URL || 'http://localhost:3000';
const email = 'lovekorea@lovekorea.com'; // Add @domain for email format
const password = 'lovekorea';

const merchantData = {
  company_name: 'LoveKorea Travel',
  business_registration_number: 'LOVE-KOREA-2024',
  contact_person: 'LoveKorea Admin',
  contact_email: email,
  contact_phone: '010-0000-0000',
  address_line1: '123 Travel Street',
  city: 'Seoul',
  province: 'Seoul',
  postal_code: '00000',
  country: 'South Korea',
  password: password, // Include password in request
};

async function createMerchant() {
  console.log('Creating LoveKorea merchant account via API...');
  console.log('Email:', merchantData.contact_email);
  console.log('Password:', password);
  console.log('API URL:', API_URL);
  
  const url = new URL(`${API_URL}/api/admin/merchants`);
  const isHttps = url.protocol === 'https:';
  const client = isHttps ? https : http;
  
  const postData = JSON.stringify(merchantData);
  
  const options = {
    hostname: url.hostname,
    port: url.port || (isHttps ? 443 : 3000),
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
    },
  };

  return new Promise((resolve, reject) => {
    const req = client.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (res.statusCode === 201) {
            console.log('\n✅ Merchant account created successfully!');
            console.log('📋 Login Credentials:');
            console.log('   Email:', merchantData.contact_email);
            console.log('   Password:', password);
            console.log('\n🌐 Login URL:');
            console.log('   http://localhost:3000/merchant/login');
            resolve(response);
          } else {
            console.error('❌ Error:', response.error || data);
            reject(new Error(response.error || 'Failed to create merchant'));
          }
        } catch (e) {
          console.error('❌ Parse error:', data);
          reject(e);
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('❌ Request error:', error.message);
      console.error('\n💡 Make sure the dev server is running: npm run dev');
      reject(error);
    });
    
    req.write(postData);
    req.end();
  });
}

// Run
createMerchant().catch(console.error);


