import { GenesisNodeKey } from "../chainSpec";
import { Node } from "../types";
declare function generateKeyForNode(nodeName?: string): Promise<any>;
export declare function getNodeKey(node: Node): GenesisNodeKey;
export declare function addCollatorSelection(specPath: string, node: Node): Promise<void>;
declare const _default: {
    getNodeKey: typeof getNodeKey;
    generateKeyForNode: typeof generateKeyForNode;
    addCollatorSelection: typeof addCollatorSelection;
};
export default _default;
