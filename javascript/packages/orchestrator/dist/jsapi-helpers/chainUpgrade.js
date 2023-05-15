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
exports.validateRuntimeCode = exports.chainCustomSectionUpgrade = exports.chainUpgradeFromLocalFile = exports.chainUpgradeFromUrl = void 0;
const api_1 = require("@polkadot/api");
const util_crypto_1 = require("@polkadot/util-crypto");
const fs_1 = require("fs");
const napi_maybe_compressed_blob_1 = require("napi-maybe-compressed-blob");
const constants_1 = require("../constants");
const debug = require("debug")("zombie::js-helpers::chain-upgrade");
function chainUpgradeFromUrl(api, wasmFileUrl) {
    return __awaiter(this, void 0, void 0, function* () {
        // The filename of the runtime/PVF we want to upgrade to. Usually a file
        // with `.compact.compressed.wasm` extension.
        console.log(`upgrading chain with file from url: ${wasmFileUrl}`);
        const fetchResponse = yield fetch(wasmFileUrl);
        const file = yield fetchResponse.arrayBuffer();
        const buff = Buffer.from(file);
        const hash = (0, util_crypto_1.blake2AsHex)(buff);
        yield performChainUpgrade(api, buff.toString("hex"));
        return hash;
    });
}
exports.chainUpgradeFromUrl = chainUpgradeFromUrl;
function chainUpgradeFromLocalFile(api, filePath) {
    return __awaiter(this, void 0, void 0, function* () {
        // The filename of the runtime/PVF we want to upgrade to. Usually a file
        // with `.compact.compressed.wasm` extension.
        console.log(`upgrading chain with file from path: ${filePath}`);
        const data = yield fs_1.promises.readFile(filePath);
        const buff = Buffer.from(data);
        const hash = (0, util_crypto_1.blake2AsHex)(buff);
        yield performChainUpgrade(api, buff.toString("hex"));
        return hash;
    });
}
exports.chainUpgradeFromLocalFile = chainUpgradeFromLocalFile;
// Add a custom section to the end, re-compress and perform the upgrade of the runtime.
// It's required by the standard that custom sections cannot have any semantic differences
// and can be ignored in the general case.
// The wasm format consists of bunch of sections. Here we just slap a custom section to the end.
function chainCustomSectionUpgrade(api) {
    return __awaiter(this, void 0, void 0, function* () {
        const code = yield api.rpc.state.getStorage(":code");
        const codeHex = code.toString().slice(2);
        const codeBuf = Buffer.from(hexToBytes(codeHex));
        const decompressed = (0, napi_maybe_compressed_blob_1.decompress)(codeBuf);
        // add a custom section
        // Same as echo -n -e "\x00\x07\x05\x64\x75\x6D\x6D\x79\x0A" >> file.wasm
        const customSection = [0x00, 0x07, 0x05, 0x64, 0x75, 0x6d, 0x6d, 0x79, 0x0a];
        const withCustomSectionCode = Buffer.concat([
            decompressed,
            Buffer.from(customSection),
        ]);
        // compress again
        const compressed = (0, napi_maybe_compressed_blob_1.compress)(withCustomSectionCode);
        const hash = (0, util_crypto_1.blake2AsHex)(compressed);
        debug(`New compressed hash : ${hash}`);
        yield performChainUpgrade(api, compressed.toString("hex"));
        return hash;
    });
}
exports.chainCustomSectionUpgrade = chainCustomSectionUpgrade;
function validateRuntimeCode(api, paraId, hash, timeout = constants_1.DEFAULT_INDIVIDUAL_TEST_TIMEOUT) {
    return __awaiter(this, void 0, void 0, function* () {
        const validate = (hash) => __awaiter(this, void 0, void 0, function* () {
            let done;
            while (!done) {
                const currentHash = yield api.query.paras.currentCodeHash(paraId);
                console.log(`parachain ${paraId} current code hash : ${currentHash}`);
                if (hash === currentHash.toString())
                    break;
                // wait 2 secs between checks
                yield new Promise((resolve) => setTimeout(resolve, 2000));
            }
            return true;
        });
        const resp = yield Promise.race([
            validate(hash),
            new Promise((resolve) => setTimeout(() => {
                const err = new Error(`Timeout(${timeout}), "validating the hash of the runtime upgrade`);
                return resolve(err);
            }, timeout * 1000)),
        ]);
        if (resp instanceof Error)
            throw resp;
        return resp;
    });
}
exports.validateRuntimeCode = validateRuntimeCode;
function performChainUpgrade(api, code) {
    return __awaiter(this, void 0, void 0, function* () {
        yield (0, util_crypto_1.cryptoWaitReady)();
        const keyring = new api_1.Keyring({ type: "sr25519" });
        const alice = keyring.addFromUri("//Alice");
        yield new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            const unsub = yield api.tx.sudo
                .sudoUncheckedWeight(api.tx.system.setCodeWithoutChecks(`0x${code}`), {
                refTime: 1,
            })
                .signAndSend(alice, (result) => {
                console.log(`Current status is ${result.status}`);
                if (result.status.isInBlock) {
                    console.log(`Transaction included at blockHash ${result.status.asInBlock}`);
                }
                else if (result.status.isFinalized) {
                    console.log(`Transaction finalized at blockHash ${result.status.asFinalized}`);
                    unsub();
                    return resolve();
                }
                else if (result.isError) {
                    console.log(`Transaction Error`);
                    unsub();
                    return reject();
                }
            });
        }));
    });
}
/// Internal
function hexToBytes(hex) {
    const bytes = [];
    for (let c = 0; c < hex.length; c += 2)
        bytes.push(parseInt(hex.substr(c, 2), 16));
    return bytes;
}
