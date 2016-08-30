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

// ------------------- Save and Restore net interface name -------------------
function save_iface(this_iface) {
    try {
        fs.writeFileSync(__dirname + "/iface", this_iface, 'utf8');
        //console.log("iface name was saved!");
    }
    catch (err) {
        console.log(err);
    }
}

// Container IP address
var container_ipaddr = '0.0.0.0';
function fetch_network_ip(specific_interface) {
    // Require network interface
    var ifaces = require('os').networkInterfaces();
    var selected_iface = '';

    // Retrieving an IP address from the specific interface
    if (specific_interface && specific_interface != "") {
        try {
            container_ipaddr = ifaces[specific_interface][0].address;
            selected_iface = specific_interface;
        } catch (err) {
            console.log("Error: Specific interface " + specific_interface + " not found.");
            process.exit(1);
        }
    }
    // Retrieving an IP address from the pre specified list
    else {
        if (ifaces["ethwe3"]) {
            container_ipaddr = ifaces["ethwe3"][0].address;
            selected_iface = "ethwe3";
        } else if (ifaces["eth0"]) {
            container_ipaddr = ifaces["eth0"][0].address;
            selected_iface = "eth0";
        } else if (ifaces["enp0s3"]) {
            container_ipaddr = ifaces["enp0s3"][0].address;
            selected_iface = "enp0s3";
        } else {
            console.log("Error: No listed network interface available [ethwe3, eth0, enp0s3].");
            process.exit(1);
        }
    }

    // Save current using iface
    save_iface(selected_iface);
}
var container_hostname = require('os').hostname();

// Array diff
Array.prototype.diff = function (a) {
    return this.filter(function (i) { return a.indexOf(i) < 0; });
};

// Weave construction function
function connect_weave_from_server() {
    //console.log("Requesting to get weave network interface...");

    // Request to the Server
    var data = querystring.stringify({
        hostname: container_hostname
    });

    var options = {
        host: DEMON_ADDR,
        port: DEMON_PORT,
        path: '/install_weave',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(data)
        }
    };

    // Get interface name without weave
    var old_iface = Object.keys(require('os').networkInterfaces());

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

            // Get interface name with weave
            var new_iface = Object.keys(require('os').networkInterfaces());

            // New interface exists
            if (old_iface.length < new_iface.length) {

                // Get weave interface name
                var weave_iface = new_iface.diff(old_iface);

                // Fetching current network IP
                fetch_network_ip(weave_iface[0]);

                // Process login
                process_login();
            } else {
                console.log("ERROR: Possibly, not connected to weave interface.");
                process.exit(1);
            }

            //console.log("Success");
        });
    });

    req.on('error', function (err) {
        console.log("Error: Cannot connect to Parameter daemon " + DEMON_ADDR + ":" + DEMON_PORT);
        process.exit(1);
    });
    req.write(data);
    req.end();
}

// Use docker API
function connect_weave_with_api() {
    var dockersock_path = '/var/run/docker.sock';

    // Check docker.sock available
    try {
        fs.accessSync(dockersock_path);
    } catch (err) {
        console.log("ERROR: Missing Docker sock: " + dockersock_path);
        process.exit(1);
    }

    // Connecting weave
    try {
        // Get interface name without weave
        var old_iface = Object.keys(require('os').networkInterfaces());

        var Docker = require('dockerode');
        var docker = new Docker({ socketPath: dockersock_path });
        var container = docker.getContainer(process.env.HOSTNAME);
        var network = docker.getNetwork('weave');
        network.connect({
            Container: container.id
        }, function (err, data) {
            // Get interface name with weave
            var new_iface = Object.keys(require('os').networkInterfaces());

            // New interface exists
            if (old_iface.length < new_iface.length) {

                // Get weave interface name
                var weave_iface = new_iface.diff(old_iface);

                // Fetching current network IP
                fetch_network_ip(weave_iface[0]);

                // Process login
                process_login();
            } else {
                console.log("ERROR: Possibly, not connected to weave interface.");
                process.exit(1);
            }

            //console.log("Success");
        });
    } catch (err) {
        console.log("ERROR: Failed to connect weave.");
        process.exit(1);
    }
}

// --------------------- Plugging-in WEAVE network --------------
if (process.env.CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE && process.env.CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE == 'weave') {
    // By using Docker API + nodejs + dockerode 
    connect_weave_with_api();
    // By using server to plug-in weave through ssh connection 
    // connect_weave_from_server();
} else {
    // Fetching current network IP
    fetch_network_ip();

    // Process login
    process_login();
}

// --------------------- Login/Register a node --------------
function process_login() {
    // Require Hyram to generate Hyperledger parameters
    var Hyram = require('./hyram');
    if (check_existing_uuid()) {
        // ------------- Login with existing UUID ------------
        var load_uuid = restore_uuid();

        var data = querystring.stringify({
            uuid: load_uuid,
            ipaddr: container_ipaddr
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

                var node_info = {
                    node_id: result.node_id,
                    container_ipaddr: container_ipaddr,
                    active_node: result.active_node,
                    role: process.env.ROLE ? process.env.ROLE : 'mixed',
                    consensus: process.env.CONSEN ? process.env.CONSEN : 'noops'
                }

                // Create an instance of the Hyram object.
                var hyram = new Hyram();
                // Export the environment for console to execute.
                console.log(hyram.gen(node_info));
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
            uuid: new_uuid,
            ipaddr: container_ipaddr
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
                //console.log(result.node_id);
                //console.log(result.active_node);
                // <-- will be replaced with Hyram

                var node_info = {
                    node_id: result.node_id,
                    container_ipaddr: container_ipaddr,
                    active_node: result.active_node,
                    role: process.env.ROLE ? process.env.ROLE : 'mixed',
                    consensus: process.env.CONSEN ? process.env.CONSEN : 'noops'
                }

                // Create an instance of the Hyram object.
                var hyram = new Hyram();
                console.log(hyram.gen(node_info));
            });
        });

        req.on('error', function (err) {
            console.log("Error: Cannot connect to parameter daemon " + DEMON_ADDR + ":" + DEMON_PORT);
        });
        req.write(data);
        req.end();
    }
}