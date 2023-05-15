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
exports.verifyNodes = exports.nodeChecker = void 0;
const utils_1 = require("@zombienet/utils");
const metrics_1 = require("../metrics");
const paras_decorators_1 = require("../paras-decorators");
const debug = require("debug")("zombie::helper::verifier");
const nodeChecker = (node) => __awaiter(void 0, void 0, void 0, function* () {
    const metricToQuery = node.para
        ? (0, paras_decorators_1.decorate)(node.para, [metrics_1.getProcessStartTimeKey])[0](node.prometheusPrefix)
        : (0, metrics_1.getProcessStartTimeKey)(node.prometheusPrefix);
    debug(`\t checking node: ${node.name} with prometheusUri: ${node.prometheusUri} - key: ${metricToQuery}`);
    const ready = yield node.getMetric(metricToQuery, "isAtLeast", 1, 60 * 5);
    debug(`\t ${node.name} ready ${ready}`);
    return ready;
});
exports.nodeChecker = nodeChecker;
// Verify that the nodes of the supplied network are up/running.
// To verify that the node is running we use the startProcessTime from
// prometheus server exposed in each node.
// NOTE: some parachains chain the default prefix `substrate`, that why
// we use the `para decorator` here to allow them to set the correct key
// to check.
// IFF one of the nodes is `down` just throw an error to stop the spawn
// process.
// Also, worth noting that we are checking the nodes in `batches` of 10
// at the moment. This value should work ok but we can also optimize later.
function verifyNodes(network) {
    return __awaiter(this, void 0, void 0, function* () {
        // wait until all the node's are up
        const nodeCheckGenerators = Object.values(network.nodesByName).map((node) => {
            return () => (0, exports.nodeChecker)(node);
        });
        const nodesOk = yield (0, utils_1.series)(nodeCheckGenerators, 10);
        if (!nodesOk.every(Boolean))
            throw new Error("At least one of the nodes fails to start");
        debug("All nodes checked ok");
    });
}
exports.verifyNodes = verifyNodes;
