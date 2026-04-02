const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/categories',
  method: 'GET'
};

const req = http.request(options, res => {
  console.log(STATUS: );
  res.on('data', d => {
    process.stdout.write(d);
  });
});

req.on('error', error => {
  console.error(error);
});

req.end();
