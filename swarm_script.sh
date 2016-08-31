#================= Network =================
docker network create -d overlay hyper_net
weave launch --ipalloc-range=11.32.0.0/12 node01.bc.ssd.dev.fu

#================= Mongo DB =================
docker service create --name=Mongo10054 \
	--network hyper_net \
	--publish 10054:10054 \
	--replicas=1 \
	stylix/mongo-10054

docker run --rm -it --name=Mongo10054 \
	--net=host \
	-p 10054:10054 \
	stylix/mongo-10054	

#================= Server =================
docker service create --name=HyParam_server \
	--network hyper_net \
	--publish 10101:10101 \
	--replicas=1 \
	stylix/hyperledger-param node /param_daemon/server/server.js 10101 `hostname -I | cut -d' ' -f1` 10054

docker run --rm -it --name=HyParam_server \
	--net=host \
	-p 10101:10101 \
	stylix/hyperledger-param node /param_daemon/server/server.js 10101 10.32.85.114 10054

node /hyperledger/param_daemon/server/server.js 10101 10.32.85.114 10054

#================= NOOPS =================
echo "while true; do date; sleep 1; done;" > loop.sh
# Mixed
docker service create --name=HyMix_noops \
	--network hyper_net \
	--publish 5000:5000 \
	--publish 30303:30303 \
	--publish 30304:30304 \
	--publish 31315:31315 \
	--mount type=bind,source=/hyperledger/production,target=/var/hyperledger/production \
	--mount type=bind,source=/var/run/docker.sock,target=/var/run/docker.sock \
	--mount type=bind,source=/hyperledger/chaincode,target=/var/hyperledger/chaincode \
	--mount type=bind,source=/hyperledger/chaincode,target=/go/src/chaincode \
	--env CORE_SECURITY_ENABLED=false \
	--env CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE=weave \
	--env CORE_LOGGING_LEVEL=CRITICAL \
	--env ROLE=mixed \
	--env CONSEN=noops \
	--env no_proxy="`hostname -I | cut -d' ' -f1`,localhost,127.0.0.1" \
	--replicas=4 \
	stylix/hyperledger-peer:noops /start_peer.sh 10.32.85.112 10101
	stylix/hyperledger-peer:noops /start_peer.sh `hostname -I | cut -d' ' -f1` 10101
	#stylix/hyperledger-peer:noops sleep 500000

# Validator
docker service create --name=HyVali_noops \
	--network hyper_net \
	--publish 30303:30303 \
	--publish 30304:30304 \
	--publish 31315:31315 \
	--mount type=bind,source=/hyperledger/production,target=/var/hyperledger/production \
	--mount type=bind,source=/var/run/docker.sock,target=/var/run/docker.sock \
	--mount type=bind,source=/hyperledger/chaincode,target=/var/hyperledger/chaincode \
	--mount type=bind,source=/hyperledger/chaincode,target=/go/src/chaincode \
	--env CORE_SECURITY_ENABLED=false \
	--env CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE=weave \
	--env CORE_LOGGING_LEVEL=CRITICAL \
	--env ROLE=validator \
	--env CONSEN=noops \
	--replicas=4 \
	stylix/hyperledger-peer:noops /start_peer.sh 10.32.85.112 10101
	stylix/hyperledger-peer:noops /start_peer.sh `hostname -I | cut -d' ' -f1` 10101
# REST
docker service create --name=HyRest_noops \
	--network hyper_net \
	--publish 5001:5000 \
	--mount type=bind,source=/hyperledger/production,target=/var/hyperledger/production \
	--mount type=bind,source=/var/run/docker.sock,target=/var/run/docker.sock \
	--mount type=bind,source=/hyperledger/chaincode,target=/var/hyperledger/chaincode \
	--mount type=bind,source=/hyperledger/chaincode,target=/go/src/chaincode \
	--env CORE_SECURITY_ENABLED=false \
	--env CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE=weave \
	--env CORE_LOGGING_LEVEL=CRITICAL \
	--env ROLE=rest \
	--env CONSEN=noops \
	--replicas=1 \
	stylix/hyperledger-peer:noops /start_peer.sh 10.32.85.112 10101
	stylix/hyperledger-peer:noops /start_peer.sh `hostname -I | cut -d' ' -f1` 10101

# Stop service
docker service rm HyVali_noops HyMix_noops HyRest_noops

#================= PBFT =================
# Mixed
docker service create --name=HyMix_pbft \
	--network hyper_net \
	--publish 5000:5000 \
	--publish 30303:30303 \
	--publish 30304:30304 \
	--publish 31315:31315 \
	--mount type=bind,source=/hyperledger/production,target=/var/hyperledger/production \
	--mount type=bind,source=/var/run/docker.sock,target=/var/run/docker.sock \
	--mount type=bind,source=/hyperledger/chaincode,target=/var/hyperledger/chaincode \
	--mount type=bind,source=/hyperledger/chaincode,target=/go/src/chaincode \
	--env CORE_SECURITY_ENABLED=false \
	--env CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE=weave \
	--env CORE_LOGGING_LEVEL=DEBUG \
	--env ROLE=mixed \
	--env CONSEN=pbft \
	--replicas=4 \
	stylix/hyperledger-peer:pbft /start_peer.sh 10.32.85.112 10101

# Validator
docker service create --name=HyVali_pbft \
	--network hyper_net \
	--publish 5000:5000 \
	--publish 30303:30303 \
	--publish 30304:30304 \
	--publish 31315:31315 \
	--mount type=bind,source=/hyperledger/production,target=/var/hyperledger/production \
	--mount type=bind,source=/var/run/docker.sock,target=/var/run/docker.sock \
	--mount type=bind,source=/hyperledger/chaincode,target=/var/hyperledger/chaincode \
	--mount type=bind,source=/hyperledger/chaincode,target=/go/src/chaincode \
	--env CORE_SECURITY_ENABLED=false \
	--env CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE=weave \
	--env CORE_LOGGING_LEVEL=CRITICAL \
	--env ROLE=validator \
	--env CONSEN=pbft \
	--replicas=4 \
	stylix/hyperledger-peer:pbft /start_peer.sh 10.32.85.112 10101
# REST
docker service create --name=HyRest_pbft \
	--network ingress \
	--publish 5000:5000 \
	--mount type=bind,source=/hyperledger/production,target=/var/hyperledger/production \
	--mount type=bind,source=/var/run/docker.sock,target=/var/run/docker.sock \
	--mount type=bind,source=/hyperledger/chaincode,target=/var/hyperledger/chaincode \
	--mount type=bind,source=/hyperledger/chaincode,target=/go/src/chaincode \
	--env CORE_SECURITY_ENABLED=false \
	--env CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE=weave \
	--env CORE_LOGGING_LEVEL=CRITICAL \
	--env ROLE=rest \
	--env CONSEN=pbft \
	--replicas=1 \
	stylix/hyperledger-peer:pbft /start_peer.sh 10.32.85.112 10101

# Stop service
docker service rm HyVali_pbft HyMix_pbft HyRest_pbft

		-v /var/run/docker.sock:/var/run/docker.sock \
		-v /hyperledger/db/${lnode_no}:/var/hyperledger/db \
		-v /hyperledger/production/${lnode_no}:/var/hyperledger/production \
		-v /hyperledger/chaincode:/var/hyperledger/chaincode \
		-v /hyperledger/chaincode:/go/src/chaincode \
		-v /hyperledger/compose:/var/hyperledger/compose \
		-v /hyperledger/compose/net_host_.bashrc:/root/.bashrc \