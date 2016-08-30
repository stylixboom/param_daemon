/*
	Hyram: Parameter generator for Hyperledger
	Author: Siriwat K.
	Created: 4 August 2016
*/

// Hyram constructor.
var Hyram = function () {

};

// Generating the parameters
Hyram.prototype.gen = function (node_info) {
    // Current IP address
    var container_ipaddr = node_info.container_ipaddr;

    var env_result = "export";

    // Const
    var port_rest = 5000;
    var port_cli = 30304;
    var port_grpc = 30303;
    var port_validator = 31315;

    // Root discovery (append here if not a root node)
    if (node_info.active_node != "") {
        env_result += " CORE_PEER_DISCOVERY_ROOTNODE=";
        var active_node = node_info.active_node.split(",");
        var first_node = true;
        active_node.forEach(function (ipaddr) {
            if (first_node) {
                env_result += ipaddr + ":" + port_grpc;
                first_node = false;
            } else {
                env_result += "," + ipaddr + ":" + port_grpc;
            }
        }, this);
    }

    // CORE
    //" CORE_PEER_ADDRESSAUTODETECT=true" +
    //" CORE_PEER_ADDRESS=" + container_ipaddr + ":" + port_grpc +
    env_result += " CORE_CLI_ADDRESS=0.0.0.0:" + port_cli +
        " CORE_PEER_LISTENADDRESS=0.0.0.0:" + port_grpc +
        " CORE_PEER_ADDRESS=" + container_ipaddr + ":" + port_grpc +
        " CORE_PEER_PORT=" + port_grpc +
        " CORE_PEER_ID=vp" + node_info.node_id +
        " CORE_PEER_SYNC_BLOCKS_CHANNELSIZE=100" +
        " CORE_PEER_SYNC_STATE_SNAPSHOT_CHANNELSIZE=500" +
        " CORE_PEER_SYNC_STATE_DELTAS_CHANNELSIZE=200" +
        " CORE_PEER_FILESYSTEMPATH=/var/hyperledger/production/" + node_info.node_id;

    // Role
    if (node_info.role) {
        switch (node_info.role) {
            case "rest":
                env_result += " CORE_REST_ENABLED=true" +
                    " CORE_PEER_VALIDATOR_ENABLED=false" +
                    " CORE_REST_ADDRESS=0.0.0.0:" + port_rest;
                break;
            case "validator":
                env_result += " CORE_REST_ENABLED=false" +
                    " CORE_PEER_VALIDATOR_ENABLED=true" +
                    " CORE_PEER_VALIDATOR_EVENTS_ADDRESS=0.0.0.0:" + port_validator;
                break;
            case "mixed":
                env_result += " CORE_REST_ENABLED=true" +
                    " CORE_REST_ADDRESS=0.0.0.0:" + port_rest +
                    " CORE_PEER_VALIDATOR_ENABLED=true" +
                    " CORE_PEER_VALIDATOR_EVENTS_ADDRESS=0.0.0.0:" + port_validator;
                break;
            default:
                console.log("Error: Incorrect role specified [" + node_info.role + "]");
                process.exit(1);
                break;
        }
    }

    // Consensus
    if (node_info.consensus) {
        switch (node_info.consensus) {
            case "noops":
                env_result += " CORE_PEER_VALIDATOR_CONSENSUS_PLUGIN=noops" +
                    " CORE_PEER_VALIDATOR_CONSENSUS_BUFFERSIZE=7500" +
                    " CORE_PEER_VALIDATOR_CONSENSUS_EVENTS_BUFFERSIZE=1000" +
                    " CORE_NOOPS_BLOCK_SIZE=1" +
                    " CORE_NOOPS_BLOCK_TIMEOUT=1s";
                break;
            case "pbft":
                env_result += " CORE_PEER_VALIDATOR_CONSENSUS_PLUGIN=pbft" +
                    " CORE_PEER_VALIDATOR_CONSENSUS_BUFFERSIZE=7500" +
                    " CORE_PEER_VALIDATOR_CONSENSUS_EVENTS_BUFFERSIZE=1000" +
                    " CORE_PBFT_GENERAL_MODE=batch";
                break;
            default:
                console.log("Error: Incorrect consensus mode specified [" + node_info.consensus + "]");
                process.exit(1);
                break;
        }
    }

    return env_result;
};

// Export the Hyram constructor from this module.
module.exports = Hyram;

/*

What we need to generate?
OK - PORT_REST="5000"
OK - PORT_CLI="30304"
OK - PORT_GRPC="30303"
OK - PORT_VALIDATOR="31315"
OK - local_address=`hostname -i`
OK if (root)
    -e CORE_PEER_DISCOVERY_ROOTNODE=${node - 1 (previous node)}:${PORT_GRPC} \

OK -e CORE_CLI_ADDRESS=${local_address}:${PORT_CLI} \
OK -e CORE_PEER_LISTENADDRESS=0.0.0.0:${PORT_GRPC} \
OK -e CORE_PEER_ADDRESS=${local_address}:${PORT_GRPC} \
OK -e CORE_PEER_PORT=${PORT_GRPC} \
OK -e CORE_PEER_ID=vp${node} \
OK -e CORE_PEER_SYNC_BLOCKS_CHANNELSIZE=100 \
OK -e CORE_PEER_SYNC_STATE_SNAPSHOT_CHANNELSIZE=500 \
OK -e CORE_PEER_SYNC_STATE_DELTAS_CHANNELSIZE=200
-e CORE_PEER_FILESYSTEMPATH=/hyperledger/production/node

if (rest)
    -e CORE_REST_ENABLED=true \
    -e CORE_PEER_VALIDATOR_ENABLED=false \
    -e CORE_REST_ADDRESS=0.0.0.0:${PORT_REST}

if (validator)
    -e CORE_REST_ENABLED=false \
    -e CORE_PEER_VALIDATOR_ENABLED=true \
    -e CORE_PEER_VALIDATOR_EVENTS_ADDRESS=0.0.0.0:${PORT_VALIDATOR}

if (mixed)
    -e CORE_REST_ENABLED=true \
    -e CORE_REST_ADDRESS=0.0.0.0:${PORT_REST} \
    -e CORE_PEER_VALIDATOR_ENABLED=true \
    -e CORE_PEER_VALIDATOR_EVENTS_ADDRESS=0.0.0.0:${PORT_VALIDATOR}

if (noops)
    -e CORE_PEER_VALIDATOR_CONSENSUS_PLUGIN=noops \
    -e CORE_PEER_VALIDATOR_CONSENSUS_BUFFERSIZE=7500 \
    -e CORE_PEER_VALIDATOR_CONSENSUS_EVENTS_BUFFERSIZE=1000 \
    -e CORE_NOOPS_BLOCK_SIZE=1 \
    -e CORE_NOOPS_BLOCK_TIMEOUT=1s
    image_name="stylix/hyperledger-peer:noops"

if (pbft)
    -e CORE_PEER_VALIDATOR_CONSENSUS_PLUGIN=pbft \
    -e CORE_PEER_VALIDATOR_CONSENSUS_BUFFERSIZE=7500 \
    -e CORE_PEER_VALIDATOR_CONSENSUS_EVENTS_BUFFERSIZE=1000 \
    -e CORE_PBFT_GENERAL_MODE=batch 
    image_name="stylix/hyperledger-peer:pbft"
*/