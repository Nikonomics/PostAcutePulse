require('dotenv').config();
const http = require('http');

// Make request
const options = {
  hostname: 'localhost',
  port: 5001,
  path: '/api/facilities',
  method: 'GET'
};

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('Status:', res.statusCode);
    const parsed = JSON.parse(data);
    const facilityCount = parsed.body?.data?.length || 0;
    console.log('✅ Facility count:', facilityCount);

    if (facilityCount > 0) {
      const firstFacility = parsed.body.data[0];
      console.log('\nFirst facility preview:');
      console.log('- ID:', firstFacility.id);
      console.log('- Name:', firstFacility.name);
      console.log('- City/State:', firstFacility.city, firstFacility.state);
      console.log('- Group:', firstFacility.facility_group);
    }
  });
});

req.on('error', (e) => {
  console.error('Error:', e.message);
});

req.end();
