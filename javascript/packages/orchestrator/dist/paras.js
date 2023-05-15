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
exports.generateParachainFiles = void 0;
const utils_1 = require("@zombienet/utils");
const fs_1 = __importDefault(require("fs"));
const chainSpec_1 = __importStar(require("./chainSpec"));
const configGenerator_1 = require("./configGenerator");
const constants_1 = require("./constants");
const paras_decorators_1 = require("./paras-decorators");
const providers_1 = require("./providers");
const client_1 = require("./providers/client");
const types_1 = require("./types");
const debug = require("debug")("zombie::paras");
function generateParachainFiles(namespace, tmpDir, parachainFilesPath, configBasePath, relayChainName, parachain, relayChainSpecIsRaw) {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function* () {
        const [addAuraAuthority, addAuthority, changeGenesisConfig, clearAuthorities, readAndParseChainSpec, specHaveSessionsKeys, getNodeKey, addParaCustom, addCollatorSelection, writeChainSpec,] = (0, paras_decorators_1.decorate)(parachain.para, [
            chainSpec_1.default.addAuraAuthority,
            chainSpec_1.default.addAuthority,
            chainSpec_1.default.changeGenesisConfig,
            chainSpec_1.default.clearAuthorities,
            chainSpec_1.default.readAndParseChainSpec,
            chainSpec_1.default.specHaveSessionsKeys,
            chainSpec_1.default.getNodeKey,
            chainSpec_1.default.addParaCustom,
            chainSpec_1.default.addCollatorSelection,
            chainSpec_1.default.writeChainSpec,
        ]);
        const GENESIS_STATE_FILENAME_WITH_ID = `${constants_1.GENESIS_STATE_FILENAME}-${parachain.id}`;
        const GENESIS_WASM_FILENAME_WITH_ID = `${constants_1.GENESIS_WASM_FILENAME}-${parachain.id}`;
        const stateLocalFilePath = `${parachainFilesPath}/${constants_1.GENESIS_STATE_FILENAME}`;
        const wasmLocalFilePath = `${parachainFilesPath}/${constants_1.GENESIS_WASM_FILENAME}`;
        const client = (0, client_1.getClient)();
        const { setupChainSpec, getChainSpecRaw } = providers_1.Providers.get(client.providerName);
        let chainSpecFullPath;
        const chainName = `${parachain.chain ? parachain.chain + "-" : ""}${parachain.name}-${relayChainName}`;
        const chainSpecFileName = `${chainName}.json`;
        const chainSpecFullPathPlain = `${tmpDir}/${chainName}-plain.json`;
        if (parachain.cumulusBased) {
            // need to create the parachain spec
            // file name template is [para chain-]<para name>-<relay chain>
            const relayChainSpecFullPathPlain = `${tmpDir}/${relayChainName}-plain.json`;
            // Check if the chain-spec file is provided.
            if (parachain.chainSpecPath) {
                debug("parachain chain spec provided");
                yield fs_1.default.promises.copyFile(parachain.chainSpecPath, chainSpecFullPathPlain);
            }
            else {
                debug("creating chain spec plain");
                // create or copy chain spec
                yield setupChainSpec(namespace, {
                    chainSpecPath: parachain.chainSpecPath,
                    chainSpecCommand: `${parachain.collators[0].command} build-spec ${parachain.chain ? "--chain " + parachain.chain : ""} --disable-default-bootnode`,
                    defaultImage: parachain.collators[0].image,
                }, chainName, chainSpecFullPathPlain);
            }
            chainSpecFullPath = `${tmpDir}/${chainSpecFileName}`;
            if (!(yield (0, chainSpec_1.isRawSpec)(chainSpecFullPathPlain))) {
                // fields
                const plainData = readAndParseChainSpec(chainSpecFullPathPlain);
                const relayChainSpec = readAndParseChainSpec(relayChainSpecFullPathPlain);
                if (plainData.para_id)
                    plainData.para_id = parachain.id;
                if (plainData.paraId)
                    plainData.paraId = parachain.id;
                if (plainData.relay_chain)
                    plainData.relay_chain = relayChainSpec.id;
                if ((_b = (_a = plainData.genesis.runtime) === null || _a === void 0 ? void 0 : _a.parachainInfo) === null || _b === void 0 ? void 0 : _b.parachainId)
                    plainData.genesis.runtime.parachainInfo.parachainId = parachain.id;
                writeChainSpec(chainSpecFullPathPlain, plainData);
                // make genesis overrides first.
                if (parachain.genesis)
                    yield changeGenesisConfig(chainSpecFullPathPlain, parachain.genesis);
                // clear auths
                yield clearAuthorities(chainSpecFullPathPlain);
                // Chain spec customization logic
                const addToSession = (node) => __awaiter(this, void 0, void 0, function* () {
                    const key = getNodeKey(node, false);
                    yield addAuthority(chainSpecFullPathPlain, node, key);
                });
                const addToAura = (node) => __awaiter(this, void 0, void 0, function* () {
                    yield addAuraAuthority(chainSpecFullPathPlain, node.name, node.accounts);
                });
                const addAuthFn = specHaveSessionsKeys(plainData)
                    ? addToSession
                    : addToAura;
                for (const node of parachain.collators) {
                    if (node.validator) {
                        yield addAuthFn(node);
                        yield addCollatorSelection(chainSpecFullPathPlain, node);
                        yield addParaCustom(chainSpecFullPathPlain, node);
                    }
                }
                // modify the plain chain spec with any custom commands
                for (const cmd of parachain.chainSpecModifierCommands) {
                    yield (0, chainSpec_1.runCommandWithChainSpec)(chainSpecFullPathPlain, cmd, configBasePath);
                }
                debug("creating chain spec raw");
                // ensure needed file
                if (parachain.chain)
                    fs_1.default.copyFileSync(chainSpecFullPathPlain, `${tmpDir}/${parachain.chain}-${parachain.name}-plain.json`);
                // generate the raw chain spec
                yield getChainSpecRaw(namespace, parachain.collators[0].image, `${parachain.chain ? parachain.chain + "-" : ""}${parachain.name}-${relayChainName}`, parachain.collators[0].command, chainSpecFullPath);
            }
            else {
                console.log(`\n\t\t 🚧 ${utils_1.decorators.yellow(`Chain Spec for paraId ${parachain.id} was set to a file in raw format, can't customize.`)} 🚧`);
                yield fs_1.default.promises.copyFile(chainSpecFullPathPlain, chainSpecFullPath);
            }
            try {
                // ensure the correct para_id
                const paraSpecRaw = readAndParseChainSpec(chainSpecFullPath);
                if (paraSpecRaw.para_id)
                    paraSpecRaw.para_id = parachain.id;
                if (paraSpecRaw.paraId)
                    paraSpecRaw.paraId = parachain.id;
                writeChainSpec(chainSpecFullPath, paraSpecRaw);
            }
            catch (e) {
                if (e.code !== "ERR_FS_FILE_TOO_LARGE")
                    throw e;
                // can't customize para_id
                console.log(`\n\t\t 🚧 ${utils_1.decorators.yellow(`Chain Spec file ${chainSpecFullPath} is TOO LARGE to customize (more than 2G).`)} 🚧`);
            }
            // add spec file to copy to all collators.
            parachain.specPath = chainSpecFullPath;
            // modify the raw chain spec with any custom commands
            for (const cmd of parachain.rawChainSpecModifierCommands) {
                yield (0, chainSpec_1.runCommandWithChainSpec)(chainSpecFullPath, cmd, configBasePath);
            }
        }
        // state and wasm files are only needed:
        // IFF the relaychain is NOT RAW or
        // IFF the relaychain is raw and addToGenesis is false for the parachain
        const stateAndWasmAreNeeded = !(relayChainSpecIsRaw && parachain.addToGenesis);
        // check if we need to create files
        if (stateAndWasmAreNeeded &&
            (parachain.genesisStateGenerator || parachain.genesisWasmGenerator)) {
            const filesToCopyToNodes = [];
            if (parachain.cumulusBased && chainSpecFullPath)
                filesToCopyToNodes.push({
                    localFilePath: chainSpecFullPath,
                    remoteFilePath: `${client.remoteDir}/${chainSpecFileName}`,
                });
            const commands = [];
            if (parachain.genesisStateGenerator) {
                let genesisStateGenerator = parachain.genesisStateGenerator.replace("{{CLIENT_REMOTE_DIR}}", client.remoteDir);
                // cumulus
                if (parachain.cumulusBased) {
                    const chainSpecPathInNode = client.providerName === "native"
                        ? chainSpecFullPath
                        : `${client.remoteDir}/${chainSpecFileName}`;
                    genesisStateGenerator = genesisStateGenerator.replace(" > ", ` --chain ${chainSpecPathInNode} > `);
                }
                commands.push(`${genesisStateGenerator}-${parachain.id}`);
            }
            if (parachain.genesisWasmGenerator) {
                let genesisWasmGenerator = parachain.genesisWasmGenerator.replace("{{CLIENT_REMOTE_DIR}}", client.remoteDir);
                // cumulus
                if (parachain.collators[0].zombieRole === types_1.ZombieRole.CumulusCollator) {
                    const chainSpecPathInNode = client.providerName === "native"
                        ? chainSpecFullPath
                        : `${client.remoteDir}/${chainSpecFileName}`;
                    genesisWasmGenerator = genesisWasmGenerator.replace(" > ", ` --chain ${chainSpecPathInNode} > `);
                }
                commands.push(`${genesisWasmGenerator}-${parachain.id}`);
            }
            // Native provider doesn't need to wait
            if (client.providerName == "kubernetes")
                commands.push(constants_1.K8S_WAIT_UNTIL_SCRIPT_SUFIX);
            else if (client.providerName == "podman")
                commands.push(constants_1.WAIT_UNTIL_SCRIPT_SUFIX);
            const node = {
                name: (0, configGenerator_1.getUniqueName)("temp-collator"),
                validator: false,
                invulnerable: false,
                image: parachain.collators[0].image || constants_1.DEFAULT_COLLATOR_IMAGE,
                fullCommand: commands.join(" && "),
                chain: relayChainName,
                bootnodes: [],
                args: [],
                env: [],
                telemetryUrl: "",
                overrides: [],
                zombieRole: types_1.ZombieRole.Temp,
                p2pPort: yield (0, utils_1.getRandomPort)(),
                wsPort: yield (0, utils_1.getRandomPort)(),
                rpcPort: yield (0, utils_1.getRandomPort)(),
                prometheusPort: yield (0, utils_1.getRandomPort)(),
            };
            const provider = providers_1.Providers.get(client.providerName);
            const podDef = yield provider.genNodeDef(namespace, node);
            const podName = podDef.metadata.name;
            yield client.spawnFromDef(podDef, filesToCopyToNodes);
            if (parachain.genesisStateGenerator) {
                yield client.copyFileFromPod(podDef.metadata.name, `${client.remoteDir}/${GENESIS_STATE_FILENAME_WITH_ID}`, stateLocalFilePath);
            }
            if (parachain.genesisWasmGenerator) {
                yield client.copyFileFromPod(podDef.metadata.name, `${client.remoteDir}/${GENESIS_WASM_FILENAME_WITH_ID}`, wasmLocalFilePath);
            }
            yield client.putLocalMagicFile(podName, podName);
        }
        if (parachain.genesisStatePath) {
            fs_1.default.copyFileSync(parachain.genesisStatePath, stateLocalFilePath);
        }
        if (parachain.genesisWasmPath) {
            fs_1.default.copyFileSync(parachain.genesisWasmPath, wasmLocalFilePath);
        }
        // add paths to para files
        parachain.wasmPath = wasmLocalFilePath;
        parachain.statePath = stateLocalFilePath;
        return;
    });
}
exports.generateParachainFiles = generateParachainFiles;
