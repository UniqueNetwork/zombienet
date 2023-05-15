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
exports.getCliArgsVersion = void 0;
const types_1 = require("../../types");
const client_1 = require("../client");
const dynResourceDefinition_1 = require("./dynResourceDefinition");
const getCliArgsVersion = (image, command) => __awaiter(void 0, void 0, void 0, function* () {
    const client = (0, client_1.getClient)();
    // use echo to not finish the pod with error status.
    const fullCmd = `${command} --help | grep ws-port || echo "V1"`;
    const node = yield (0, dynResourceDefinition_1.createTempNodeDef)("temp", image, "", // don't used
    fullCmd, false);
    const podDef = yield (0, dynResourceDefinition_1.genNodeDef)(client.namespace, node);
    const podName = podDef.metadata.name;
    yield client.spawnFromDef(podDef);
    const logs = yield client.getNodeLogs(podName);
    return logs.includes("--ws-port <PORT>")
        ? types_1.SubstrateCliArgsVersion.V0
        : types_1.SubstrateCliArgsVersion.V1;
});
exports.getCliArgsVersion = getCliArgsVersion;
