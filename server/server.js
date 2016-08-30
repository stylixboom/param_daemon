/*
	Parameter server for Hyperledger
	Author: Siriwat K.
	Created: 2 August 2016
*/

var args = process.argv.slice(2);

// Log timing functions
function getLogTime() {

  var curr_time = new Date();

  var hour = curr_time.getHours();
  hour = (hour < 10 ? "0" : "") + hour;

  var min = curr_time.getMinutes();
  min = (min < 10 ? "0" : "") + min;

  var sec = curr_time.getSeconds();
  sec = (sec < 10 ? "0" : "") + sec; // 0 padding

  var msec = curr_time.getMilliseconds();
  msec = (msec < 100 ? "0" : "") + msec;

  return "[" + hour + ":" + min + ":" + sec + "." + msec + "]";
}

// --------------- Express API server initialize ---------------
var express = require('express');
var app = express();
// Defining a port we want to listen to
const LISTENING_ADDR = '0.0.0.0';
var LISTENING_PORT = 10101;

// --------------- Validator initialize ---------------
var validator = require('validator');

// --------------- Server Parameter ---------------
// Explicit PORT
if (args[0]) {
  if (!isNaN(args[0])) {
    LISTENING_PORT = parseInt(args[0]);
  }
  else {
    console.log(getLogTime() + " " + "Error: Listening port incorrect");
    process.exit(1);
  }
}

// Body parser
var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));

var server = app.listen(process.env.PORT || LISTENING_PORT, process.env.ADDR || LISTENING_ADDR, function () {
  console.log(getLogTime() + " " + 'Server is listening to %s:%s', server.address().address, server.address().port);
});

// --------------- Hashmap initialize ---------------
var HashMap = require('hashmap');
var uuid_map = new HashMap();

// --------------- MongoDB initialize ---------------
var DB_ADDR = '10.128.0.215';
//var DB_PORT = '27017';
var DB_PORT = '10054';
var DB_NAME = 'node_registry';

// --------------- MongoDB Parameter ---------------
// Explicit IP
if (args[1]) {
  if (validator.isIP(args[1])) {
    DB_ADDR = args[1];
  }
  else {
    console.log(getLogTime() + " " + "Error: MongoDB IP address incorrect");
    process.exit(1);
  }
}
// Explicit PORT
if (args[2]) {
  if (!isNaN(args[2])) {
    DB_PORT = parseInt(args[2]);
  }
  else {
    console.log(getLogTime() + " " + "Error: MongoDB port incorrect");
    process.exit(1);
  }
}

var db = require('monk')((DB_ADDR + ":" + DB_PORT + '/' + DB_NAME), function (err) {
  if (err) {
    console.log(getLogTime() + " " + "Error: Monk connection failed " + DB_ADDR + ":" + DB_PORT + '/' + DB_NAME);
    console.log("Message: " + err);
    process.exit(1);
  } else {
    console.log(getLogTime() + " " + "Connected to MongoDB " + DB_ADDR + ":" + DB_PORT + '/' + DB_NAME);
  }
});

const clients = db.get('clients_info');
clients.index('uuid');

// Update active node
var ping = require('ping');
var active_node = "";
// -------- Active check functions --------
function check_active_by_ping() {
  // Reset active list
  active_node = "";
  uuid_map.forEach(function (client, key) {
    ping.sys.probe(client.ipaddr, function (isAlive) {
      if (isAlive) {
        if (active_node != "")
          active_node += ",";
        active_node += client.ipaddr;
        //console.log(active_node);
      }
    }, { extra: ["-i 1"], timeout: false });
  });
}

function check_active_by_heartbeat_timeout() {
  // Reset active list
  active_node = "";
  uuid_map.forEach(function (client, key) {
    //console.log(client.last_online);
    if (client.last_online &&
      (new Date() - client.last_online) < 30000) {  // Check if client is online within 30 seconds
      if (active_node != "")
        active_node += ",";
      active_node += client.ipaddr;
      //console.log(active_node);
    }
  });
}

var active_checker = setInterval(function () {
  //check_active_by_ping();
  check_active_by_heartbeat_timeout();
}, 1000);

