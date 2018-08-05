"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const buffer_1 = require("buffer");
class RPC {
    constructor() {
        this.From = "00000000";
        this.To = "00000000";
        this.NeedReply = true;
        this.Status = true;
        this.Timeout = 0;
        this.ID = 0;
        this.Path = '';
        this.Data = '';
        this.Time = 0;
    }
    encode() {
        if (this.Path.length < 1 && this.Path.length > 31) {
            throw new Error('错误的请求路径');
        }
        let From = this.From.length > 8 ? this.From.substr(0, 8) : this.From.padEnd(8, ' ');
        let To = this.To.length > 8 ? this.To.substr(0, 8) : this.To.padEnd(8, ' ');
        let b = buffer_1.Buffer.alloc(18);
        b[0] |= this.NeedReply ? 0x80 : 0x00;
        b[0] |= this.Status ? 0x40 : 0x00;
        b[0] |= this.Timeout;
        b[1] = this.ID;
        b[2] = this.Path.length;
        let type = getDataType(this.Data);
        b[2] |= (type << 5);
        let sTime = this.Time.toString();
        b[3] |= (this.Type << 4);
        b[3] |= (Number(sTime.substr(0, 1)));
        for (let i = 0; i < 6; i++) {
            b[i + 4] = Number(sTime.toString().substr(i * 2 + 1, 2));
        }
        let data = this.Data;
        if (type == DataType.JSON) {
            data = JSON.stringify(data);
        }
        else if (DataType.Boolean == type) {
            data = data ? 1 : 0;
        }
        data = data.toString();
        return buffer_1.Buffer.concat([
            b,
            buffer_1.Buffer.alloc(8, From, 'ascii'),
            buffer_1.Buffer.alloc(8, To, 'ascii'),
            buffer_1.Buffer.alloc(this.Path.length, this.Path),
            buffer_1.Buffer.alloc(data.length, data)
        ]);
    }
    static decode(b) {
        let t = new RPC();
        t.NeedReply = (b[0] & 0x80) == 0x80;
        t.Status = (b[0] & 0x40) == 0x40;
        t.Timeout = (b[0] & 0x3F);
        t.ID = b[1];
        let c = b[2];
        let dt = c >> 5;
        let len = c & 0x1F;
        t.Type = b[3] >> 4;
        let tTime = [
            b[3] & 0xF
        ];
        for (let i = 0; i < 6; i++) {
            tTime.push(b[i + 4]);
        }
        t.Time = Number(tTime.join(''));
        t.From = b.slice(18, 18 + 6).toString('ascii').trim();
        t.To = b.slice(18 + 6, 18 + 6 + 6).toString('ascii').trim();
        t.Path = b.slice(34, len + 34).toString();
        t.Data = b.slice(34 + len);
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
    if (data instanceof buffer_1.Buffer) {
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