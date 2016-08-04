/*
	Parameter server for Hyperledger
	Author: Siriwat K.
	Created: 2 August 2016
*/

var args = process.argv.slice(2);

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
    console.log("Error: Listening port incorrect");
    process.exit();
  }
}

// Body parser
var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));

var server = app.listen(process.env.PORT || LISTENING_PORT, process.env.ADDR || LISTENING_ADDR, function () {
  console.log('Server is listening to %s:%s', server.address().address, server.address().port);
});

// --------------- Hashmap initialize ---------------
var HashMap = require('hashmap');
var uuid_map = new HashMap();

// --------------- MongoDB initialize ---------------
var DB_ADDR = '10.128.0.215';
var DB_PORT = '27017';
var DB_NAME = 'node_registry';

// --------------- MongoDB Parameter ---------------
// Explicit IP
if (args[1]) {
  if (validator.isIP(args[1])) {
    DB_ADDR = args[1];
  }
  else {
    console.log("Error: MongoDB IP address incorrect");
    process.exit();
  }
}
// Explicit PORT
if (args[2]) {
  if (!isNaN(args[2])) {
    DB_PORT = parseInt(args[2]);
  }
  else {
    console.log("Error: MongoDB port incorrect");
    process.exit();
  }
}

var db = require('monk')((DB_ADDR + ":" + DB_PORT + '/' + DB_NAME), function (err) {
  if (err) {
    console.log("Error: Monk connection failed " + DB_ADDR + ":" + DB_PORT + '/' + DB_NAME);
    console.log("Message: " + err);
    process.exit();
  } else {
    console.log("Connected to MongoDB " + DB_ADDR + ":" + DB_PORT + '/' + DB_NAME);
  }
});

const clients = db.get('clients_info');
clients.index('uuid');

// Initialization
var total_node = 0;
clients.count({}, function (err, count) {
  // Error on counting the registered UUIDs
  if (err) {
    console.log(err, count);
    process.exit();
  }
  // Restoring UUID into hashmap
  total_node = count;
  if (total_node) {
    process.stdout.write("Loading " + total_node + " client UUIDs from the database..");

    clients.find({}).each((doc, {close, pause, resume}) => {
      // doc streams here
      uuid_map.set(doc.uuid, doc.node_id); // uuid, node_id
    }).then(() => {
      // final callback
      process.stdout.write("done.\n");
    })
  }
});

// --------------- Registering client UUID ---------------
app.post('/regist', function (req, res) {
  var ret = {};
  // Check missing
  if (!req.body.hasOwnProperty('uuid')) {
    console.log("Error 400: Missing UUID.");

    res.statusCode = 400;
    ret.message = "Error 400: Missing UUID.";
    ret.error = 1;
    return res.json(ret);
  }

  var current_uuid = req.body.uuid;
  // Check invalid
  if (!validator.isUUID(current_uuid)) {
    console.log("Error 400: Invalid UUID: " + current_uuid);

    res.statusCode = 400;
    ret.message = "Error 400: Invalid UUID.";
    ret.error = 1;
    return res.json(ret);
  }

  // --------------- Login ---------------
  if (uuid_map.has(current_uuid)) {
    process.stdout.write("Welcome back node: " + uuid_map.get(current_uuid) + " [" + current_uuid + "]\n");

    // Success response
    res.statusCode = 200;
    ret.message = "Welcome back node: " + current_uuid;
    ret.node_id = uuid_map.get(current_uuid);
    ret.error = 0;
    res.json(ret);
  }
  // --------------- New register ---------------
  else {
    process.stdout.write("Got a register request from " + current_uuid + "\n");

    // Add to hashmap 
    uuid_map.set(current_uuid, total_node);  // uuid, node_id

    ///////////////
    // Save registered UUID to DB
    clients.insert({ uuid: current_uuid, node_id: total_node });

    // Success response
    res.statusCode = 200;
    ret.message = "Successfully registered.";
    ret.node_id = total_node;
    ret.error = 0;
    res.json(ret);

    // Increment node count
    total_node++;
  }
});

process.on('SIGINT', function () {
  console.log("Exist..");

  // Closing MongoDB
  db.close();

  process.exit();
});