// Initialization
var total_node = 0;
clients.count({}, function (err, count) {
  // Error on counting the registered UUIDs
  if (err) {
    console.log(err, count);
    process.exit(1);
  }
  // Restoring UUID into hashmap
  total_node = count;
  if (total_node) {
    process.stdout.write(getLogTime() + " " + "Loading " + total_node + " client UUIDs from the database..");

    clients.find({}).each((doc, {close, pause, resume}) => {
      // doc streams here
      uuid_map.set(doc.uuid, { node_id: doc.node_id, ipaddr: doc.ipaddr }); // uuid, { node_id, ipaddr }      
    }).then(() => {
      // final callback
      process.stdout.write("done.\n");
    });
  }
});

// exec SSH
var exec = require('child_process').exec;
// --------------- Installing weave interface ---------------
/*
  A route for installing a weave network
  on the requesting container by using the following command
  ssh host_ip 'docker network connect weave container_id'
*/
app.post('/install_weave', function (req, res) {
  var ret = {};

  // Get container Hostname
  if (!req.body.hasOwnProperty('hostname')) {
    console.log(getLogTime() + " " + "Error 400: Missing Hostname.");

    res.statusCode = 400;
    ret.message = "Error 400: Missing Hostname.";
    ret.error = 1;
    res.json(ret);
  }
  var container_hostname = req.body.hostname;

  // Get host IP of running container
  var get_remote_ip = req.connection.remoteAddress;

  console.log("Setting weave..");

  var cmd = "ssh " + get_remote_ip + " 'docker network connect weave " + container_hostname + "'";
  exec(cmd, function (error, stdout, stderr) {
    // Error
    if (stderr) {
      console.log(stderr);

      // Error response
      res.statusCode = 400;
      ret.message = "Failed to install a weave interface to a container: " + container_hostname;
      ret.error = 1;
      res.json(ret);
    }
    // Success
    else {
      console.log(stdout);

      // Success response
      res.statusCode = 200;
      ret.message = "Successfully installed a weave interface to a container: " + container_hostname;
      ret.error = 0;
      res.json(ret);
    }
  });
});

// --------------- Registering client UUID ---------------
app.post('/regist', function (req, res) {
  var ret = {};

  // Check if missing UUID
  if (!req.body.hasOwnProperty('uuid')) {
    console.log(getLogTime() + " " + "Error 400: Missing UUID.");

    res.statusCode = 400;
    ret.message = "Error 400: Missing UUID.";
    ret.error = 1;
    res.json(ret);

    return false;
  }

  var current_uuid = req.body.uuid;
  // Check if invalid UUID
  if (!validator.isUUID(current_uuid)) {
    console.log(getLogTime() + " " + "Error 400: Invalid UUID: " + current_uuid);

    res.statusCode = 400;
    ret.message = "Error 400: Invalid UUID.";
    ret.error = 1;
    res.json(ret);

    return false;
  }

  // Container IP
  if (!req.body.hasOwnProperty('ipaddr')) {
    console.log(getLogTime() + " " + "Error 400: Missing IP address.");

    res.statusCode = 400;
    ret.message = "Error 400: Missing IP address.";
    ret.error = 1;
    res.json(ret);

    return false;
  }

  var client_ip = req.body.ipaddr;
  if (!validator.isIP(client_ip)) {
    console.log(getLogTime() + " " + "Error 400: Invalid IP address: " + current_uuid);

    res.statusCode = 400;
    ret.message = "Error 400: Invalid IP address.";
    ret.error = 1;
    res.json(ret);
    
    return false;
  }

  // Get client IP address  
  // This IP can be access only from outside of the containers
  var get_remote_ip = req.connection.remoteAddress;

  // --------------- Login ---------------
  if (uuid_map.has(current_uuid)) {

    process.stdout.write(getLogTime() + " " + "Node [" + uuid_map.get(current_uuid).node_id + "] " + current_uuid + " is online\n\tContainerIP: " + client_ip + " RemoteIP: " + get_remote_ip + "\n");

    // Check if IP address has changed
    if (uuid_map.get(current_uuid).ipaddr != client_ip) {
      // Change locally
      uuid_map.get(current_uuid).ipaddr = client_ip;
      process.stdout.write("\tUpdate ContainerIP => " + client_ip + "\n");

      // Change at DB
      clients.findOneAndUpdate({ uuid: current_uuid }, { $set: { ipaddr: client_ip } }).then((updatedDoc) => {
        //process.stdout.write(" => " + updatedDoc.ipaddr);
      });
    }

    // Update last online time
    uuid_map.get(current_uuid).last_online = new Date();

    // Success response
    res.statusCode = 200;
    ret.message = "Welcome back node: " + current_uuid;
    ret.node_id = uuid_map.get(current_uuid).node_id;
    ret.active_node = active_node;
    ret.error = 0;
    res.json(ret);
  }
  // --------------- New register ---------------
  else {
    process.stdout.write(getLogTime() + " " + "Registering Node [" + total_node + "] " + current_uuid + "\n\tContainerIP: " + client_ip + " RemoteIP: " + get_remote_ip + "\n");

    // Add to hashmap 
    uuid_map.set(current_uuid, { node_id: total_node, ipaddr: client_ip });  // uuid, { node_id, ipaddr }

    ///////////////
    // Save registered UUID to DB
    clients.insert({ uuid: current_uuid, node_id: total_node, ipaddr: client_ip });

    // Update last online time
    uuid_map.get(current_uuid).last_online = new Date();

    // Success response
    res.statusCode = 200;
    ret.message = "Successfully registered.";
    ret.node_id = total_node;
    ret.active_node = active_node;
    ret.error = 0;
    res.json(ret);

    // Increment node count
    total_node++;
  }

  // Refresh the active node
  check_active_by_heartbeat_timeout();
});

