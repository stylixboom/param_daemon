#!/bin/bash

# # # # # # # # # # # # # # # # # # # #
# Starting peer with parameter client
# Author: Siriwat K.
# Created: 4 August 2016
# # # # # # # # # # # # # # # # # # # #

deamon_ip=$1
deamon_port=$2

if [ -z "$deamon_ip" ]
	then
	deamon_ip=10.128.0.215
fi

if [ -z "$deamon_port" ]
	then
	deamon_port=10101
fi

node /param_daemon/client/client.js ${deamon_ip} ${deamon_port};
peer node start;