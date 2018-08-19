/// <reference types="node" />
import { RPC } from './rpc';
export declare class RPCServer {
    protected ClientAddress: number;
    protected clients: {
        [index: string]: {
            options: any;
            services: string[];
        };
    };
    protected services: {
        [index: string]: {
            [index: string]: any;
        };
    };
    protected debug: boolean;
    constructor(options: {
        debug?: boolean;
    });
    controller(path: string, data: any, rpc: RPC, options: any): Promise<boolean>;
    getClients(): string[];
    getClient(ID: string): {
        options: any;
        services: string[];
    };
    getServices(): string[];
    getServicesClients(ServiceName: string): string[];
    send(content: string | Buffer, options: any): Promise<void>;
    sendTo(ID: string, content: string | Buffer, options: any): Promise<void>;
    message(data: any, options: {
        ID: string;
        [index: string]: any;
    }): Promise<void>;
    protected genClientAddress(): string;
    push(to: string, path: string, data: any): Promise<void>;
    close(ctx: any): Promise<void>;
    request(to: string, path: string, data: any, options?: {
        NeedReply?: Boolean;
        Timeout?: number;
    }): Promise<{}>;
    _promise: {};
    protected resolve(ID: number, data: any): void;
    protected reject(ID: number, data: any): void;
}
export declare enum ServerError {
    UNKNOW_DATA = 0,
    UNKONW_SEND = 1,
    NOT_ONLINE = 2,
    TIMEOUT = 3,
}
