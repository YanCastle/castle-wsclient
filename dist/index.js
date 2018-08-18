"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const rpc_1 = require("./rpc");
var WSClientEvent;
(function (WSClientEvent) {
    WSClientEvent[WSClientEvent["ReceiveStringError"] = 0] = "ReceiveStringError";
    WSClientEvent[WSClientEvent["DeocdeError"] = 1] = "DeocdeError";
    WSClientEvent[WSClientEvent["WebSocketError"] = 2] = "WebSocketError";
    WSClientEvent[WSClientEvent["Push"] = 3] = "Push";
    WSClientEvent[WSClientEvent["Service"] = 4] = "Service";
    WSClientEvent[WSClientEvent["Move"] = 5] = "Move";
    WSClientEvent[WSClientEvent["WebSocketConnected"] = 6] = "WebSocketConnected";
    WSClientEvent[WSClientEvent["WebSocketSended"] = 7] = "WebSocketSended";
    WSClientEvent[WSClientEvent["WebSocketClosed"] = 8] = "WebSocketClosed";
    WSClientEvent[WSClientEvent["WebSocketMessage"] = 9] = "WebSocketMessage";
})(WSClientEvent = exports.WSClientEvent || (exports.WSClientEvent = {}));
var WSClientError;
(function (WSClientError) {
    WSClientError["Timeout"] = "Timeout";
    WSClientError["MaxRequest"] = "MaxRequest";
})(WSClientError = exports.WSClientError || (exports.WSClientError = {}));
class WSClient {
    constructor(wsurl, address = "", wsInstance = undefined) {
        this._times = 0;
        this._wsurl = "";
        this._id = 0;
        this._promise = {};
        this._address = '00000000';
        this._server_address = '00000000';
        this._services = {};
        this._push = {};
        this._waiting = [];
        this.interval = 0;
        this._event = {};
        this._wsurl = wsurl;
        this._address = address;
        if (wsInstance) {
            this._wsInstance = wsInstance;
        }
        let heart = new rpc_1.RPC();
        heart.NeedReply = false;
        heart.Path = '';
        heart.Data = '';
        heart.From = this._address;
        heart.To = this._server_address;
        heart.Type = rpc_1.RPCType.Heart;
        this.interval = setInterval(() => {
            if (this._ws.readyState == this._wsInstance.OPEN) {
                this.send(heart);
            }
        }, 240000);
        this.createws();
    }
    createws() {
        this._ws = this._wsInstance(this._wsurl);
        this._ws.binaryType = 'arraybuffer';
        this._ws.onerror = (evt) => {
            this.dispatch(WSClientEvent.WebSocketError, evt);
            setTimeout(() => {
                this.createws();
            }, 5000);
        };
        this._ws.onopen = () => {
            this._times++;
        };
        this._ws.onclose = () => {
            setTimeout(() => {
                this.createws();
            }, 5000);
        };
        this._ws.onopen = () => {
            this.onopen();
        };
        this._ws.onmessage = (evt) => {
            let data = new Buffer(evt.data);
            this.dispatch(WSClientEvent.WebSocketMessage, data);
            this.message(data);
        };
    }
    login() {
        if (this._ws.readyState == this._wsInstance.OPEN) {
            let login = new rpc_1.RPC();
            login.NeedReply = false;
            login.Path = '';
            login.Data = '';
            login.From = this._address;
            login.To = this._server_address;
            login.Type = rpc_1.RPCType.Login;
            this.send(login);
            this.dispatch(WSClientEvent.WebSocketConnected, {});
            for (let i = 0; i < this._waiting.length; i++) {
                let rpc = this._waiting.shift();
                if (rpc)
                    this.send(rpc);
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
        this._services[ServiceName] = cb;
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
        r.Type = rpc_1.RPCType.Request;
        r.Time = Date.now();
        if (options.Timeout && options.Timeout > 0) {
            r.Timeout = Number(options.Timeout);
            setTimeout(() => {
                this.reject(r.ID, new Error(WSClientError.Timeout));
            }, options.Timeout);
        }
        if (options.NeedReply === true || options.NeedReply === undefined) {
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
        if (rpc === undefined) {
            return;
        }
        if (rpc.Type == rpc_1.RPCType.Response) {
            if (rpc.Status) {
                this.resolve(rpc.ID, rpc.Data);
            }
            else {
                this.reject(rpc.ID, rpc.Data);
            }
        }
        else if (rpc_1.RPCType.Request == rpc.Type) {
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
        }
        else if (rpc_1.RPCType.Push == rpc.Type) {
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
        }
        else if (rpc_1.RPCType.Move == rpc.Type) {
            this.dispatch(WSClientEvent.Move, rpc);
            this._wsurl = rpc.Data.toString();
            this.createws();
        }
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
exports.default = WSClient;
//# sourceMappingURL=index.js.map