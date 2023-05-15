"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PodmanClient = exports.initClient = void 0;
const utils_1 = require("@zombienet/utils");
const execa_1 = __importDefault(require("execa"));
const fs_extra_1 = require("fs-extra");
const path_1 = __importStar(require("path"));
const yaml_1 = __importDefault(require("yaml"));
const constants_1 = require("../../constants");
const client_1 = require("../client");
const dynResourceDefinition_1 = require("./dynResourceDefinition");
const fs = require("fs").promises;
const debug = require("debug")("zombie::podman::client");
function initClient(configPath, namespace, tmpDir) {
    const client = new PodmanClient(configPath, namespace, tmpDir);
    (0, client_1.setClient)(client);
    return client;
}
exports.initClient = initClient;
class PodmanClient extends client_1.Client {
    constructor(configPath, namespace, tmpDir) {
        super(configPath, namespace, tmpDir, "podman", "podman");
        this.podMonitorAvailable = false;
        this.configPath = configPath;
        this.namespace = namespace;
        this.debug = true;
        this.timeout = 30; // secs
        this.tmpDir = tmpDir;
        this.localMagicFilepath = `${tmpDir}/finished.txt`;
        this.remoteDir = constants_1.DEFAULT_REMOTE_DIR;
        this.dataDir = constants_1.DEFAULT_DATA_DIR;
        this.isTearingDown = false;
    }
    validateAccess() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield this.runCommand(["--help"], { scoped: false });
                return result.exitCode === 0;
            }
            catch (e) {
                return false;
            }
        });
    }
    createNamespace() {
        return __awaiter(this, void 0, void 0, function* () {
            const namespaceDef = {
                apiVersion: "v1",
                kind: "Namespace",
                metadata: {
                    name: this.namespace,
                },
            };
            (0, utils_1.writeLocalJsonFile)(this.tmpDir, "namespace", namespaceDef);
            // Podman don't have the namespace concept yet but we use a isolated network
            const args = ["network", "create", this.namespace];
            yield this.runCommand(args, { scoped: false });
            return;
        });
    }
    // start a grafana and prometheus
    staticSetup(settings) {
        return __awaiter(this, void 0, void 0, function* () {
            const prometheusSpec = yield (0, dynResourceDefinition_1.genPrometheusDef)(this.namespace);
            const promPort = prometheusSpec.spec.containers[0].ports[0].hostPort;
            yield this.createResource(prometheusSpec, false, true);
            const listeningIp = settings.local_ip || constants_1.LOCALHOST;
            console.log(`\n\t Monitor: ${utils_1.decorators.green(prometheusSpec.metadata.name)} - url: http://${listeningIp}:${promPort}`);
            const tempoSpec = yield (0, dynResourceDefinition_1.genTempoDef)(this.namespace);
            yield this.createResource(tempoSpec, false, false);
            const tempoPort = tempoSpec.spec.containers[0].ports[1].hostPort;
            console.log(`\n\t Monitor: ${utils_1.decorators.green(tempoSpec.metadata.name)} - url: http://${listeningIp}:${tempoPort}`);
            const prometheusIp = yield this.getNodeIP("prometheus");
            const tempoIp = yield this.getNodeIP("tempo");
            const grafanaSpec = yield (0, dynResourceDefinition_1.genGrafanaDef)(this.namespace, prometheusIp.toString(), tempoIp.toString());
            yield this.createResource(grafanaSpec, false, false);
            const grafanaPort = grafanaSpec.spec.containers[0].ports[0].hostPort;
            console.log(`\n\t Monitor: ${utils_1.decorators.green(grafanaSpec.metadata.name)} - url: http://${listeningIp}:${grafanaPort}`);
        });
    }
    createStaticResource(filename, replacements) {
        return __awaiter(this, void 0, void 0, function* () {
            const filePath = (0, path_1.resolve)(__dirname, `../../../static-configs/${filename}`);
            const fileContent = yield fs.readFile(filePath);
            let resourceDef = fileContent
                .toString("utf-8")
                .replace(new RegExp("{{namespace}}", "g"), this.namespace);
            if (replacements) {
                for (const replacementKey of Object.keys(replacements)) {
                    resourceDef = resourceDef.replace(new RegExp(`{{${replacementKey}}}`, "g"), replacements[replacementKey]);
                }
            }
            const doc = new yaml_1.default.Document(JSON.parse(resourceDef));
            const docInYaml = doc.toString();
            const localFilePath = `${this.tmpDir}/${filename}`;
            yield fs.writeFile(localFilePath, docInYaml);
            yield this.runCommand([
                "play",
                "kube",
                "--network",
                this.namespace,
                localFilePath,
            ]);
        });
    }
    createPodMonitor() {
        return __awaiter(this, void 0, void 0, function* () {
            // NOOP, podman don't have podmonitor.
            return;
        });
    }
    setupCleaner() {
        return __awaiter(this, void 0, void 0, function* () {
            // NOOP, podman don't have cronJobs
            return;
        });
    }
    destroyNamespace() {
        return __awaiter(this, void 0, void 0, function* () {
            this.isTearingDown = true;
            // get pod names
            let args = [
                "pod",
                "ps",
                "-f",
                `label=zombie-ns=${this.namespace}`,
                "--format",
                "{{.Name}}",
            ];
            let result = yield this.runCommand(args, { scoped: false });
            // now remove the pods
            args = ["pod", "rm", "-f", "-i", ...result.stdout.split("\n")];
            result = yield this.runCommand(args, { scoped: false });
            // now remove the pnetwork
            args = ["network", "rm", "-f", this.namespace];
            result = yield this.runCommand(args, { scoped: false });
        });
    }
    addNodeToPrometheus(podName) {
        return __awaiter(this, void 0, void 0, function* () {
            const podIp = yield this.getNodeIP(podName);
            const content = `[{"labels": {"pod": "${podName}"}, "targets": ["${podIp}:${constants_1.PROMETHEUS_PORT}"]}]`;
            yield fs.writeFile(`${this.tmpDir}/prometheus/data/sd_config_${podName}.json`, content);
        });
    }
    getNodeLogs(podName, since = undefined) {
        return __awaiter(this, void 0, void 0, function* () {
            const args = ["logs"];
            if (since && since > 0)
                args.push(...["--since", `${since}s`]);
            args.push(`${podName}_pod-${podName}`);
            const result = yield this.runCommand(args, { scoped: false });
            return result.stdout;
        });
    }
    dumpLogs(path, podName) {
        return __awaiter(this, void 0, void 0, function* () {
            const dstFileName = `${path}/logs/${podName}.log`;
            const logs = yield this.getNodeLogs(podName);
            yield fs.writeFile(dstFileName, logs);
        });
    }
    upsertCronJob() {
        throw new Error("Method not implemented.");
    }
    startPortForwarding(port, identifier) {
        return __awaiter(this, void 0, void 0, function* () {
            const podName = identifier.includes("/")
                ? identifier.split("/")[1]
                : identifier;
            const hostPort = yield this.getPortMapping(port, podName);
            return hostPort;
        });
    }
    getPortMapping(port, podName) {
        return __awaiter(this, void 0, void 0, function* () {
            const args = ["inspect", `${podName}_pod-${podName}`, "--format", "json"];
            const result = yield this.runCommand(args, { scoped: false });
            const resultJson = JSON.parse(result.stdout);
            const hostPort = resultJson[0].NetworkSettings.Ports[`${port}/tcp`][0].HostPort;
            return hostPort;
        });
    }
    getNodeIP(podName) {
        return __awaiter(this, void 0, void 0, function* () {
            const args = ["inspect", `${podName}_pod-${podName}`, "--format", "json"];
            const result = yield this.runCommand(args, { scoped: false });
            const resultJson = JSON.parse(result.stdout);
            const podIp = resultJson[0].NetworkSettings.Networks[this.namespace].IPAddress;
            return podIp;
        });
    }
    getNodeInfo(podName, port, externalView = false) {
        return __awaiter(this, void 0, void 0, function* () {
            let hostIp, hostPort;
            if (externalView) {
                hostPort = yield (port
                    ? this.getPortMapping(port, podName)
                    : this.getPortMapping(constants_1.P2P_PORT, podName));
                hostIp = yield (0, utils_1.getHostIp)();
            }
            else {
                hostIp = yield this.getNodeIP(podName);
                hostPort = port ? port : constants_1.P2P_PORT;
            }
            return [hostIp, hostPort];
        });
    }
    runCommand(args, opts) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const augmentedCmd = [];
                if (opts === null || opts === void 0 ? void 0 : opts.scoped)
                    augmentedCmd.push("--network", this.namespace);
                const finalArgs = [...augmentedCmd, ...args];
                const result = yield (0, execa_1.default)(this.command, finalArgs);
                // podman use stderr for logs
                const stdout = result.stdout !== ""
                    ? result.stdout
                    : result.stderr !== ""
                        ? result.stderr
                        : "";
                return {
                    exitCode: result.exitCode,
                    stdout,
                };
            }
            catch (error) {
                // We prevent previous commands ran to throw error when we are tearing down the network.
                if (!this.isTearingDown) {
                    console.log(`\n ${utils_1.decorators.red("Error: ")} \t ${utils_1.decorators.bright(error)}\n`);
                    throw error;
                }
                return { exitCode: 0, stdout: "" };
            }
        });
    }
    runScript(podName, scriptPath, args = []) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const scriptFileName = path_1.default.basename(scriptPath);
                const scriptPathInPod = `/tmp/${scriptFileName}`;
                const identifier = `${podName}_pod-${podName}`;
                // upload the script
                yield this.runCommand([
                    "cp",
                    scriptPath,
                    `${identifier}:${scriptPathInPod}`,
                ]);
                // set as executable
                const baseArgs = ["exec", identifier];
                yield this.runCommand([...baseArgs, "/bin/chmod", "+x", scriptPathInPod]);
                // exec
                const result = yield this.runCommand([
                    ...baseArgs,
                    "bash",
                    "-c",
                    scriptPathInPod,
                    ...args,
                ]);
                return {
                    exitCode: result.exitCode,
                    stdout: result.stdout,
                };
            }
            catch (error) {
                debug(error);
                throw error;
            }
        });
    }
    spawnFromDef(podDef, filesToCopy = [], keystore, chainSpecId, dbSnapshot) {
        return __awaiter(this, void 0, void 0, function* () {
            const name = podDef.metadata.name;
            let logTable = new utils_1.CreateLogTable({
                colWidths: [25, 100],
            });
            const logs = [
                [utils_1.decorators.cyan("Pod"), utils_1.decorators.green(podDef.metadata.name)],
                [utils_1.decorators.cyan("Status"), utils_1.decorators.green("Launching")],
                [
                    utils_1.decorators.cyan("Command"),
                    utils_1.decorators.white(podDef.spec.containers[0].command.join(" ")),
                ],
            ];
            if (dbSnapshot) {
                logs.push([utils_1.decorators.cyan("DB Snapshot"), utils_1.decorators.green(dbSnapshot)]);
            }
            logTable.pushToPrint(logs);
            // initialize keystore
            const dataPath = podDef.spec.volumes.find((vol) => vol.name === "tmp-data");
            debug("dataPath", dataPath);
            if (dbSnapshot) {
                // we need to get the snapshot from a public access
                // and extract to /data
                yield (0, utils_1.makeDir)(`${dataPath.hostPath.path}/chains`, true);
                yield (0, utils_1.downloadFile)(dbSnapshot, `${dataPath.hostPath.path}/db.tgz`);
                yield (0, execa_1.default)("bash", [
                    "-c",
                    `cd ${dataPath.hostPath.path}/..  && tar -xzvf data/db.tgz`,
                ]);
            }
            if (keystore && chainSpecId) {
                const keystoreRemoteDir = `${dataPath.hostPath.path}/chains/${chainSpecId}/keystore`;
                yield (0, utils_1.makeDir)(keystoreRemoteDir, true);
                const keystoreIsEmpty = (yield fs.readdir(keystoreRemoteDir).length) === 0;
                if (!keystoreIsEmpty)
                    yield this.runCommand(["unshare", "chmod", "-R", "o+w", keystoreRemoteDir], { scoped: false });
                debug("keystoreRemoteDir", keystoreRemoteDir);
                // inject keys
                yield (0, fs_extra_1.copy)(keystore, keystoreRemoteDir);
                debug("keys injected");
            }
            const cfgDirIsEmpty = (yield fs.readdir(`${this.tmpDir}/${name}/cfg`).length) === 0;
            if (!cfgDirIsEmpty && filesToCopy.length) {
                yield this.runCommand(["unshare", "chmod", "-R", "o+w", `${this.tmpDir}/${name}/cfg`], { scoped: false });
            }
            // copy files to volumes
            for (const fileMap of filesToCopy) {
                const { localFilePath, remoteFilePath } = fileMap;
                debug(`copyFile ${localFilePath} to ${this.tmpDir}/${name}${remoteFilePath}`);
                yield fs.cp(localFilePath, `${this.tmpDir}/${name}${remoteFilePath}`);
                debug("copied!");
            }
            yield this.createResource(podDef, false, false);
            yield this.wait_pod_ready(name);
            yield this.addNodeToPrometheus(name);
            logTable = new utils_1.CreateLogTable({
                colWidths: [20, 100],
            });
            logTable.pushToPrint([
                [utils_1.decorators.cyan("Pod"), utils_1.decorators.green(name)],
                [utils_1.decorators.cyan("Status"), utils_1.decorators.green("Ready")],
            ]);
        });
    }
    copyFileFromPod(identifier, podFilePath, localFilePath) {
        return __awaiter(this, void 0, void 0, function* () {
            debug(`cp ${this.tmpDir}/${identifier}${podFilePath}  ${localFilePath}`);
            yield fs.copyFile(`${this.tmpDir}/${identifier}${podFilePath}`, localFilePath);
        });
    }
    putLocalMagicFile() {
        return __awaiter(this, void 0, void 0, function* () {
            // NOOP
            return;
        });
    }
    createResource(resourseDef, scoped, waitReady) {
        return __awaiter(this, void 0, void 0, function* () {
            const name = resourseDef.metadata.name;
            const doc = new yaml_1.default.Document(resourseDef);
            const docInYaml = doc.toString();
            const localFilePath = `${this.tmpDir}/${name}.yaml`;
            yield fs.writeFile(localFilePath, docInYaml);
            yield this.runCommand(["play", "kube", "--network", this.namespace, localFilePath], { scoped: false });
            if (waitReady)
                yield this.wait_pod_ready(name);
        });
    }
    wait_pod_ready(podName, allowDegraded = true) {
        return __awaiter(this, void 0, void 0, function* () {
            // loop until ready
            let t = this.timeout;
            const args = ["pod", "ps", "-f", `name=${podName}`, "--format", "json"];
            do {
                const result = yield this.runCommand(args, { scoped: false });
                const resultJson = JSON.parse(result.stdout);
                if (resultJson[0].Status === "Running")
                    return;
                if (allowDegraded && resultJson[0].Status === "Degraded")
                    return;
                yield new Promise((resolve) => setTimeout(resolve, 3000));
                t -= 3;
            } while (t > 0);
            throw new Error(`Timeout(${this.timeout}) for pod : ${podName}`);
        });
    }
    isPodMonitorAvailable() {
        return __awaiter(this, void 0, void 0, function* () {
            // NOOP
            return false;
        });
    }
    getPauseArgs(name) {
        return [
            "exec",
            `${name}_pod-${name}`,
            "bash",
            "-c",
            "echo pause > /tmp/zombiepipe",
        ];
    }
    getResumeArgs(name) {
        return [
            "exec",
            `${name}_pod-${name}`,
            "bash",
            "-c",
            "echo resume > /tmp/zombiepipe",
        ];
    }
    restartNode(name, timeout) {
        return __awaiter(this, void 0, void 0, function* () {
            const args = ["exec", `${name}_pod-${name}`, "bash", "-c"];
            const cmd = timeout
                ? `echo restart ${timeout} > /tmp/zombiepipe`
                : `echo restart > /tmp/zombiepipe`;
            args.push(cmd);
            const result = yield this.runCommand(args, { scoped: false });
            return result.exitCode === 0;
        });
    }
    spawnIntrospector(wsUri) {
        return __awaiter(this, void 0, void 0, function* () {
            const spec = yield (0, dynResourceDefinition_1.getIntrospectorDef)(this.namespace, wsUri);
            yield this.createResource(spec, false, true);
        });
    }
    getLogsCommand(name) {
        return `podman logs -f ${name}_pod-${name}`;
    }
}
exports.PodmanClient = PodmanClient;
