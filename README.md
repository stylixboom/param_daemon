Param daemon for Hyperledger/Fabric under Docker Swarm
===================

Building a Hyperledger/Fabric infrastructure under a scalable environment like Docker swarm has several problems including the parameter setup for each individual node and connectivity issue between validating peer and its attaching chaincode when running under the swarm hood.

This project aims to bridge this gap at the moment. By trying to be an inter-operator between Docker swarm and the Fabric nodes. With a simple `docker create service`, the provisioning Fabric at the manager node is then possible, also scaling the Fabric node will be end up no problem.

> **Note:** The details of the problem when running Fabric at scale was described [here](hyperledger_under_swarm.pdf).

----------

Requirements
--------
1. Hyperledger/Fabric with parameter daemon [Dockerfiles!](../docker_hyperledger)
2. Docker 1.12.1
3. Weave (https://www.weave.works/install-weave-net)

----------

Architecture
-------

![](https://raw.githubusercontent.com/stylixboom/param_daemon/master/param_daemon_workflow.png)

The architecture of the param_daemon is designed as the following figure. By setting up a parameter server as a node registration point where a parameter client and a peer node running under the same container. When the client node spin up, it asks for the current network state from the param_server. So, the newly spin node will generate its parameters/configurations correctly. In order to keep track of the registered node needs to come back with the same parameters/configurations, we added a simple database at the param_server for restoring the state even when the system went offline.

----------

Network
--------
Generally, Docker swarm use a kind of build-in overlay network for all the containers under its control. At some point, Hyperledger/Fabric need to create "another" container to run the newly deploy chaincode. However, this chaincode container run outside of the swarm, which has no information how to communicate to its "actual" parent under swarm (load balancing will not give a direct access to its origin caused by a round-robin).

We decided to go with [Weave](https://www.weave.works). By attaching all the container to **weave** interface, the connection between both validating peers and its chaincode ends up no problem even though out the swarm border.

![](https://raw.githubusercontent.com/stylixboom/param_daemon/master/param_daemon_network.png)

----------

Usage
--------

1.Start a database for a parameter registration service.
where the DB listening port is **10054**.
```
docker run --rm -it --name=Mongo10054 \
	--net=host \
	-p 10054:10054 \
	stylix/mongo-10054	
```

2.Start a parameter server that connect to DB.
where the server is listening to the port **10101**
and the IP address is of the database, with specified port (*10054*) in the previous step.
```
docker run --rm -it --name=HyParam_server \
	--net=host \
	-p 10101:10101 \
	stylix/hyperledger-param node /param_daemon/server/server.js 10101 10.32.85.114 10054
```

3.Start the validator service using Docker swarm, with PBFT consensus,
where the IP address is of the parameter server, with a specified port (*10101*) in the previous step.
```
docker service create --name=HyMix_pbft \
	--network ingress \
	--publish 5000:5000 \
	--publish 30303:30303 \
	--publish 30304:30304 \
	--publish 31315:31315 \
	--mount type=bind,source=/hyperledger/production,target=/var/hyperledger/production \
	--mount type=bind,source=/var/run/docker.sock,target=/var/run/docker.sock \
	--mount type=bind,source=/hyperledger/chaincode,target=/go/src/chaincode \
	--env CORE_SECURITY_ENABLED=false \
	--env CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE=weave \
	--env CORE_LOGGING_LEVEL=DEBUG \
	--env ROLE=mixed \
	--env CONSEN=pbft \
	--env CORE_PBFT_GENERAL_N=4 \
	--replicas=4 \
	stylix/hyperledger-peer:pbft /start_peer.sh 10.32.85.112 10101
```

4.Deploying/Invoking any transaction is done through load-balancer IP address (swarm manager).

> **Note:** See more example of the service creation in the '[swarm_script.sh](https://github.com/stylixboom/param_daemon/blob/master/swarm_script.sh)'

----------

Author: Siriwat Kasamwattanarote
Email: siriwat@live.jp