import { fileMap } from "../../types";
import { Client, RunCommandOptions, RunCommandResponse } from "../client";
export declare function initClient(configPath: string, namespace: string, tmpDir: string): PodmanClient;
export declare class PodmanClient extends Client {
    namespace: string;
    chainId?: string;
    configPath: string;
    debug: boolean;
    timeout: number;
    tmpDir: string;
    podMonitorAvailable: boolean;
    localMagicFilepath: string;
    remoteDir: string;
    dataDir: string;
    isTearingDown: boolean;
    constructor(configPath: string, namespace: string, tmpDir: string);
    validateAccess(): Promise<boolean>;
    createNamespace(): Promise<void>;
    staticSetup(settings: any): Promise<void>;
    createStaticResource(filename: string, replacements?: {
        [properyName: string]: string;
    }): Promise<void>;
    createPodMonitor(): Promise<void>;
    setupCleaner(): Promise<void>;
    destroyNamespace(): Promise<void>;
    addNodeToPrometheus(podName: string): Promise<void>;
    getNodeLogs(podName: string, since?: number | undefined): Promise<string>;
    dumpLogs(path: string, podName: string): Promise<void>;
    upsertCronJob(): Promise<void>;
    startPortForwarding(port: number, identifier: string): Promise<number>;
    getPortMapping(port: number, podName: string): Promise<number>;
    getNodeIP(podName: string): Promise<string>;
    getNodeInfo(podName: string, port?: number, externalView?: boolean): Promise<[string, number]>;
    runCommand(args: string[], opts?: RunCommandOptions): Promise<RunCommandResponse>;
    runScript(podName: string, scriptPath: string, args?: string[]): Promise<RunCommandResponse>;
    spawnFromDef(podDef: any, filesToCopy?: fileMap[], keystore?: string, chainSpecId?: string, dbSnapshot?: string): Promise<void>;
    copyFileFromPod(identifier: string, podFilePath: string, localFilePath: string): Promise<void>;
    putLocalMagicFile(): Promise<void>;
    createResource(resourseDef: any, scoped: boolean, waitReady: boolean): Promise<void>;
    wait_pod_ready(podName: string, allowDegraded?: boolean): Promise<void>;
    isPodMonitorAvailable(): Promise<boolean>;
    getPauseArgs(name: string): string[];
    getResumeArgs(name: string): string[];
    restartNode(name: string, timeout: number | null): Promise<boolean>;
    spawnIntrospector(wsUri: string): Promise<void>;
    getLogsCommand(name: string): string;
}
