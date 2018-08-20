"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const rpc_1 = require("./rpc");
const utils_1 = require("./utils");
const castle_covert_1 = require("castle-covert");
const max = 218340105584896;
class RPCServer {
    constructor(options) {
        this.ClientAddress = 0;
        this.clients = {};
        this.services = {};
        this.subscribes = {};
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
                    }
                    catch (e) {
                        rpc.Data = { m: e.message };
                        if (this.debug) {
                            rpc.Data['e'] = e.stack;
                        }
                    }
                    finally {
                        if (rpc.NeedReply) {
                            rpc.Type = rpc_1.RPCType.Response;
                            rpc.To = rpc.From;
                            rpc.From = '';
                            rpc.NeedReply = false;
                            this.send(rpc.encode(), options);
                        }
                    }
                    break;
                case rpc_1.RPCType.Proxy:
                    break;
                case rpc_1.RPCType.Response:
                    if (rpc.Status)
                        this.resolve(rpc.ID, rpc.Data);
                    else
                        this.reject(rpc.ID, rpc.Data);
                    break;
                case rpc_1.RPCType.Login:
                    rpc.Data = true;
                    rpc.Type = rpc_1.RPCType.Response;
                    if (this.clients[rpc.From]) {
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
                            services: [],
                            subscribes: []
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
                    rpc.To = rpc.From;
                    rpc.From = '';
                    rpc.Type = rpc_1.RPCType.Response;
                    this.send(rpc.encode(), options);
                    break;
                case rpc_1.RPCType.Pub:
                    let pubs = [];
                    console.log(`From:${rpc.From},ID:${rpc.ID},Data:${rpc.Data}`);
                    Object.keys(this.subscribes).forEach((topic) => {
                        if (new RegExp(topic).test(rpc.Path)) {
                            this.subscribes[topic].forEach((id) => {
                                rpc.To = id;
                                try {
                                    this.sendTo(id, rpc.encode(), options);
                                    pubs.push(id);
                                    console.log(`To:${rpc.To},ID:${rpc.ID},Data:${rpc.Data}`);
                                }
                                catch (error) {
                                }
                            });
                        }
                    });
                    rpc.To = rpc.From;
                    rpc.Data = pubs.length > 100 ? pubs.length : pubs;
                    rpc.Type = rpc_1.RPCType.Response;
                    this.send(rpc.encode(), options);
                    break;
                case rpc_1.RPCType.Sub:
                    try {
                        if ('string' == typeof rpc.Data) {
                            let topic = utils_1.checkTopic(rpc.Data);
                            this.handleSubscribe(rpc.From, topic);
                        }
                        else if (rpc.Data instanceof Array) {
                            rpc.Data.forEach((topic) => {
                                topic = utils_1.checkTopic(topic);
                                this.handleSubscribe(rpc.From, topic);
                            });
                        }
                        else {
                            rpc.Status = false;
                            rpc.Data = 'ErrorTopic';
                        }
                    }
                    catch (error) {
                        rpc.Status = false;
                        rpc.Data = 'ErrorTopic';
                    }
                    finally {
                        rpc.To = rpc.From;
                        rpc.Type = rpc_1.RPCType.Response;
                        this.send(rpc.encode(), options);
                    }
                    break;
                case rpc_1.RPCType.UnSub:
                    try {
                        if ('string' == typeof rpc.Data) {
                            let topic = utils_1.checkTopic(rpc.Data);
                            if (!this.subscribes[topic]) {
                                this.subscribes[topic] = [];
                            }
                            let i = this.subscribes[topic].indexOf(rpc.From);
                            if (i > -1) {
                                this.subscribes[topic].splice(i, 1);
                            }
                        }
                        else if (rpc.Data instanceof Array) {
                            rpc.Data.forEach((topic) => {
                                topic = utils_1.checkTopic(topic);
                                this.handleSubscribe(rpc.From, topic);
                            });
                        }
                        else {
                            rpc.Status = false;
                            rpc.Data = 'ErrorTopic';
                        }
                    }
                    catch (error) {
                        rpc.Status = false;
                        rpc.Data = 'ErrorTopic';
                    }
                    finally {
                        if (rpc.Status) {
                            rpc.Data = '';
                        }
                        rpc.Type = rpc_1.RPCType.Response;
                        this.send(rpc.encode(), options);
                    }
                    break;
            }
        }
        catch (error) {
            if (rpc.NeedReply) {
                rpc.Status = false;
                rpc.Data = error.message;
                rpc.To = rpc.From;
                rpc.From = '';
                this.send(rpc.encode(), options);
            }
        }
    }
    handleSubscribe(ID, topic) {
        if (!this.subscribes[topic]) {
            this.subscribes[topic] = [];
        }
        if (this.subscribes[topic].indexOf(ID) == -1) {
            this.subscribes[topic].push(ID);
            this.clients[ID].subscribes.push(topic);
        }
    }
    genClientAddress() {
        while (true) {
            if (this.clients[castle_covert_1.base_covert(10, 62, this.ClientAddress)]) {
                this.ClientAddress++;
                if (this.ClientAddress > max) {
                    this.ClientAddress = 0;
                }
            }
            else {
                return castle_covert_1.base_covert(10, 62, this.ClientAddress);
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
            this.clients[ctx.ID].subscribes.forEach((e) => {
                let i = this.subscribes[e].indexOf(ctx.ID);
                if (i > -1) {
                    this.subscribes[e].splice(i, 1);
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