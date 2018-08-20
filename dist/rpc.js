"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class RPC {
    constructor() {
        this.From = "";
        this.To = "";
        this.NeedReply = true;
        this.Status = true;
        this.Timeout = 0;
        this.ID = 0;
        this.Path = '';
        this.Type = RPCType.Heart;
        this.Data = '';
        this.Time = 0;
    }
    encode() {
        if (this.Path.length > 31) {
            throw new Error('错误的请求路径');
        }
        let From = this.From.length > 8 ? this.From.substr(0, 8) : this.From.padEnd(8, ' ');
        let To = this.To.length > 8 ? this.To.substr(0, 8) : this.To.padEnd(8, ' ');
        let b = Buffer.alloc(19);
        b[0] |= this.NeedReply ? 0x80 : 0x00;
        b[0] |= this.Status ? 0x40 : 0x00;
        b[0] |= this.Timeout;
        b[1] = this.ID;
        b[2] = this.Path.length;
        let type = getDataType(this.Data);
        b[2] |= (type << 5);
        let sTime = this.Time.toString();
        b[3] = this.Type;
        b[4] = Number(sTime.substr(0, 1));
        for (let i = 0; i < 6; i++) {
            b[i + 5] = Number(sTime.toString().substr(i * 2 + 1, 2));
        }
        let data = this.Data;
        if (type == DataType.JSON) {
            data = JSON.stringify(data);
        }
        else if (DataType.Boolean == type) {
            data = data ? 1 : 0;
        }
        data = data.toString();
        return Buffer.concat([
            Buffer.from([0x68]),
            b,
            Buffer.from(From),
            Buffer.from(To),
            Buffer.from(this.Path),
            Buffer.from(data),
            Buffer.from([0x68]),
        ]);
    }
    static decode(b) {
        if (b[0] !== 0x68 || b[b.length - 1] !== 0x68) {
            throw 'ErrorPacket';
        }
        b = b.slice(1, b.length - 1);
        let t = new RPC();
        t.NeedReply = (b[0] & 0x80) == 0x80;
        t.Status = (b[0] & 0x40) == 0x40;
        t.Timeout = (b[0] & 0x3F);
        t.ID = b[1];
        let c = b[2];
        let dt = c >> 5;
        let len = c & 0x1F;
        t.Type = b[3];
        let tTime = [
            b[4] & 0xF
        ];
        for (let i = 0; i < 6; i++) {
            tTime.push(b[i + 5]);
        }
        t.Time = Number(tTime.join(''));
        t.From = b.slice(19, 19 + 8).toString().trim();
        t.To = b.slice(19 + 8, 19 + 8 + 8).toString().trim();
        t.Path = b.slice(35, len + 35).toString();
        t.Data = b.slice(35 + len);
        switch (dt) {
            case DataType.JSON:
                t.Data = JSON.parse(t.Data.toString());
                break;
            case DataType.Boolean:
                t.Data = t.Data.toString() == '1';
                break;
            case DataType.Number:
                t.Data = Number(t.Data.toString());
                break;
            case DataType.String:
                t.Data = t.Data.toString();
                break;
            case DataType.Buffer:
                break;
        }
        return t;
    }
}
exports.RPC = RPC;
var RPCType;
(function (RPCType) {
    RPCType[RPCType["Request"] = 0] = "Request";
    RPCType[RPCType["Response"] = 1] = "Response";
    RPCType[RPCType["Push"] = 2] = "Push";
    RPCType[RPCType["Move"] = 3] = "Move";
    RPCType[RPCType["Proxy"] = 4] = "Proxy";
    RPCType[RPCType["Heart"] = 5] = "Heart";
    RPCType[RPCType["Login"] = 6] = "Login";
    RPCType[RPCType["Regist"] = 7] = "Regist";
    RPCType[RPCType["Pub"] = 8] = "Pub";
    RPCType[RPCType["Sub"] = 9] = "Sub";
    RPCType[RPCType["UnSub"] = 10] = "UnSub";
})(RPCType = exports.RPCType || (exports.RPCType = {}));
var TimeoutUnit;
(function (TimeoutUnit) {
    TimeoutUnit[TimeoutUnit["s"] = 0] = "s";
    TimeoutUnit[TimeoutUnit["m"] = 1] = "m";
})(TimeoutUnit = exports.TimeoutUnit || (exports.TimeoutUnit = {}));
var DataType;
(function (DataType) {
    DataType[DataType["Buffer"] = 0] = "Buffer";
    DataType[DataType["JSON"] = 1] = "JSON";
    DataType[DataType["Boolean"] = 2] = "Boolean";
    DataType[DataType["Number"] = 3] = "Number";
    DataType[DataType["String"] = 4] = "String";
})(DataType = exports.DataType || (exports.DataType = {}));
function getDataType(data) {
    if (data instanceof Buffer) {
        return DataType.Buffer;
    }
    else if ('number' == typeof data) {
        return DataType.Number;
    }
    else if ('boolean' == typeof data) {
        return DataType.Boolean;
    }
    else if ('string' == typeof data) {
        return DataType.String;
    }
    else {
        return DataType.JSON;
    }
}
exports.getDataType = getDataType;
//# sourceMappingURL=rpc.js.map