// --------------- Receiving Client heartbeat signal ---------------
app.post('/send_heartbeat', function (req, res) {
  var ret = {};

  // Check if missing UUID
  if (!req.body.hasOwnProperty('uuid')) {
    console.log(getLogTime() + " " + "Error 400: Missing UUID.");

    res.statusCode = 400;
    ret.message = "Error 400: Missing UUID.";
    ret.error = 1;
    res.json(ret);

    return false;
  }

  var current_uuid = req.body.uuid;
  // Check if invalid UUID
  if (!validator.isUUID(current_uuid)) {
    console.log(getLogTime() + " " + "Error 400: Invalid UUID: " + current_uuid);

    res.statusCode = 400;
    ret.message = "Error 400: Invalid UUID.";
    ret.error = 1;
    res.json(ret);

    return false;
  }

  // Container IP
  if (!req.body.hasOwnProperty('ipaddr')) {
    console.log(getLogTime() + " " + "Error 400: Missing IP address.");

    res.statusCode = 400;
    ret.message = "Error 400: Missing IP address.";
    ret.error = 1;
    res.json(ret);

    return false;
  }

  var current_client_ip = req.body.ipaddr;
  if (!validator.isIP(current_client_ip)) {
    console.log(getLogTime() + " " + "Error 400: Invalid IP address: " + current_uuid);

    res.statusCode = 400;
    ret.message = "Error 400: Invalid IP address.";
    ret.error = 1;
    res.json(ret);

    return false;
  }

  // Get client IP address  
  // This IP can be access only from outside of the containers
  var get_remote_ip = req.connection.remoteAddress;

  // Check if this UUID is registered in the network
  if (uuid_map.has(current_uuid)) {
    process.stdout.write(getLogTime() + " " + "Get a heartbeat from Node [" + uuid_map.get(current_uuid).node_id + "] " + current_uuid + "\n\tContainerIP: " + uuid_map.get(current_uuid).ipaddr + " RemoteIP: " + get_remote_ip);

    // Check if IP address has changed
    if (uuid_map.get(current_uuid).ipaddr != current_client_ip) {
      // Change locally
      uuid_map.get(current_uuid).ipaddr = current_client_ip;
      process.stdout.write(" => " + current_client_ip);

      // Change at DB
      clients.findOneAndUpdate({ uuid: current_uuid }, { $set: { ipaddr: current_client_ip } }).then((updatedDoc) => {
        //process.stdout.write(" => " + updatedDoc.ipaddr);
      });
    }

    process.stdout.write("\n");

    // Update last online time
    uuid_map.get(current_uuid).last_online = new Date();

    // Success response
    res.statusCode = 200;
    ret.message = "Great, you are still alive.";
    ret.error = 0;
    res.json(ret);
  }
  // Unregistered UUID
  else {
    process.stdout.write(getLogTime() + " " + "Unregistered heartbeat got from " + current_client_ip + " [" + current_uuid + "]\n");

    res.statusCode = 400;
    ret.message = "This UUID is not registered in the network.";
    ret.error = 1;
    res.json(ret);
  }

  // Refresh the active node
  check_active_by_heartbeat_timeout();
});

process.on('SIGINT', function () {
  console.log(getLogTime() + " " + "Exist..");

  // Closing MongoDB
  db.close();

  process.exit(0);
});





