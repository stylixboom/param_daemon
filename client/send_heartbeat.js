/*
	Parameter client for Hyperledger
	Author: Siriwat K.
	Created: 8 August 2016
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
        process.exit(1);
    }
}
// Explicit PORT
if (args[1]) {
    if (!isNaN(args[1])) {
        DEMON_PORT = parseInt(args[1]);
    }
    else {
        console.log("Error: Server port incorrect");
        process.exit(1);
    }
}

// Packages
var http = require('http');
var querystring = require('querystring');

var fs = require('fs');

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

// ------------------- Save and Restore net interface name -------------------
function restore_iface() {
    try {
        var load_iface = fs.readFileSync(__dirname + "/iface", 'utf8');
        //console.log("iface name was loaded!");
        return load_iface;
    }
    catch (err) {
        console.log(err);
    }
}

function check_existing_iface() {
    try {
        fs.accessSync(__dirname + "/iface");
        return true;
    }
    catch (err) {
        // iface file does not exists.
        return false;
    }
}

// Container IP address
var container_ipaddr = '0.0.0.0';
function fetch_network_ip() {
    if (check_existing_iface()) {
        var ifaces = require('os').networkInterfaces();
        var selected_iface = restore_iface();
        container_ipaddr = ifaces[selected_iface][0].address;
    } else {
        console.log("Error: No selected interface available. Possible, client.js does not running?")
        process.exit(1);
    }
}
var container_hostname = require('os').hostname();

// ---- Function to send a heartbeat signal ----
function send_heartbeat_signal() {
    var load_uuid = restore_uuid();

    var data = querystring.stringify({
        uuid: load_uuid,
        ipaddr: container_ipaddr,
        hostname: container_hostname
    });

    //console.log(container_ipaddr);

    var options = {
        host: DEMON_ADDR,
        port: DEMON_PORT,
        path: '/send_heartbeat',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(data)
        }
    };

    var req = http.request(options, function (res) {
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            // Returned (should be a successfully heartbeat acknowledgement message)
            //console.log("body: " + chunk);

            var result = JSON.parse(chunk);

            if (result.error) {
                console.log("Error: " + result.message);
                process.exit(1);
            }
        });
    });

    req.on('error', function (err) {
        console.log("Error: Cannot connect to Parameter daemon " + DEMON_ADDR + ":" + DEMON_PORT);
    });
    req.write(data);
    req.end();
}

// -------------- Load current UUID -------------
if (check_existing_uuid()) {
    // Fetching current network IP
    fetch_network_ip();

    // ------------- Send heartbeat signal ------------
    send_heartbeat_signal();
    var beater = setInterval(function () {
        send_heartbeat_signal();
    }, 10000); // Send a beat every 10 seconds.
} else {
    // ------------- Fail if no UUID exists before ------------
    console.log("Error: UUID does not exist.");
    process.exit(1);
}