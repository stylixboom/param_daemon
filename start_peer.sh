#!/bin/bash

# # # # # # # # # # # # # # # # # # # #
# Starting peer with parameter client
# Author: Siriwat K.
# Created: 4 August 2016
# # # # # # # # # # # # # # # # # # # #

daemon_ip=$1
daemon_port=$2

if [ -z "$daemon_ip" ]
	then
	daemon_ip=10.128.0.215
fi

if [ -z "$daemon_port" ]
	then
	daemon_port=10101
fi

# Test param
node /param_daemon/client/client.js ${daemon_ip} ${daemon_port} > /ENV || (echo "Failed"; exit)
cat /ENV
# Eval param
eval $(cat /ENV) &&
# Node start
(peer node start &
node /param_daemon/client/send_heartbeat.js ${daemon_ip} ${daemon_port})