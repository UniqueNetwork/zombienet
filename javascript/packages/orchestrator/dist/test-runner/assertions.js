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
const api_1 = require("@polkadot/api");
const utils_1 = require("@zombienet/utils");
const chai_1 = require("chai");
const execa_1 = __importDefault(require("execa"));
const promises_1 = __importDefault(require("fs/promises"));
const jsdom_1 = require("jsdom");
const minimatch_1 = require("minimatch");
const path_1 = __importDefault(require("path"));
const typescript_1 = __importDefault(require("typescript"));
const jsapi_helpers_1 = require("../jsapi-helpers");
const utilCrypto = require("@polkadot/util-crypto");
const DEFAULT_INDIVIDUAL_TEST_TIMEOUT = 10; // seconds
// helper
function toChaiComparator(op) {
    return op.charAt(0).toLocaleLowerCase() + op.slice(1);
}
const comparators = {
    Equal: chai_1.assert.equal,
    NotEqual: chai_1.assert.notEqual,
    IsAbove: chai_1.assert.isAbove,
    IsAtLeast: chai_1.assert.isAtLeast,
    IsBelow: chai_1.assert.isBelow,
    IsAtMost: chai_1.assert.isAtMost,
};
const IsUp = ({ node_name, timeout }) => {
    timeout = timeout || DEFAULT_INDIVIDUAL_TEST_TIMEOUT;
    return (network) => __awaiter(void 0, void 0, void 0, function* () {
        const nodes = network.getNodes(node_name);
        const results = yield Promise.all(nodes.map((node) => node.getMetric("process_start_time_seconds", "isAtLeast", 1, timeout)));
        const AllNodeUps = results.every(Boolean);
        (0, chai_1.expect)(AllNodeUps).to.be.ok;
    });
};
const Report = ({ node_name, metric_name, target_value, op, timeout, }) => {
    const comparatorFn = comparators[op];
    return (network) => __awaiter(void 0, void 0, void 0, function* () {
        const nodes = network.getNodes(node_name);
        const results = yield Promise.all(nodes.map((node) => node.getMetric(metric_name, toChaiComparator(op), target_value, timeout || DEFAULT_INDIVIDUAL_TEST_TIMEOUT)));
        for (const value of results) {
            comparatorFn(value, target_value);
        }
    });
};
const Histogram = ({ node_name, metric_name, target_value, buckets, op, timeout, }) => {
    const comparatorFn = comparators[op];
    return (network) => __awaiter(void 0, void 0, void 0, function* () {
        const nodes = network.getNodes(node_name);
        const results = yield Promise.all(nodes.map((node) => node.getHistogramSamplesInBuckets(metric_name, buckets, target_value, timeout || DEFAULT_INDIVIDUAL_TEST_TIMEOUT)));
        for (const value of results) {
            comparatorFn(value, target_value);
        }
    });
};
const Trace = ({ node_name, span_id, pattern }) => {
    const spanNames = pattern
        .split(",")
        .map((x) => x.replaceAll('"', "").trim());
    return (network) => __awaiter(void 0, void 0, void 0, function* () {
        const nodes = network.getNodes(node_name);
        const results = yield Promise.all(nodes.map((node) => node.getSpansByTraceId(span_id, network.tracing_collator_url)));
        for (const value of results) {
            chai_1.assert.includeOrderedMembers(value, spanNames);
        }
    });
};
const LogMatch = ({ node_name, pattern, match_type, timeout }) => {
    const isGlob = (match_type && match_type.trim() === "glob") || false;
    return (network) => __awaiter(void 0, void 0, void 0, function* () {
        const nodes = network.getNodes(node_name);
        const results = yield Promise.all(nodes.map((node) => node.findPattern(pattern, isGlob, timeout)));
        const found = results.every(Boolean);
        (0, chai_1.expect)(found).to.be.ok;
    });
};
const CountLogMatch = ({ node_name, pattern, match_type, op, target_value, timeout, }) => {
    const comparatorFn = comparators[op];
    const isGlob = (match_type && match_type.trim() === "glob") || false;
    return (network) => __awaiter(void 0, void 0, void 0, function* () {
        const nodes = network.getNodes(node_name);
        const results = yield Promise.all(nodes.map((node) => node.countPatternLines(pattern, isGlob, timeout)));
        for (const value of results) {
            comparatorFn(value, target_value);
        }
    });
};
const SystemEvent = ({ node_name, pattern, match_type, timeout }) => {
    const isGlob = (match_type && match_type.trim() === "glob") || false;
    return (network) => __awaiter(void 0, void 0, void 0, function* () {
        const node = network.node(node_name);
        const api = yield (0, jsapi_helpers_1.connect)(node.wsUri);
        const re = isGlob ? (0, minimatch_1.makeRe)(pattern) : new RegExp(pattern, "ig");
        const found = yield (0, jsapi_helpers_1.findPatternInSystemEventSubscription)(api, re, timeout || DEFAULT_INDIVIDUAL_TEST_TIMEOUT);
        api.disconnect();
        (0, chai_1.expect)(found).to.be.ok;
    });
};
// Customs
const CustomJs = ({ node_name, file_path, custom_args, op, target_value, timeout, is_ts, }) => {
    timeout = timeout || DEFAULT_INDIVIDUAL_TEST_TIMEOUT;
    const comparatorFn = comparators[op];
    return (network, _backchannelMap, configBasePath) => __awaiter(void 0, void 0, void 0, function* () {
        const networkInfo = {
            tmpDir: network.tmpDir,
            chainSpecPath: network.chainSpecFullPath,
            relay: network.relay.map((node) => {
                const { name, wsUri, prometheusUri, userDefinedTypes } = node;
                return { name, wsUri, prometheusUri, userDefinedTypes };
            }),
            paras: Object.keys(network.paras).reduce((memo, paraId) => {
                const { chainSpecPath, wasmPath, statePath } = network.paras[paraId];
                memo[paraId] = { chainSpecPath, wasmPath, statePath };
                memo[paraId].nodes = network.paras[paraId].nodes.map((node) => {
                    return Object.assign({}, node);
                });
                return memo;
            }, {}),
            nodesByName: Object.keys(network.nodesByName).reduce((memo, nodeName) => {
                const { name, wsUri, prometheusUri, userDefinedTypes, parachainId } = network.nodesByName[nodeName];
                memo[nodeName] = { name, wsUri, prometheusUri, userDefinedTypes };
                if (parachainId)
                    memo[nodeName].parachainId = parachainId;
                return memo;
            }, {}),
        };
        const nodes = network.getNodes(node_name);
        const call_args = custom_args
            ? custom_args === ""
                ? []
                : custom_args.split(",")
            : [];
        let resolvedJsFilePath = path_1.default.resolve(configBasePath, file_path);
        if (is_ts) {
            const source = (yield promises_1.default.readFile(resolvedJsFilePath)).toString();
            const result = typescript_1.default.transpileModule(source, {
                compilerOptions: { module: typescript_1.default.ModuleKind.CommonJS },
            });
            resolvedJsFilePath = path_1.default.resolve(configBasePath, path_1.default.parse(file_path).name + ".js");
            yield promises_1.default.writeFile(resolvedJsFilePath, result.outputText);
        }
        // shim with jsdom
        const dom = new jsdom_1.JSDOM("<!doctype html><html><head><meta charset='utf-8'></head><body></body></html>");
        global.window = dom.window;
        global.document = dom.window.document;
        global.zombie = {
            ApiPromise: api_1.ApiPromise,
            Keyring: api_1.Keyring,
            util: utilCrypto,
            connect: jsapi_helpers_1.connect,
            registerParachain: jsapi_helpers_1.registerParachain,
        };
        const jsScript = yield Promise.resolve(`${resolvedJsFilePath}`).then(s => __importStar(require(s)));
        let values;
        try {
            const resp = yield Promise.race([
                Promise.all(nodes.map((node) => jsScript.run(node.name, networkInfo, call_args))),
                new Promise((resolve) => setTimeout(() => {
                    const err = new Error(`Timeout(${timeout}), "custom-js ${file_path} within ${timeout} secs" didn't complete on time.`);
                    return resolve(err);
                }, timeout * 1000)),
            ]);
            if (resp instanceof Error)
                throw new Error(resp);
            else
                values = resp;
        }
        catch (err) {
            console.log(`\n ${utils_1.decorators.red(`Error running script: ${file_path}`)} \t ${utils_1.decorators.bright(err.message)}\n`);
            throw new Error(err);
        }
        // remove shim
        if (is_ts) {
            yield execa_1.default.command(`rm -rf  ${resolvedJsFilePath}`);
        }
        global.window = undefined;
        global.document = undefined;
        global.zombie = undefined;
        if (target_value) {
            for (const value of values) {
                comparatorFn(value, target_value);
            }
        }
        else {
            // test don't have matching output
            (0, chai_1.expect)(true).to.be.ok;
        }
    });
};
const CustomSh = ({ node_name, file_path, custom_args, op, target_value, timeout, }) => {
    timeout = timeout || DEFAULT_INDIVIDUAL_TEST_TIMEOUT;
    const comparatorFn = comparators[op];
    return (network, _backchannelMap, configBasePath) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const resolvedShFilePath = path_1.default.resolve(configBasePath, file_path);
            const nodes = network.getNodes(node_name);
            const call_args = custom_args
                ? custom_args === ""
                    ? []
                    : custom_args.split(",")
                : [];
            const results = yield Promise.all(nodes.map((node) => node.run(resolvedShFilePath, call_args, timeout)));
            if (comparatorFn && target_value !== undefined) {
                for (const value of results) {
                    comparatorFn(value, target_value);
                }
            }
            // all the commands run successfully
            (0, chai_1.expect)(true).to.be.ok;
        }
        catch (err) {
            console.log(`\n ${utils_1.decorators.red(`Error running script: ${file_path}`)} \t ${utils_1.decorators.bright(err.message)}\n`);
            throw new Error(err);
        }
    });
};
// Paras
const ParaIsRegistered = ({ node_name, para_id, timeout }) => {
    return (network) => __awaiter(void 0, void 0, void 0, function* () {
        const nodes = network.getNodes(node_name);
        const results = yield Promise.all(nodes.map((node) => node.parachainIsRegistered(para_id, timeout)));
        const parachainIsRegistered = results.every(Boolean);
        (0, chai_1.expect)(parachainIsRegistered).to.be.ok;
    });
};
const ParaBlockHeight = ({ node_name, para_id, target_value, op, timeout, }) => {
    timeout = timeout || DEFAULT_INDIVIDUAL_TEST_TIMEOUT;
    return (network) => __awaiter(void 0, void 0, void 0, function* () {
        const nodes = network.getNodes(node_name);
        const comparatorFn = comparators[op];
        const results = yield Promise.all(nodes.map((node) => node.parachainBlockHeight(para_id, target_value, timeout)));
        for (const value of results) {
            comparatorFn(value, target_value);
        }
    });
};
const ParaRuntimeUpgrade = ({ node_name, para_id, file_or_uri, timeout, }) => {
    timeout = timeout || DEFAULT_INDIVIDUAL_TEST_TIMEOUT;
    return (network, _backchannelMap, configBasePath) => __awaiter(void 0, void 0, void 0, function* () {
        const node = network.node(node_name);
        let api = yield (0, jsapi_helpers_1.connect)(node.wsUri);
        let hash;
        if ((0, utils_1.isValidHttpUrl)(file_or_uri)) {
            hash = yield (0, jsapi_helpers_1.chainUpgradeFromUrl)(api, file_or_uri);
        }
        else {
            const resolvedJsFilePath = path_1.default.resolve(configBasePath, file_or_uri);
            hash = yield (0, jsapi_helpers_1.chainUpgradeFromLocalFile)(api, resolvedJsFilePath);
        }
        // validate in a node of the relay chain
        api.disconnect();
        const { wsUri, userDefinedTypes } = network.relay[0];
        api = yield (0, jsapi_helpers_1.connect)(wsUri, userDefinedTypes);
        const valid = yield (0, jsapi_helpers_1.validateRuntimeCode)(api, para_id, hash, timeout);
        api.disconnect();
        (0, chai_1.expect)(valid).to.be.ok;
    });
};
const ParaRuntimeDummyUpgrade = ({ node_name, para_id, timeout }) => {
    timeout = timeout || DEFAULT_INDIVIDUAL_TEST_TIMEOUT;
    return (network) => __awaiter(void 0, void 0, void 0, function* () {
        const collator = network.paras[para_id].nodes[0];
        let node = network.node(collator.name);
        let api = yield (0, jsapi_helpers_1.connect)(node.wsUri);
        const hash = yield (0, jsapi_helpers_1.chainCustomSectionUpgrade)(api);
        // validate in the <node>: of the relay chain
        node = network.node(node_name);
        api = yield (0, jsapi_helpers_1.connect)(node.wsUri);
        const valid = yield (0, jsapi_helpers_1.validateRuntimeCode)(api, para_id, hash, timeout);
        api.disconnect();
        (0, chai_1.expect)(valid).to.be.ok;
    });
};
exports.default = {
    IsUp,
    Report,
    Histogram,
    Trace,
    LogMatch,
    CountLogMatch,
    SystemEvent,
    CustomJs,
    CustomSh,
    ParaBlockHeight,
    ParaIsRegistered,
    ParaRuntimeUpgrade,
    ParaRuntimeDummyUpgrade,
};
