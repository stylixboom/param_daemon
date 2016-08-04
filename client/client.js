/*
	Parameter client for Hyperledger
	Author: Siriwat K.
	Created: 2 August 2016
*/

var args = process.argv.slice(2);

// --------------- Server default connection info ---------------
var DEMON_ADDR = '10.128.0.215';
var DEMON_PORT = 10101;

// --------------- Validator initialize ---------------
var validator = require('validator');

// --------------- Server Parameter ---------------
// Explicit IP
if (args[0]) {
    if (validator.isIP(args[0])) {
        DEMON_ADDR = args[0];
    }
    else {
        console.log("Error: Server IP address incorrect");
        process.exit();
    }
}
// Explicit PORT
if (args[1]) {
    if (!isNaN(args[1])) {
        DEMON_PORT = parseInt(args[1]);
    }
    else {
        console.log("Error: Server port incorrect");
        process.exit();
    }
}

// Packages
var http = require('http');
var querystring = require('querystring');
var uuid = require('node-uuid');

// ------------------- Save and Restore UUID -------------------
var fs = require('fs');
function save_uuid(this_uuid) {
    try {
        fs.writeFileSync(__dirname + "/uuid", this_uuid, 'utf8');
        //console.log("UUID was saved!");
    }
    catch (err) {
        console.log(err);
    }
}

function restore_uuid() {
    try {
        var load_uuid = fs.readFileSync(__dirname + "/uuid", 'utf8');
        //console.log("UUID was loaded!");
        return load_uuid;
    }
    catch (err) {
        console.log(err);
    }
}

function check_existing_uuid() {
    try {
        fs.accessSync(__dirname + "/uuid");
        return true;
    }
    catch (err) {
        // UUID file does not exists.
        return false;
    }
}

// --------------------- Login/Register a node --------------
if (check_existing_uuid()) {
    // ------------- Login with existing UUID ------------
    var load_uuid = restore_uuid();

    var data = querystring.stringify({
        uuid: load_uuid
    });

    var options = {
        host: DEMON_ADDR,
        port: DEMON_PORT,
        path: '/regist',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(data)
        }
    };

    var req = http.request(options, function (res) {
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            // Returned
            //console.log("body: " + chunk);

            var result = JSON.parse(chunk);

            if (result.error) {
                console.log("Error: " + result.message);
                process.exit(1);
            }

            // Output node_id
            process.stdout.write(result.node_id.toString());
        });
    });

    req.on('error', function (err) {
        console.log("Error: Cannot connect to Parameter daemon " + DEMON_ADDR + ":" + DEMON_PORT);
    });
    req.write(data);
    req.end();
} else {
    // -------------- Registering with newly generated UUID -------------
    var new_uuid = uuid.v4();

    var data = querystring.stringify({
        uuid: new_uuid
    });

    var options = {
        host: DEMON_ADDR,
        port: DEMON_PORT,
        path: '/regist',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(data)
        }
    };

    var req = http.request(options, function (res) {
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            // Returned
            //console.log("body: " + chunk);

            var result = JSON.parse(chunk);

            if (result.error) {
                console.log("Error: " + result.message);
                process.exit(1);
            }

            // Save
            save_uuid(new_uuid);

            // Output node_id
            process.stdout.write(result.node_id.toString());
        });
    });

    req.on('error', function (err) {
        console.log("Error: Cannot connect to parameter daemon " + DEMON_ADDR + ":" + DEMON_PORT);
    });
    req.write(data);
    req.end();
}