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
exports.genCmd = exports.genCumulusCollatorCmd = void 0;
const utils_1 = require("@zombienet/utils");
const constants_1 = require("./constants");
const types_1 = require("./types");
const debug = require("debug")("zombie::cmdGenerator");
function parseCmdWithArguments(commandWithArgs, useWrapper = true) {
    const parts = commandWithArgs.split(" ");
    let finalCommand = [];
    if (["bash", "ash"].includes(parts[0])) {
        finalCommand.push(parts[0]);
        let partIndex;
        if (parts[1] === "-c") {
            finalCommand.push(parts[1]);
            partIndex = 2;
        }
        else {
            finalCommand.push("-c");
            partIndex = 1;
        }
        finalCommand = [...finalCommand, ...[parts.slice(partIndex).join(" ")]];
    }
    else {
        finalCommand = [commandWithArgs];
        if (useWrapper)
            finalCommand.unshift("/cfg/zombie-wrapper.sh");
    }
    return finalCommand;
}
function genCumulusCollatorCmd(nodeSetup, cfgPath = "/cfg", dataPath = "/data", relayDataPath = "/relay-data", useWrapper = true) {
    return __awaiter(this, void 0, void 0, function* () {
        const { name, chain, parachainId, key, validator, commandWithArgs } = nodeSetup;
        // command with args
        if (commandWithArgs) {
            return parseCmdWithArguments(commandWithArgs, useWrapper);
        }
        const parachainAddedArgs = {
            "--name": true,
            "--collator": true,
            "--base-path": true,
            "--port": true,
            "--ws-port": true,
            "--rpc-port": true,
            "--chain": true,
            "--prometheus-port": true,
        };
        let fullCmd = [
            nodeSetup.command || constants_1.DEFAULT_COMMAND,
            "--name",
            name,
            "--node-key",
            key,
            "--chain",
            `${cfgPath}/${chain}-${parachainId}.json`,
            "--base-path",
            dataPath,
            "--listen-addr",
            `/ip4/0.0.0.0/tcp/${nodeSetup.p2pPort ? nodeSetup.p2pPort : constants_1.P2P_PORT}/ws`,
            "--prometheus-external",
            "--rpc-cors all",
            "--unsafe-rpc-external",
            "--rpc-methods unsafe",
        ];
        if (nodeSetup.substrateCliArgsVersion === types_1.SubstrateCliArgsVersion.V0)
            fullCmd.push("--unsafe-ws-external");
        const portFlags = getPortFlagsByCliArgsVersion(nodeSetup);
        for (const [k, v] of Object.entries(portFlags)) {
            fullCmd.push(...[k, v.toString()]);
        }
        const chainParts = chain.split("_");
        const relayChain = chainParts.length > 1 ? chainParts[chainParts.length - 1] : chainParts[0];
        if (validator)
            fullCmd.push(...["--collator"]);
        const collatorPorts = {
            "--port": 0,
            "--rpc-port": 0,
        };
        if (nodeSetup.args.length > 0) {
            let argsFullNode = null;
            let argsParachain = null;
            const splitIndex = nodeSetup.args.indexOf("--");
            if (splitIndex < 0) {
                argsParachain = nodeSetup.args;
            }
            else {
                argsParachain = nodeSetup.args.slice(0, splitIndex);
                argsFullNode = nodeSetup.args.slice(splitIndex + 1);
            }
            if (argsParachain) {
                for (const arg of argsParachain) {
                    if (parachainAddedArgs[arg])
                        continue;
                    // add
                    debug(`adding ${arg}`);
                    fullCmd.push(arg);
                }
            }
            // Arguments for the relay chain node part of the collator binary.
            fullCmd.push(...[
                "--",
                "--base-path",
                relayDataPath,
                "--chain",
                `${cfgPath}/${relayChain}.json`,
                "--execution wasm",
            ]);
            if (argsFullNode) {
                // Add any additional flags to the CLI
                for (const [index, arg] of argsFullNode.entries()) {
                    if (collatorPorts[arg] >= 0) {
                        // port passed as argument, we need to ensure is not a default one because it will be
                        // use by the parachain part.
                        const selectedPort = parseInt(argsFullNode[index + 1], 10);
                        if ([
                            constants_1.P2P_PORT,
                            constants_1.RPC_HTTP_PORT,
                            constants_1.RPC_WS_PORT,
                            nodeSetup.p2pPort,
                            nodeSetup.rpcPort,
                            nodeSetup.wsPort,
                        ].includes(selectedPort)) {
                            console.log(utils_1.decorators.yellow(`WARN: default port configured, changing to use a random free port`));
                            const randomPort = yield (0, utils_1.getRandomPort)();
                            collatorPorts[arg] = randomPort;
                            argsFullNode[index + 1] = randomPort.toString();
                        }
                    }
                }
                // check ports
                for (const portArg of Object.keys(collatorPorts)) {
                    if (collatorPorts[portArg] === 0) {
                        const randomPort = yield (0, utils_1.getRandomPort)();
                        argsFullNode.push(portArg);
                        argsFullNode.push(randomPort.toString());
                        debug(`Added ${portArg} with value ${randomPort}`);
                    }
                }
                fullCmd = fullCmd.concat(argsFullNode);
                debug(`Added ${argsFullNode} to collator`);
            }
            else {
                // ensure ports
                for (const portArg of Object.keys(collatorPorts)) {
                    if (collatorPorts[portArg] === 0) {
                        const randomPort = yield (0, utils_1.getRandomPort)();
                        fullCmd.push(portArg);
                        fullCmd.push(randomPort.toString());
                        debug(`Added ${portArg} with value ${randomPort}`);
                    }
                }
            }
        }
        else {
            // no args
            // Arguments for the relay chain node part of the collator binary.
            fullCmd.push(...["--", "--chain", `${cfgPath}/${relayChain}.json`, "--execution wasm"]);
            // ensure ports
            for (const portArg of Object.keys(collatorPorts)) {
                if (collatorPorts[portArg] === 0) {
                    const randomPort = yield (0, utils_1.getRandomPort)();
                    fullCmd.push(portArg);
                    fullCmd.push(randomPort.toString());
                    debug(`Added ${portArg} with value ${randomPort}`);
                }
            }
        }
        const resolvedCmd = [fullCmd.join(" ")];
        if (useWrapper)
            resolvedCmd.unshift("/cfg/zombie-wrapper.sh");
        return resolvedCmd;
    });
}
exports.genCumulusCollatorCmd = genCumulusCollatorCmd;
function genCmd(nodeSetup, cfgPath = "/cfg", dataPath = "/data", useWrapper = true) {
    return __awaiter(this, void 0, void 0, function* () {
        const { name, key, chain, commandWithArgs, fullCommand, telemetry, telemetryUrl, prometheus, validator, bootnodes, zombieRole, jaegerUrl, parachainId, } = nodeSetup;
        let { command, args } = nodeSetup;
        // fullCommand is NOT decorated by the `zombie` wrapper
        // and is used internally in init containers.
        if (fullCommand)
            return ["bash", "-c", fullCommand];
        // command with args
        if (commandWithArgs) {
            return parseCmdWithArguments(commandWithArgs, useWrapper);
        }
        if (!command)
            command = constants_1.DEFAULT_COMMAND;
        args = [...args];
        args.push("--no-mdns");
        if (key)
            args.push(...["--node-key", key]);
        if (!telemetry)
            args.push("--no-telemetry");
        else
            args.push(...["--telemetry-url", telemetryUrl]);
        if (prometheus && !args.includes("--prometheus-external"))
            args.push("--prometheus-external");
        if (jaegerUrl && zombieRole === types_1.ZombieRole.Node)
            args.push(...["--jaeger-agent", jaegerUrl]);
        if (validator && !args.includes("--validator"))
            args.push("--validator");
        if (zombieRole === types_1.ZombieRole.Collator && parachainId) {
            const parachainIdArgIndex = args.findIndex((arg) => arg.includes("--parachain-id"));
            args.splice(parachainIdArgIndex, 1);
            args.push(`--parachain-id ${parachainId}`);
        }
        if (bootnodes && bootnodes.length)
            args.push("--bootnodes", bootnodes.join(" "));
        const portFlags = getPortFlagsByCliArgsVersion(nodeSetup);
        for (const [k, v] of Object.entries(portFlags)) {
            args.push(...[k, v.toString()]);
        }
        const listenIndex = args.findIndex((arg) => arg === "--listen-addr");
        if (listenIndex >= 0) {
            const listenAddrParts = args[listenIndex + 1].split("/");
            listenAddrParts[4] = `${nodeSetup.p2pPort}`;
            const listenAddr = listenAddrParts.join("/");
            args[listenIndex + 1] = listenAddr;
        }
        else {
            // no --listen-add args
            args.push(...["--listen-addr", `/ip4/0.0.0.0/tcp/${nodeSetup.p2pPort}/ws`]);
        }
        // set our base path
        const basePathFlagIndex = args.findIndex((arg) => arg === "--base-path");
        if (basePathFlagIndex >= 0)
            args.splice(basePathFlagIndex, 2);
        args.push(...["--base-path", dataPath]);
        if (nodeSetup.substrateCliArgsVersion === types_1.SubstrateCliArgsVersion.V0)
            args.push("--unsafe-ws-external");
        const finalArgs = [
            command,
            "--chain",
            `${cfgPath}/${chain}.json`,
            "--name",
            name,
            "--rpc-cors",
            "all",
            "--unsafe-rpc-external",
            "--rpc-methods",
            "unsafe",
            ...args,
        ];
        const resolvedCmd = [finalArgs.join(" ")];
        if (useWrapper)
            resolvedCmd.unshift("/cfg/zombie-wrapper.sh");
        return resolvedCmd;
    });
}
exports.genCmd = genCmd;
const getPortFlagsByCliArgsVersion = (nodeSetup) => {
    // port flags logic
    const portFlags = {
        "--prometheus-port": (nodeSetup.prometheusPort || constants_1.PROMETHEUS_PORT).toString(),
    };
    if (nodeSetup.substrateCliArgsVersion === types_1.SubstrateCliArgsVersion.V0) {
        portFlags["--rpc-port"] = (nodeSetup.rpcPort || constants_1.RPC_HTTP_PORT).toString();
        portFlags["--ws-port"] = (nodeSetup.wsPort || constants_1.RPC_WS_PORT).toString();
    }
    else {
        // use ws port as default
        const portToUse = nodeSetup.wsPort
            ? nodeSetup.wsPort
            : nodeSetup.rpcPort || constants_1.RPC_HTTP_PORT;
        portFlags["--rpc-port"] = portToUse.toString();
    }
    return portFlags;
};
