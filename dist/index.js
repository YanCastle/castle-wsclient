"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const rpc_1 = require("./rpc");
const utils_1 = require("./utils");
var WSClientEvent;
(function (WSClientEvent) {
    WSClientEvent[WSClientEvent["ReceiveStringError"] = 0] = "ReceiveStringError";
    WSClientEvent[WSClientEvent["DeocdeError"] = 1] = "DeocdeError";
    WSClientEvent[WSClientEvent["WebSocketError"] = 2] = "WebSocketError";
    WSClientEvent[WSClientEvent["Push"] = 3] = "Push";
    WSClientEvent[WSClientEvent["Service"] = 4] = "Service";
    WSClientEvent[WSClientEvent["Move"] = 5] = "Move";
    WSClientEvent[WSClientEvent["Message"] = 6] = "Message";
    WSClientEvent[WSClientEvent["WebSocketConnected"] = 7] = "WebSocketConnected";
    WSClientEvent[WSClientEvent["WebSocketSended"] = 8] = "WebSocketSended";
    WSClientEvent[WSClientEvent["WebSocketClosed"] = 9] = "WebSocketClosed";
    WSClientEvent[WSClientEvent["WebSocketMessage"] = 10] = "WebSocketMessage";
    WSClientEvent[WSClientEvent["Logined"] = 11] = "Logined";
})(WSClientEvent = exports.WSClientEvent || (exports.WSClientEvent = {}));
var WSClientError;
(function (WSClientError) {
    WSClientError["Timeout"] = "Timeout";
    WSClientError["MaxRequest"] = "MaxRequest";
})(WSClientError = exports.WSClientError || (exports.WSClientError = {}));
class RPCClient {
    constructor(wsurl, address = "", wsInstance = undefined) {
        this._wsInstance = {};
        this._times = 0;
        this._wsurl = "";
        this._wsurls = [];
        this._id = 0;
        this._promise = {};
        this._address = '00000000';
        this._server_address = '00000000';
        this._services = {};
        this._push = {};
        this._waiting = [];
        this.interval = 0;
        this.subscribes = {};
        this._logined = false;
        this._event = {};
        if (wsurl instanceof Array) {
            this._wsurl = wsurl[0];
            this._wsurls = wsurl;
        }
        else {
            this._wsurl = wsurl;
            this._wsurls = [wsurl];
        }
        this._address = address;
        if (wsInstance) {
            this._wsInstance = wsInstance;
        }
        else {
            this._wsInstance = WebSocket;
        }
        let heart = new rpc_1.RPC();
        heart.NeedReply = false;
        heart.Path = '';
        heart.Data = '';
        heart.From = this._address;
        heart.To = this._server_address;
        heart.Type = rpc_1.RPCType.Heart;
        this.interval = setInterval(() => {
            if (this._ws.readyState == this._wsInstance.OPEN && this._logined) {
                this.send(heart);
            }
        }, 240000);
        this.createws();
    }
    get isLogin() { return this._logined; }
    createws() {
        let s = this._wsInstance;
        this._ws = new s(this._wsurl);
        this._ws.binaryType = 'arraybuffer';
        this._ws.onerror = (evt) => {
            this._logined = false;
            this.dispatch(WSClientEvent.WebSocketError, evt);
            setTimeout(() => {
                this.createws();
            }, 5000);
        };
        this._ws.onopen = () => {
            this._times++;
        };
        this._ws.onclose = () => {
            this._logined = false;
            setTimeout(() => {
                this.createws();
            }, 5000);
        };
        this._ws.onopen = () => {
            this.onopen();
        };
        this._ws.onmessage = (evt) => {
            let data = Buffer.from(evt.data);
            this.dispatch(WSClientEvent.WebSocketMessage, data);
            this.message(data);
        };
    }
    async login() {
        if (this._ws.readyState == this._wsInstance.OPEN) {
            try {
                await this.request('', '', { Type: rpc_1.RPCType.Login, NeedReply: true });
                this._logined = true;
                this.dispatch(WSClientEvent.Logined, this._address);
                Object.keys(this._services).forEach((ServiceName) => {
                    this.request(ServiceName, true, { Type: rpc_1.RPCType.Regist, NeedReply: true });
                });
                Object.keys(this.subscribes).forEach((topic) => {
                    this.request('', topic, { Type: rpc_1.RPCType.Sub, NeedReply: true });
                });
                for (let i = 0; i < this._waiting.length; i++) {
                    let rpc = this._waiting.shift();
                    rpc.From = this._address;
                    if (rpc)
                        this.send(rpc);
                }
            }
            catch (address) {
                if ('string' == typeof address) {
                    this._address = address;
                    return await this.login();
                }
                throw address.message;
            }
        }
        else {
            throw 'No Connected';
        }
    }
    onopen() {
        this.login();
    }
    async regist(ServiceName, cb) {
        let rs = await this.request(ServiceName, true, { Type: rpc_1.RPCType.Regist, NeedReply: true });
        if (rs)
            this._services[ServiceName] = cb;
        else
            throw 'Error';
    }
    async unregist(ServiceName) {
        delete this._services[ServiceName];
    }
    async push(path, cb) {
        this._push[path] = cb;
    }
    async unpush(path) {
        delete this._push[path];
    }
    async request(path, data = '', options = {}) {
        let r = new rpc_1.RPC();
        r.Path = path;
        r.Data = data;
        r.ID = this.getRequestID();
        r.From = this._address;
        r.To = this._server_address;
        r.Type = options.Type ? options.Type : rpc_1.RPCType.Request;
        r.Time = Date.now();
        if (options.Timeout && options.Timeout > 0) {
            r.Timeout = Number(options.Timeout);
            setTimeout(() => {
                this.reject(r.ID, new Error(WSClientError.Timeout));
            }, options.Timeout);
        }
        if (options.NeedReply !== false) {
            r.NeedReply = true;
            return new Promise((resolve, reject) => {
                this.send(r);
                this._promise[r.ID] = { resolve, reject };
            });
        }
        this.send(r);
        return true;
    }
    getRequestID() {
        if (Object.keys(this._promise).length == 256) {
            throw new Error(WSClientError.MaxRequest);
        }
        while (true) {
            if (this._id > 255) {
                this._id = 0;
            }
            if (this._promise[this._id]) {
                this._id++;
            }
            else {
                return this._id;
            }
        }
    }
    send(rpc) {
        if (this._ws.readyState == this._wsInstance.OPEN) {
            this._ws.send(rpc.encode());
            this.dispatch(WSClientEvent.WebSocketSended, rpc);
        }
        else {
            this._waiting.push(rpc);
        }
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
    message(data) {
        let rpc;
        if ('string' == typeof data) {
            try {
                rpc = JSON.parse(data);
            }
            catch (error) {
            }
        }
        else {
            try {
                rpc = rpc_1.RPC.decode(data);
            }
            catch (error) {
                console.log(error);
            }
        }
        if (rpc === undefined || rpc.To !== this._address) {
            return;
        }
        this.dispatch(WSClientEvent.Message, rpc);
        switch (rpc.Type) {
            case rpc_1.RPCType.Response:
                if (rpc.Status) {
                    this.resolve(rpc.ID, rpc.Data);
                }
                else {
                    this.reject(rpc.ID, rpc.Data);
                }
                break;
            case rpc_1.RPCType.Request:
                if (this._services[rpc.Path]) {
                    this._services[rpc.Path](rpc.Data).then((rs) => {
                        if (rpc.NeedReply) {
                            rpc.Type = rpc_1.RPCType.Response;
                            rpc.To = rpc.From;
                            rpc.From = this._address;
                            rpc.Time = Date.now();
                            rpc.Data = rs;
                            rpc.Status = true;
                            this.send(rpc);
                        }
                    }).catch((e) => {
                        if (rpc.NeedReply) {
                            rpc.Type = rpc_1.RPCType.Response;
                            rpc.To = rpc.From;
                            rpc.From = this._address;
                            rpc.Time = Date.now();
                            rpc.Data = e;
                            rpc.Status = false;
                            this.send(rpc);
                        }
                    });
                }
                else {
                    if (rpc.NeedReply) {
                        rpc.Type = rpc_1.RPCType.Response;
                        rpc.To = rpc.From;
                        rpc.From = this._address;
                        rpc.Time = Date.now();
                        rpc.Data = 'NoService';
                        rpc.Status = false;
                        this.send(rpc);
                    }
                }
                break;
            case rpc_1.RPCType.Push:
                this.dispatch(WSClientEvent.Push, rpc);
                if (this._push[rpc.Path]) {
                    this._push[rpc.Path](rpc.Data).then((rs) => {
                        if (rpc.NeedReply) {
                            rpc.Type = rpc_1.RPCType.Response;
                            rpc.To = rpc.From;
                            rpc.From = this._address;
                            rpc.Time = Date.now();
                            rpc.Data = rs;
                            rpc.Status = true;
                            this.send(rs);
                        }
                    }).catch((e) => {
                        if (rpc.NeedReply) {
                            rpc.Type = rpc_1.RPCType.Response;
                            rpc.To = rpc.From;
                            rpc.From = this._address;
                            rpc.Time = Date.now();
                            rpc.Data = e;
                            rpc.Status = false;
                            this.send(rpc);
                        }
                    });
                }
                break;
            case rpc_1.RPCType.Move:
                this.dispatch(WSClientEvent.Move, rpc);
                let i = this._wsurls.indexOf(this._wsurl);
                if (i > 0) {
                    this._wsurls.splice(i, 1);
                }
                this._wsurl = rpc.Data.toString();
                this._wsurls.push(this._wsurl);
                this.createws();
                break;
            case rpc_1.RPCType.Pub:
                if (this.subscribes[rpc.Path]) {
                    this.subscribes[rpc.Path].forEach((e) => {
                        e(rpc.Data, rpc.From, rpc.Path);
                    });
                }
                break;
        }
    }
    async subscribe(topic, cb) {
        let Data = [];
        if ('string' == typeof topic && utils_1.checkTopic(topic)) {
            Data = [topic];
        }
        else if (topic instanceof Array) {
            topic.forEach((t) => {
                if (utils_1.checkTopic(t)) {
                    Data.push(t);
                }
            });
        }
        await this.request('', Data, { Type: rpc_1.RPCType.Sub, NeedReply: true });
        Data.forEach((t) => {
            if (!this.subscribes[t]) {
                this.subscribes[t] = [];
            }
            this.subscribes[t].push(cb);
        });
        return true;
    }
    async unsubscribe(topic) {
        let Data = [];
        if ('string' == typeof topic && utils_1.checkTopic(topic)) {
            Data = [topic];
        }
        else if (topic instanceof Array) {
            topic.forEach((t) => {
                if (utils_1.checkTopic(t)) {
                    Data.push(t);
                }
            });
        }
        await this.request('', Data, { Type: rpc_1.RPCType.UnSub, NeedReply: true });
        Data.forEach((t) => {
            if (this.subscribes[t]) {
                delete this.subscribes[t];
            }
        });
        return true;
    }
    async publish(topic, data) {
        return await this.request(topic, data, { Type: rpc_1.RPCType.Pub, NeedReply: true });
    }
    dispatch(event, data) {
        if (this._event[event]) {
            this._event[event].forEach((cb) => {
                cb(data);
            });
        }
    }
    on(event, cb) {
        if (!this._event[event]) {
            this._event[event] = [];
        }
        this._event[event].push(cb);
    }
    destory() {
        clearInterval(this.interval);
    }
}
exports.default = RPCClient;
//# sourceMappingURL=index.js.map