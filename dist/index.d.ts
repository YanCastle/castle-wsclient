import { RPC } from './rpc';
export declare enum WSClientEvent {
    ReceiveStringError = 0,
    DeocdeError = 1,
    WebSocketError = 2,
    Push = 3,
    Service = 4,
    Move = 5,
    WebSocketConnected = 6,
    WebSocketSended = 7,
    WebSocketClosed = 8,
    WebSocketMessage = 9,
}
export interface RequestOption {
    NeedReply?: Boolean;
    Timeout?: number;
}
export declare enum WSClientError {
    Timeout = "Timeout",
    MaxRequest = "MaxRequest",
}
export default class WSClient {
    protected _ws: WebSocket | any;
    protected _times: number;
    protected _wsurl: string;
    protected _id: number;
    protected _promise: {
        [index: number]: {
            resolve: Function;
            reject: Function;
        };
    };
    protected _address: string;
    protected _server_address: string;
    protected _services: {
        [index: string]: (data: any) => Promise<any>;
    };
    protected _push: {
        [index: string]: (data: any) => Promise<any>;
    };
    protected _waiting: RPC[];
    protected interval: any;
    constructor(wsurl: string, address?: string);
    protected createws(): void;
    protected onopen(): void;
    regist(ServiceName: string, cb: (data: any) => Promise<any>): Promise<void>;
    unregist(ServiceName: string): Promise<void>;
    push(path: string, cb: (data: any) => Promise<any>): Promise<void>;
    unpush(path: string): Promise<void>;
    request(path: string, data?: any, options?: RequestOption): Promise<{}>;
    protected getRequestID(): number;
    protected send(rpc: RPC): void;
    protected resolve(ID: number, data: any): void;
    protected reject(ID: number, data: any): void;
    protected message(data: any): void;
    protected dispatch(event: WSClientEvent, data: any): void;
    protected _event: {
        [index: number]: Function[];
    };
    on(event: WSClientEvent, cb: Function): void;
    destory(): void;
}
