// --------------- Server connection info ---------------
const DEMON_ADDR = '10.128.0.215';
const DEMON_PORT = 10101;

// Packages
var http = require('http');
var querystring = require('querystring');
var uuid = require('node-uuid');

var options = {
    host: DEMON_ADDR,
    port: DEMON_PORT,
    path: '/regist',
    method: 'POST',
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(querystring.stringify({
            uuid: uuid.v4()
        }))  // Sample length
    }
};

// Generating UUID
for (i = 0; i < 1000; i++) {
    var new_uuid = uuid.v4();

    var data = querystring.stringify({
        uuid: new_uuid
    });



    var req = http.request(options, function (res) {
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            // Returned
            console.log("body: " + chunk);
        });
    });

    req.write(data);
    req.end();
}