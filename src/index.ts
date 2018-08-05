import { RPC, RPCType } from './rpc';
export enum WSClientEvent {
    ReceiveStringError,
    DeocdeError,
    WebSocketError,
    Push,
    Service,
    Move,
    WebSocketConnected,
    WebSocketSended,
    WebSocketClosed,
    WebSocketMessage,
}
export interface RequestOption {
    NeedReply?: Boolean,
    Timeout?: number
}
export enum WSClientError {
    Timeout = 'Timeout',
    MaxRequest = 'MaxRequest'
}
export default class WSClient {
    protected _ws: WebSocket;
    protected _times: number = 0;
    protected _wsurl: string = "";
    protected _id: number = 0;
    protected _promise: { [index: number]: { resolve: Function, reject: Function } } = {}
    //客户识别号
    protected _address: string = '00000000'
    //服务器识别号
    protected _server_address: string = '00000000'
    protected _services: { [index: string]: (data: any) => Promise<any> } = {}
    protected _push: { [index: string]: (data: any) => Promise<any> } = {}
    protected _waiting: RPC[] = [];
    protected interval: number = 0;
    /**
     * 构造函数
     * @param wsurl 
     * @param address 
     */
    constructor(wsurl: string, address: string = "") {
        this._wsurl = wsurl;
        this._address = address;
        this.createws();
        let heart = new RPC()
        heart.NeedReply = false;
        heart.Path = 'heart'
        heart.Data = ''
        heart.From = this._address
        heart.To = this._server_address
        heart.Type = RPCType.Heart
        this.interval = setInterval(() => {
            if (this._ws.readyState == WebSocket.OPEN) {
                this.send(heart)
            }
        }, 240000)
    }

