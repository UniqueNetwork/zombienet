"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceResource = exports.NodeResource = exports.BootNodeResource = void 0;
var bootNodeResource_1 = require("./bootNodeResource");
Object.defineProperty(exports, "BootNodeResource", { enumerable: true, get: function () { return bootNodeResource_1.BootNodeResource; } });
var nodeResource_1 = require("./nodeResource");
Object.defineProperty(exports, "NodeResource", { enumerable: true, get: function () { return nodeResource_1.NodeResource; } });
var serviceResource_1 = require("./serviceResource");
Object.defineProperty(exports, "ServiceResource", { enumerable: true, get: function () { return serviceResource_1.ServiceResource; } });
