require('dotenv').config();
const http = require('http');
const jwt = require('jsonwebtoken');

// Generate token
const token = jwt.sign(
  { data: { id: 1, email: 'admin@snfalyze.com', role: 'admin' } },
  process.env.JWT_SECRET || 'your-secret-key',
  { expiresIn: '7d' }
);

// Make request
const options = {
  hostname: 'localhost',
  port: 5001,
  path: '/api/v1/deal/get-deals',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
};

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('Status:', res.statusCode);
    const parsed = JSON.parse(data);
    const dealCount = parsed.body?.deals?.length || 0;
    console.log('✅ Deal count:', dealCount);

    if (dealCount > 0) {
      const firstDeal = parsed.body.deals[0];
      console.log('\nFirst deal preview:');
      console.log('- ID:', firstDeal.id);
      console.log('- Facility:', firstDeal.extraction_data?.facility_name || firstDeal.facility_name);
      console.log('- State:', firstDeal.extraction_data?.state || firstDeal.state);
      console.log('- Created:', firstDeal.createdAt);
    }
  });
});

req.on('error', (e) => {
  console.error('Error:', e.message);
});

req.end();