    /**
     * 创建连接
     */
    protected createws() {
        this._ws = new WebSocket(this._wsurl)
        this._ws.onerror = (evt: any) => {
            this.dispatch(WSClientEvent.WebSocketError, evt)
            setTimeout(() => {
                this.createws()
            }, 5000)
        }
        this._ws.onopen = () => {
            this._times++;
        }
        this._ws.onclose = () => {
            setTimeout(() => {
                this.createws()
            }, 5000)
        }
        this._ws.onopen = () => {
            this.onopen()
        }
        this._ws.onmessage = (evt: any) => {
            this.dispatch(WSClientEvent.WebSocketMessage, evt.data)
            this.message(evt.data)
        }
    }
    /**
     * 连接打开成功
     */
    protected onopen() {
        //处理待发送数据        
        this.dispatch(WSClientEvent.WebSocketConnected, {})
        for (let i = 0; i < this._waiting.length; i++) {
            this.send(this._waiting.shift())
        }
    }
    /**
     * 注册服务
     * @param ServiceName 
     * @param cb 
     */
    async regist(ServiceName: string, cb: (data: any) => Promise<any>) {
        this._services[ServiceName] = cb;
    }
    /**
     * 反向注册服务
     * @param ServiceName 
     */
    async unregist(ServiceName: string) {
        delete this._services[ServiceName]
    }
    /**
     * 注册推送
     * @param path 
     * @param cb 
     */
    async push(path: string, cb: (data: any) => Promise<any>) {
        this._push[path] = cb;
    }
    /**
     * 反向注册推送
     * @param path 
     */
    async unpush(path: string) {
        delete this._push[path]
    }
    /**
     * 发起请求
     * @param path 请求路径，
     * @param data 请求数据
     * @param options 请求参数
     */
    async request(path: string, data: any = '', options: RequestOption = {}) {
        let r = new RPC()
        r.Path = path;
        r.Data = data;
        r.ID = this.getRequestID()
        r.From = this._address;
        r.To = this._server_address;
        r.Type = RPCType.Request;
        r.Time = Date.now()
        if (options.Timeout > 0) {
            r.Timeout = options.Timeout
            setTimeout(() => {
                this.reject(r.ID, new Error(WSClientError.Timeout))
            }, options.Timeout)
        }
        if (options.NeedReply === true) {
            r.NeedReply = true;
            return new Promise((resolve, reject) => {
                this.send(r)
                this._promise[r.ID] = { resolve, reject }
            })
        }
        this.send(r)
        return true;
    }
    /**
     * 获得RequestID 
     */
    protected getRequestID() {
        if (Object.keys(this._promise).length == 256) {
            throw new Error(WSClientError.MaxRequest)
        }
        while (true) {
            if (this._id > 255) { this._id = 0 }
            if (this._promise[this._id]) {
                this._id++;
            } else {
                return this._id;
            }
        }
    }
    /**
     * 发送数据
     * @param rpc 
     */
    protected send(rpc: RPC) {
        if (this._ws.readyState == WebSocket.OPEN) {
            this._ws.send(rpc.encode())
            this.dispatch(WSClientEvent.WebSocketSended, rpc)
        }
        else {
            this._waiting.push(rpc)
        }
    }
    /**
     * 成功处理
     * @param ID 请求编号
     * @param data 响应数据
     */
    protected resolve(ID: number, data: any) {
        if (this._promise[ID]) {
            this._promise[ID].resolve(data)
            delete this._promise[ID]
        }
    }
    /**
     * 失败处理
     * @param ID 请求编号
     * @param data 响应数据
     */
    protected reject(ID: number, data: any) {
        if (this._promise[ID]) {
            this._promise[ID].reject(data)
            delete this._promise[ID]
        }
    }
    /**
     * 接收数据回调
     * @param data 
     */
    protected message(data) {
        if ('string' == typeof data) {

        } else {
            try {
                let rpc = RPC.decode(data)
                if (rpc.Type == RPCType.Response) {
                    if (rpc.Status) {
                        this.resolve(rpc.ID, rpc.Data)
                    }
                    else {
                        this.reject(rpc.ID, rpc.Data)
                    }
                } else if (RPCType.Request == rpc.Type) {
                    //请求供应的服务
                    if (this._services[rpc.Path]) {
                        this._services[rpc.Path](rpc.Data).then((rs: any) => {
                            if (rpc.NeedReply) {
                                rpc.Type = RPCType.Response
                                rpc.To = rpc.From
                                rpc.From = this._address
                                rpc.Time = Date.now()
                                rpc.Data = rs;
                                rpc.Status = true;
                                this.send(rpc)
                            }
                        }).catch((e: any) => {
                            if (rpc.NeedReply) {
                                rpc.Type = RPCType.Response
                                rpc.To = rpc.From
                                rpc.From = this._address
                                rpc.Time = Date.now()
                                rpc.Data = e;
                                rpc.Status = false;
                                this.send(rpc)
                            }
                        })
                    }
                } else if (RPCType.Push == rpc.Type) {
                    //推送消息
                    this.dispatch(WSClientEvent.Push, rpc)
                    if (this._push[rpc.Path]) {
                        this._push[rpc.Path](rpc.Data).then((rs: any) => {
                            if (rpc.NeedReply) {
                                rpc.Type = RPCType.Response
                                rpc.To = rpc.From
                                rpc.From = this._address
                                rpc.Time = Date.now()
                                rpc.Data = rs;
                                rpc.Status = true;
                                this.send(rs)
                            }
                        }).catch((e: any) => {
                            if (rpc.NeedReply) {
                                rpc.Type = RPCType.Response
                                rpc.To = rpc.From
                                rpc.From = this._address
                                rpc.Time = Date.now()
                                rpc.Data = e;
                                rpc.Status = false;
                                this.send(rpc)
                            }
                        })
                    }
                } else if (RPCType.Move == rpc.Type) {
                    //切换服务器地址
                    this.dispatch(WSClientEvent.Move, rpc)
                    this._wsurl = rpc.Data.toString()
                    this.createws()
                }
            } catch (error) {

            }
        }
    }
    /**
     * 触发事件
     * @param event 
     * @param data 
     */
    protected dispatch(event: WSClientEvent, data) {
        if (this._event[event]) {
            this._event[event].forEach((cb: Function) => {
                cb(data)
            });
        }
    }
    /**
     * 事件列表
     */
    protected _event: { [index: number]: Function[] } = {}
    /**
     * 注册事件
     * @param event 
     * @param cb 
     */
    on(event: WSClientEvent, cb: Function) {
        if (!this._event[event]) {
            this._event[event] = [];
        }
        this._event[event].push(cb)
    }
    destory() {
        clearInterval(this.interval)
    }
}