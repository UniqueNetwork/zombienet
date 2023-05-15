"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeResource = void 0;
const cmdGenerator_1 = require("../../../cmdGenerator");
const constants_1 = require("../../../constants");
const types_1 = require("../../../types");
class NodeResource {
    constructor(namespace, nodeSetupConfig) {
        this.namespace = namespace;
        this.nodeSetupConfig = nodeSetupConfig;
    }
    generateSpec() {
        return __awaiter(this, void 0, void 0, function* () {
            const volumes = yield this.generateVolumes();
            const volumeMounts = this.generateVolumesMounts();
            const containersPorts = yield this.generateContainersPorts();
            const initContainers = this.generateInitContainers();
            const containers = yield this.generateContainers(volumeMounts, containersPorts);
            return this.generatePodSpec(initContainers, containers, volumes);
        });
    }
    generateVolumes() {
        return __awaiter(this, void 0, void 0, function* () {
            return [
                { name: "tmp-cfg" },
                { name: "tmp-data" },
                { name: "tmp-relay-data" },
            ];
        });
    }
    generateVolumesMounts() {
        return [
            { name: "tmp-cfg", mountPath: "/cfg", readOnly: false },
            { name: "tmp-data", mountPath: "/data", readOnly: false },
            { name: "tmp-relay-data", mountPath: "/relay-data", readOnly: false },
        ];
    }
    generateContainersPorts() {
        return __awaiter(this, void 0, void 0, function* () {
            return [
                { containerPort: constants_1.PROMETHEUS_PORT, name: "prometheus" },
                { containerPort: constants_1.RPC_HTTP_PORT, name: "rpc-http" },
                { containerPort: constants_1.RPC_WS_PORT, name: "rpc-ws" },
                { containerPort: constants_1.P2P_PORT, name: "p2p" },
            ];
        });
    }
    generateContainerCommand() {
        if (this.nodeSetupConfig.zombieRole === types_1.ZombieRole.CumulusCollator) {
            return (0, cmdGenerator_1.genCumulusCollatorCmd)(this.nodeSetupConfig);
        }
        return (0, cmdGenerator_1.genCmd)(this.nodeSetupConfig);
    }
    generateInitContainers() {
        return [
            {
                name: constants_1.TRANSFER_CONTAINER_NAME,
                image: "docker.io/alpine",
                imagePullPolicy: "Always",
                volumeMounts: [
                    { name: "tmp-cfg", mountPath: "/cfg", readOnly: false },
                    { name: "tmp-data", mountPath: "/data", readOnly: false },
                    { name: "tmp-relay-data", mountPath: "/relay-data", readOnly: false },
                ],
                command: [
                    "ash",
                    "-c",
                    [
                        "wget github.com/moparisthebest/static-curl/releases/download/v7.83.1/curl-amd64 -O /cfg/curl",
                        "echo downloaded",
                        "chmod +x /cfg/curl",
                        "echo chmoded",
                        "wget github.com/uutils/coreutils/releases/download/0.0.17/coreutils-0.0.17-x86_64-unknown-linux-musl.tar.gz -O /cfg/coreutils-0.0.17-x86_64-unknown-linux-musl.tar.gz",
                        "cd /cfg",
                        "tar -xvzf ./coreutils-0.0.17-x86_64-unknown-linux-musl.tar.gz",
                        "cp ./coreutils-0.0.17-x86_64-unknown-linux-musl/coreutils /cfg/coreutils",
                        "chmod +x /cfg/coreutils",
                        "rm -rf ./coreutils-0.0.17-x86_64-unknown-linux-musl",
                        "echo coreutils downloaded",
                        `until [ -f ${constants_1.FINISH_MAGIC_FILE} ]; do echo ${constants_1.TRANSFER_CONTAINER_WAIT_LOG}; sleep 1; done; echo copy files has finished`,
                    ].join(" && "),
                ],
            },
        ];
    }
    shouldAddJaegerContainer() {
        const { zombieRole, jaegerUrl } = this.nodeSetupConfig;
        const isNodeOrCumulusCollator = [
            types_1.ZombieRole.Node,
            types_1.ZombieRole.CumulusCollator,
        ].includes(zombieRole);
        const isJaegerUrlDefined = jaegerUrl && jaegerUrl === "localhost:6831";
        return isNodeOrCumulusCollator && isJaegerUrlDefined;
    }
    generateJaegerContainer() {
        return {
            name: "jaeger-agent",
            image: "jaegertracing/jaeger-agent:1.28.0",
            ports: [
                { containerPort: 5775, protocol: "UDP" },
                { containerPort: 5778, protocol: "TCP" },
                { containerPort: 6831, protocol: "UDP" },
                { containerPort: 6832, protocol: "UDP" },
            ],
            command: [
                "/go/bin/agent-linux",
                "--reporter.type=grpc",
                "--reporter.grpc.host-port=tempo-tempo-distributed-distributor.tempo.svc.cluster.local:14250",
            ],
            resources: {
                limits: { memory: "50M", cpu: "100m" },
                requests: { memory: "50M", cpu: "100m" },
            },
        };
    }
    generateContainers(volumeMounts, ports) {
        return __awaiter(this, void 0, void 0, function* () {
            const { image, name, env, resources } = this.nodeSetupConfig;
            const containers = [
                {
                    image,
                    name,
                    imagePullPolicy: "Always",
                    ports,
                    env,
                    volumeMounts,
                    command: yield this.generateContainerCommand(),
                    resources: resources === null || resources === void 0 ? void 0 : resources.resources,
                },
            ];
            if (this.shouldAddJaegerContainer()) {
                containers.push(this.generateJaegerContainer());
            }
            return containers;
        });
    }
    computeZombieRoleLabel() {
        const { validator, zombieRole } = this.nodeSetupConfig;
        if (zombieRole) {
            return zombieRole;
        }
        return validator ? "authority" : "full-node";
    }
    generatePodSpec(initContainers, containers, volumes) {
        const { name, zombieRole } = this.nodeSetupConfig;
        const zombieRoleLabel = this.computeZombieRoleLabel();
        const restartPolicy = zombieRole === types_1.ZombieRole.Temp ? "Never" : "Always";
        return {
            apiVersion: "v1",
            kind: "Pod",
            metadata: {
                name,
                labels: {
                    "zombie-role": zombieRoleLabel,
                    app: "zombienet",
                    "app.kubernetes.io/name": this.namespace,
                    "app.kubernetes.io/instance": name,
                },
                annotations: {
                    "prometheus.io/scrape": "true",
                    "prometheus.io/port": `${constants_1.PROMETHEUS_PORT}`,
                },
            },
            spec: {
                hostname: name,
                containers,
                initContainers,
                restartPolicy,
                volumes,
                securityContext: {
                    fsGroup: 1000,
                    runAsUser: 1000,
                    runAsGroup: 1000,
                },
            },
        };
    }
}
exports.NodeResource = NodeResource;
