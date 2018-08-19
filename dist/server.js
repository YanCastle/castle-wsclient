"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const rpc_1 = require("./rpc");
const code = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
    'U', 'V', 'W', 'X', 'Y', 'Z', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's',
    't', 'u', 'v', 'w', 'x', 'y', 'z'
];
const codeLen = code.length;
const max = 218340105584896;
class RPCServer {
    constructor(options) {
        this.ClientAddress = 0;
        this.clients = {};
        this.services = {};
        this.debug = false;
        this._promise = {};
    }
    async controller(path, data, rpc, options) {
        return true;
    }
    getClients() {
        return Object.keys(this.clients);
    }
    getClient(ID) {
        return this.clients[ID];
    }
    getServices() {
        return Object.keys(this.services);
    }
    getServicesClients(ServiceName) {
        return this.services[ServiceName] ? Object.keys(this.services[ServiceName]) : [];
    }
    async send(content, options) {
        throw ServerError.UNKONW_SEND;
    }
    async sendTo(ID, content, options) {
        throw ServerError.UNKONW_SEND;
    }
    async message(data, options) {
        let rpc;
        if ('string' == typeof data) {
            rpc = JSON.parse(data);
        }
        else if (data instanceof Buffer) {
            rpc = rpc_1.RPC.decode(data);
        }
        else {
            throw ServerError.UNKNOW_DATA;
        }
        try {
            switch (rpc.Type) {
                case rpc_1.RPCType.Request:
                    try {
                        rpc.Data = await this.controller(rpc.Path, rpc.Data, rpc, options);
                        if (rpc.NeedReply) {
                            rpc.Type = rpc_1.RPCType.Response;
                            rpc.To = rpc.From;
                            rpc.From = '';
                            rpc.NeedReply = false;
                            this.send(rpc.encode(), options);
                        }
                    }
                    catch (e) {
                        rpc.Data = { m: e.message };
                        if (this.debug) {
                            rpc.Data['e'] = e.stack;
                        }
                        rpc.Type = rpc_1.RPCType.Response;
                        rpc.To = rpc.From;
                        rpc.From = '';
                        rpc.NeedReply = false;
                        this.send(rpc.encode(), options);
                    }
                    finally {
                    }
                    break;
                case rpc_1.RPCType.Proxy:
                    break;
                case rpc_1.RPCType.Response:
                    this.resolve(rpc.ID, rpc.Data);
                    break;
                case rpc_1.RPCType.Login:
                    rpc.Data = true;
                    rpc.Type = rpc_1.RPCType.Response;
                    if (this.clients[rpc.From] || rpc.From.replace(/0/g, '').length == 0) {
                        rpc.Status = false;
                        rpc.Data = this.genClientAddress();
                    }
                    else {
                        if (options.ID) {
                            this.close(options);
                        }
                        options.ID = rpc.From;
                        this.clients[rpc.From] = {
                            options,
                            services: []
                        };
                    }
                    rpc.To = rpc.From;
                    rpc.From = '';
                    this.send(rpc.encode(), options);
                    break;
                case rpc_1.RPCType.Regist:
                    if (!this.services[rpc.Path]) {
                        this.services[rpc.Path] = {};
                    }
                    if (rpc.Data) {
                        this.services[rpc.Path][options.ID] = options;
                        this.clients[rpc.From].services.push(rpc.Path);
                    }
                    else {
                        if (this.services[rpc.Path][options.ID])
                            delete this.services[rpc.Path][options.ID];
                        let i = this.clients[rpc.ID].services.indexOf(rpc.Path);
                        if (i > -1) {
                            this.clients[rpc.ID].services.splice(i, 1);
                        }
                    }
                    rpc.From = '';
                    rpc.To = rpc.From;
                    rpc.Type = rpc_1.RPCType.Response;
                    this.send(rpc.encode(), options);
                    break;
            }
        }
        catch (error) {
        }
    }
    genClientAddress() {
        let r = "";
        let o = ++this.ClientAddress;
        while (true) {
            r += o % codeLen;
            if (o > codeLen) {
                o = Math.floor(o / codeLen);
            }
            else {
                if (this.clients[r]) {
                    o = ++this.ClientAddress;
                    if (max < o) {
                        this.ClientAddress = 0;
                        o = 0;
                    }
                }
                else
                    return r;
            }
        }
    }
    async push(to, path, data) {
        if (this.clients[to]) {
            let rpc = new rpc_1.RPC();
            rpc.Type = rpc_1.RPCType.Push;
            rpc.To = to;
            rpc.ID = 0;
            rpc.NeedReply = false;
            rpc.Path = path;
            rpc.Status = true;
            rpc.Data = data;
            this.sendTo(to, rpc.encode(), this.clients[to].options);
        }
        else {
            throw ServerError.NOT_ONLINE;
        }
    }
    async close(ctx) {
        if (ctx.ID && this.clients[ctx.ID]) {
            this.clients[ctx.ID].services.forEach((e) => {
                if (this.services[e][ctx.ID]) {
                    delete this.services[e][ctx.ID];
                }
            });
            delete this.clients[ctx.ID];
        }
    }
    async request(to, path, data, options = {}) {
        if (!this.clients[to]) {
            throw ServerError.NOT_ONLINE;
        }
        let r = new rpc_1.RPC();
        r.Path = path;
        r.Data = data;
        r.From = '';
        r.To = to;
        r.Type = rpc_1.RPCType.Request;
        r.Time = Date.now();
        if (options.Timeout && options.Timeout > 0) {
            r.Timeout = Number(options.Timeout);
            setTimeout(() => {
                this.reject(r.ID, ServerError.TIMEOUT);
            }, options.Timeout);
        }
        this.sendTo(to, r.encode(), this.clients[to].options);
        if (options.NeedReply !== false) {
            r.NeedReply = true;
            return new Promise((resolve, reject) => {
                this._promise[r.ID] = { resolve, reject };
            });
        }
        return true;
    }
    resolve(ID, data) {
        if (this._promise[ID]) {
            this._promise[ID].resolve(data);
            delete this._promise[ID];
        }
    }
    reject(ID, data) {
        if (this._promise[ID]) {
            this._promise[ID].reject(data);
            delete this._promise[ID];
        }
    }
}
exports.RPCServer = RPCServer;
var ServerError;
(function (ServerError) {
    ServerError[ServerError["UNKNOW_DATA"] = 0] = "UNKNOW_DATA";
    ServerError[ServerError["UNKONW_SEND"] = 1] = "UNKONW_SEND";
    ServerError[ServerError["NOT_ONLINE"] = 2] = "NOT_ONLINE";
    ServerError[ServerError["TIMEOUT"] = 3] = "TIMEOUT";
})(ServerError = exports.ServerError || (exports.ServerError = {}));
//# sourceMappingURL=server.js.map