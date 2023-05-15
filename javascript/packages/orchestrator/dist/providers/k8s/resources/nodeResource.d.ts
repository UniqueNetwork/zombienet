import { Node } from "../../../types";
import { Container, PodSpec, Volume } from "./types";
export declare class NodeResource {
    protected readonly namespace: string;
    protected readonly nodeSetupConfig: Node;
    constructor(namespace: string, nodeSetupConfig: Node);
    generateSpec(): Promise<PodSpec>;
    private generateVolumes;
    private generateVolumesMounts;
    private generateContainersPorts;
    private generateContainerCommand;
    private generateInitContainers;
    private shouldAddJaegerContainer;
    private generateJaegerContainer;
    private generateContainers;
    private computeZombieRoleLabel;
    protected generatePodSpec(initContainers: Container[], containers: Container[], volumes: Volume[]): PodSpec;
}
