/// <reference types="node" />
export declare class RPC {
    From: string | any;
    To: string | any;
    NeedReply: boolean;
    Status: boolean;
    Timeout: number;
    ID: number;
    Path: string;
    Type: RPCType;
    Data: Object | string | Buffer;
    Time: number;
    encode(): Buffer;
    static decode(b: Buffer): RPC;
}
export declare enum RPCType {
    Request = 0,
    Response = 1,
    Push = 2,
    Move = 3,
    Proxy = 4,
    Heart = 5,
    Login = 6,
}
export declare enum TimeoutUnit {
    s = 0,
    m = 1,
}
export declare enum DataType {
    Buffer = 0,
    JSON = 1,
    Boolean = 2,
    Number = 3,
    String = 4,
}
export declare function getDataType(data: any): DataType;
