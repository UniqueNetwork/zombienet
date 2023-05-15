import { getChainSpecRaw, setupChainSpec } from "./chainSpec";
import { genBootnodeDef, genNodeDef, replaceNetworkRef } from "./dynResourceDefinition";
import { PodmanClient, initClient } from "./podmanClient";
export declare const provider: {
    PodmanClient: typeof PodmanClient;
    genBootnodeDef: typeof genBootnodeDef;
    genNodeDef: typeof genNodeDef;
    initClient: typeof initClient;
    setupChainSpec: typeof setupChainSpec;
    getChainSpecRaw: typeof getChainSpecRaw;
    replaceNetworkRef: typeof replaceNetworkRef;
    getCliArgsVersion: (image: string, command: string) => Promise<import("../../types").SubstrateCliArgsVersion>;
};
