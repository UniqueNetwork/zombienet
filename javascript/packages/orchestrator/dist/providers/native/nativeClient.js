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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NativeClient = exports.initClient = void 0;
const utils_1 = require("@zombienet/utils");
const child_process_1 = require("child_process");
const execa_1 = __importDefault(require("execa"));
const fs_extra_1 = require("fs-extra");
const path_1 = __importDefault(require("path"));
const yaml_1 = __importDefault(require("yaml"));
const constants_1 = require("../../constants");
const types_1 = require("../../types");
const client_1 = require("../client");
const fs = require("fs");
const debug = require("debug")("zombie::native::client");
function initClient(configPath, namespace, tmpDir) {
    const client = new NativeClient(configPath, namespace, tmpDir);
    (0, client_1.setClient)(client);
    return client;
}
exports.initClient = initClient;
class NativeClient extends client_1.Client {
    constructor(configPath, namespace, tmpDir) {
        super(configPath, namespace, tmpDir, "bash", "native");
        this.podMonitorAvailable = false;
        this.configPath = configPath;
        this.namespace = namespace;
        this.debug = true;
        this.timeout = 60; // secs
        this.tmpDir = tmpDir;
        this.localMagicFilepath = `${tmpDir}/finished.txt`;
        this.processMap = {};
        this.remoteDir = `${tmpDir}${constants_1.DEFAULT_REMOTE_DIR}`;
        this.dataDir = `${tmpDir}${constants_1.DEFAULT_DATA_DIR}`;
    }
    validateAccess() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield this.runCommand(["--help"]);
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
            // Native provider don't have the `namespace` isolation.
            // but we create the `remoteDir` to place files
            yield (0, utils_1.makeDir)(this.remoteDir, true);
            return;
        });
    }
    // Podman ONLY support `pods`
    staticSetup() {
        return __awaiter(this, void 0, void 0, function* () {
            return;
        });
    }
    createStaticResource() {
        return __awaiter(this, void 0, void 0, function* () {
            // NOOP, native don't have podmonitor.
            return;
        });
    }
    createPodMonitor() {
        return __awaiter(this, void 0, void 0, function* () {
            // NOOP, native don't have podmonitor.
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
            // get pod names
            const args = ["bash", "-c"];
            const memo = [];
            const pids = Object.keys(this.processMap).reduce((memo, key) => {
                if (this.processMap[key] && this.processMap[key].pid) {
                    const pid = this.processMap[key].pid;
                    if (pid)
                        memo.push(pid.toString());
                }
                return memo;
            }, memo);
            const result = yield this.runCommand(["bash", "-c", `ps ax| awk '{print $1}'| grep -E '${pids.join("|")}'`], { allowFail: true });
            if (result.exitCode === 0) {
                const pidsToKill = result.stdout.split("\n");
                if (pidsToKill.length > 0) {
                    args.push(`kill -9 ${pids.join(" ")}`);
                    yield this.runCommand(args);
                }
            }
        });
    }
    getNodeLogs(name) {
        return __awaiter(this, void 0, void 0, function* () {
            // For now in native let's just return all the logs
            const lines = yield fs.promises.readFile(`${this.tmpDir}/${name}.log`);
            return lines.toString();
        });
    }
    dumpLogs(path, podName) {
        return __awaiter(this, void 0, void 0, function* () {
            const dstFileName = `${path}/logs/${podName}.log`;
            yield fs.promises.copyFile(`${this.tmpDir}/${podName}.log`, dstFileName);
        });
    }
    upsertCronJob() {
        throw new Error("Method not implemented.");
    }
    startPortForwarding(port, identifier) {
        return __awaiter(this, void 0, void 0, function* () {
            const podName = identifier.split("/")[1];
            const hostPort = yield this.getPortMapping(port, podName);
            return hostPort;
        });
    }
    getPortMapping(port, podName) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.processMap[podName].portMapping[port];
        });
    }
    getNodeInfo(podName) {
        return __awaiter(this, void 0, void 0, function* () {
            const hostPort = yield this.getPortMapping(constants_1.P2P_PORT, podName);
            return [constants_1.LOCALHOST, hostPort];
        });
    }
    getNodeIP() {
        return __awaiter(this, void 0, void 0, function* () {
            return constants_1.LOCALHOST;
        });
    }
    runCommand(args, opts) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (args[0] === "bash")
                    args.splice(0, 1);
                debug(args);
                const result = yield (0, execa_1.default)(this.command, args);
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
                debug(error);
                if (!(opts === null || opts === void 0 ? void 0 : opts.allowFail))
                    throw error;
                const { exitCode, stdout, message: errorMsg } = error;
                return {
                    exitCode,
                    stdout,
                    errorMsg,
                };
            }
        });
    }
    runScript(identifier, scriptPath, args = []) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const scriptFileName = path_1.default.basename(scriptPath);
                const scriptPathInPod = `${this.tmpDir}/${identifier}/${scriptFileName}`;
                // upload the script
                yield fs.promises.cp(scriptPath, scriptPathInPod);
                // set as executable
                yield (0, execa_1.default)(this.command, [
                    "-c",
                    ["chmod", "+x", scriptPathInPod].join(" "),
                ]);
                // exec
                const result = yield (0, execa_1.default)(this.command, [
                    "-c",
                    [
                        `cd ${this.tmpDir}/${identifier}`,
                        "&&",
                        scriptPathInPod,
                        ...args,
                    ].join(" "),
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
            debug(JSON.stringify(podDef, null, 4));
            // keep this in the client.
            this.processMap[name] = {
                logs: `${this.tmpDir}/${name}.log`,
                portMapping: podDef.spec.ports.reduce((memo, item) => {
                    memo[item.containerPort] = item.hostPort;
                    return memo;
                }, {}),
            };
            let logTable = new utils_1.CreateLogTable({
                colWidths: [25, 100],
            });
            const logs = [
                [utils_1.decorators.cyan("Pod"), utils_1.decorators.green(name)],
                [utils_1.decorators.cyan("Status"), utils_1.decorators.green("Launching")],
                [
                    utils_1.decorators.cyan("Command"),
                    utils_1.decorators.white(podDef.spec.command.join(" ")),
                ],
            ];
            if (dbSnapshot) {
                logs.push([utils_1.decorators.cyan("DB Snapshot"), utils_1.decorators.green(dbSnapshot)]);
            }
            logTable.pushToPrint(logs);
            if (dbSnapshot) {
                // we need to get the snapshot from a public access
                // and extract to /data
                yield (0, utils_1.makeDir)(`${podDef.spec.dataPath}`, true);
                yield (0, utils_1.downloadFile)(dbSnapshot, `${podDef.spec.dataPath}/db.tgz`);
                yield this.runCommand([
                    "-c",
                    `cd ${podDef.spec.dataPath}/.. && tar -xzvf data/db.tgz`,
                ]);
            }
            if (keystore) {
                // initialize keystore
                const keystoreRemoteDir = `${podDef.spec.dataPath}/chains/${chainSpecId}/keystore`;
                yield (0, utils_1.makeDir)(keystoreRemoteDir, true);
                // inject keys
                yield (0, fs_extra_1.copy)(keystore, keystoreRemoteDir);
            }
            // copy files to volumes
            for (const fileMap of filesToCopy) {
                const { localFilePath, remoteFilePath } = fileMap;
                debug("localFilePath", localFilePath);
                debug("remoteFilePath", remoteFilePath);
                debug("remote dir", this.remoteDir);
                debug("data dir", this.dataDir);
                const resolvedRemoteFilePath = remoteFilePath.includes(this.remoteDir)
                    ? `${podDef.spec.cfgPath}/${remoteFilePath.replace(this.remoteDir, "")}`
                    : `${podDef.spec.dataPath}/${remoteFilePath.replace(this.dataDir, "")}`;
                yield fs.promises.copyFile(localFilePath, resolvedRemoteFilePath);
            }
            yield this.createResource(podDef);
            logTable = new utils_1.CreateLogTable({
                colWidths: [40, 80],
            });
            logTable.pushToPrint([
                [utils_1.decorators.cyan("Pod"), utils_1.decorators.green(name)],
                [utils_1.decorators.cyan("Status"), utils_1.decorators.green("Ready")],
            ]);
        });
    }
    copyFileFromPod(identifier, podFilePath, localFilePath) {
        return __awaiter(this, void 0, void 0, function* () {
            debug(`cp ${podFilePath}  ${localFilePath}`);
            yield fs.promises.copyFile(podFilePath, localFilePath);
        });
    }
    putLocalMagicFile() {
        return __awaiter(this, void 0, void 0, function* () {
            // NOOP
            return;
        });
    }
    createResource(resourseDef) {
        return __awaiter(this, void 0, void 0, function* () {
            const name = resourseDef.metadata.name;
            const doc = new yaml_1.default.Document(resourseDef);
            const docInYaml = doc.toString();
            const localFilePath = `${this.tmpDir}/${name}.yaml`;
            yield fs.promises.writeFile(localFilePath, docInYaml);
            if (resourseDef.metadata.labels["zombie-role"] === types_1.ZombieRole.Temp) {
                yield this.runCommand(resourseDef.spec.command);
            }
            else {
                if (resourseDef.spec.command[0] === "bash")
                    resourseDef.spec.command.splice(0, 1);
                debug(this.command);
                debug(resourseDef.spec.command);
                const log = fs.createWriteStream(this.processMap[name].logs);
                const nodeProcess = (0, child_process_1.spawn)(this.command, ["-c", ...resourseDef.spec.command], { env: Object.assign(Object.assign({}, process.env), resourseDef.spec.env) });
                debug(nodeProcess.pid);
                nodeProcess.stdout.pipe(log);
                nodeProcess.stderr.pipe(log);
                this.processMap[name].pid = nodeProcess.pid;
                this.processMap[name].cmd = resourseDef.spec.command;
                yield this.wait_node_ready(name);
            }
        });
    }
    wait_node_ready(nodeName) {
        return __awaiter(this, void 0, void 0, function* () {
            // check if the process is alive after 1 seconds
            yield (0, utils_1.sleep)(1000);
            const procNodeName = this.processMap[nodeName];
            const { pid, logs } = procNodeName;
            const result = yield this.runCommand(["-c", `ps ${pid}`], {
                allowFail: true,
            });
            if (result.exitCode > 0) {
                const lines = yield this.getNodeLogs(nodeName);
                const logTable = new utils_1.CreateLogTable({
                    colWidths: [20, 100],
                });
                logTable.pushToPrint([
                    [utils_1.decorators.cyan("Pod"), utils_1.decorators.green(nodeName)],
                    [
                        utils_1.decorators.cyan("Status"),
                        utils_1.decorators.reverse(utils_1.decorators.red("Error")),
                    ],
                    [
                        utils_1.decorators.cyan("Message"),
                        utils_1.decorators.white(`Process: ${pid}, for node: ${nodeName} dies.`),
                    ],
                    [utils_1.decorators.cyan("Output"), utils_1.decorators.white(lines)],
                ]);
                // throw
                throw new Error();
            }
            // check log lines grow between 2/6/12 secs
            const lines_1 = yield this.runCommand(["-c", `wc -l ${logs}`]);
            yield (0, utils_1.sleep)(2000);
            const lines_2 = yield this.runCommand(["-c", `wc -l ${logs}`]);
            if (parseInt(lines_2.stdout.trim()) > parseInt(lines_1.stdout.trim()))
                return;
            yield (0, utils_1.sleep)(6000);
            const lines_3 = yield this.runCommand(["-c", `wc -l ${logs}`]);
            if (parseInt(lines_3.stdout.trim()) > parseInt(lines_1.stdout.trim()))
                return;
            yield (0, utils_1.sleep)(12000);
            const lines_4 = yield this.runCommand(["-c", `wc -l ${logs}`]);
            if (parseInt(lines_4.stdout.trim()) > parseInt(lines_1.stdout.trim()))
                return;
            throw new Error(`Log lines of process: ${pid} ( node: ${nodeName} ) doesn't grow, please check logs at ${logs}`);
        });
    }
    isPodMonitorAvailable() {
        return __awaiter(this, void 0, void 0, function* () {
            // NOOP
            return false;
        });
    }
    spawnIntrospector() {
        return __awaiter(this, void 0, void 0, function* () {
            // NOOP
        });
    }
    getPauseArgs(name) {
        return ["-c", `kill -STOP ${this.processMap[name].pid.toString()}`];
    }
    getResumeArgs(name) {
        return ["-c", `kill -CONT ${this.processMap[name].pid.toString()}`];
    }
    restartNode(name, timeout) {
        return __awaiter(this, void 0, void 0, function* () {
            // kill
            const result = yield this.runCommand(["-c", `kill -9 ${this.processMap[name].pid.toString()}`], { allowFail: true });
            if (result.exitCode !== 0)
                return false;
            // sleep
            if (timeout)
                yield (0, utils_1.sleep)(timeout * 1000);
            // start
            const log = fs.createWriteStream(this.processMap[name].logs);
            console.log(["-c", ...this.processMap[name].cmd]);
            const nodeProcess = (0, child_process_1.spawn)(this.command, [
                "-c",
                ...this.processMap[name].cmd,
            ]);
            debug(nodeProcess.pid);
            nodeProcess.stdout.pipe(log);
            nodeProcess.stderr.pipe(log);
            this.processMap[name].pid = nodeProcess.pid;
            yield this.wait_node_ready(name);
            return true;
        });
    }
    getLogsCommand(name) {
        return `tail -f  ${this.tmpDir}/${name}.log`;
    }
}
exports.NativeClient = NativeClient;
