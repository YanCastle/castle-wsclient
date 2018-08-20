import { RPC, RPCType } from './rpc';
// import { Buffer } from 'buffer'
import { checkTopic } from './utils';
export enum WSClientEvent {
    ReceiveStringError,
    DeocdeError,
    WebSocketError,
    Push,
    Service,
    Move,
    Message,
    WebSocketConnected,
    WebSocketSended,
    WebSocketClosed,
    WebSocketMessage,
    Logined,
}
export interface RequestOption {
    NeedReply?: Boolean,
    Timeout?: number,
    Type?: RPCType
}
export enum WSClientError {
    Timeout = 'Timeout',
    MaxRequest = 'MaxRequest'
}
export default class RPCClient {
    protected _wsInstance: WebSocket | any = {};
    protected _ws: WebSocket | any;
    protected _times: number = 0;
    protected _wsurl: string = "";
    protected _wsurls: string[] = []
    protected _id: number = 0;
    protected _promise: { [index: number]: { resolve: Function, reject: Function } } = {}
    //客户识别号
    protected _address: string = '00000000'
    //服务器识别号
    protected _server_address: string = '00000000'
    protected _services: { [index: string]: (data: any) => Promise<any> } = {}
    protected _push: { [index: string]: (data: any) => Promise<any> } = {}
    protected _waiting: RPC[] = [];
    protected interval: any = 0;
    protected subscribes: { [index: string]: ((data: any, from: string, topic: string) => any)[] } = {}
    protected _logined: boolean = false;
    get isLogin() { return this._logined }
    /**
     * 构造函数
     * @param wsurl 
     * @param address 
     */
    constructor(wsurl: string | string[], address: string = "", wsInstance: WebSocket | any = undefined) {
        if (wsurl instanceof Array) {
            this._wsurl = wsurl[0]
            this._wsurls = wsurl;
        } else {
            this._wsurl = wsurl;
            this._wsurls = [wsurl]
        }
        this._address = address;
        if (wsInstance) {
            this._wsInstance = wsInstance
        }
        else {
            this._wsInstance = WebSocket
        }
        let heart = new RPC()
        heart.NeedReply = false;
        heart.Path = ''
        heart.Data = ''
        heart.From = this._address
        heart.To = this._server_address
        heart.Type = RPCType.Heart
        this.interval = setInterval(() => {
            if (this._ws.readyState == this._wsInstance.OPEN && this._logined) {
                this.send(heart)
                // this._ws.ping
            }
        }, 240000)
        this.createws();
    }

    /**
     * 创建连接
     */
    protected createws() {
        let s = this._wsInstance;
        this._ws = new s(this._wsurl)
        this._ws.binaryType = 'arraybuffer'
        this._ws.onerror = (evt: any) => {
            this._logined = false;
            this.dispatch(WSClientEvent.WebSocketError, evt)
            setTimeout(() => {
                this.createws()
            }, 5000)
        }
        this._ws.onopen = () => {
            this._times++;
        }
        this._ws.onclose = () => {
            this._logined = false;
            setTimeout(() => {
                this.createws()
            }, 5000)
        }
        this._ws.onopen = () => {
            this.onopen()
        }
        this._ws.onmessage = (evt: any) => {
            let data = Buffer.from(evt.data)
            this.dispatch(WSClientEvent.WebSocketMessage, data)
            this.message(data)
        }
    }
    protected async login() {
        if (this._ws.readyState == this._wsInstance.OPEN) {
            try {
                await this.request('', '', { Type: RPCType.Login, NeedReply: true })
                this._logined = true;
                this.dispatch(WSClientEvent.Logined, this._address)
                // this.dispatch(WSClientEvent.WebSocketConnected, {})
                Object.keys(this._services).forEach((ServiceName) => {
                    this.request(ServiceName, true, { Type: RPCType.Regist, NeedReply: true })
                })
                Object.keys(this.subscribes).forEach((topic) => {
                    this.request('', topic, { Type: RPCType.Sub, NeedReply: true })
                })
                for (let i = 0; i < this._waiting.length; i++) {
                    let rpc: RPC | any = this._waiting.shift();
                    rpc.From = this._address
                    if (rpc)
                        this.send(rpc)
                }
            } catch (address) {
                if ('string' == typeof address) {
                    this._address = address
                    return await this.login()
                }
                throw address.message
            }
        } else {
            throw 'No Connected'
        }
    }
    /**
     * 连接打开成功
     */
    protected onopen() {
        //处理待发送数据        
        //发起登陆请求
        this.login()
    }
    /**
     * 注册服务
     * @param ServiceName 
     * @param cb 
     */
    async regist(ServiceName: string, cb: (data: any) => Promise<any>) {
        let rs = await this.request(ServiceName, true, { Type: RPCType.Regist, NeedReply: true })
        if (rs)
            this._services[ServiceName] = cb;
        else
            throw 'Error'
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
        r.Type = options.Type ? options.Type : RPCType.Request;
        r.Time = Date.now()
        if (options.Timeout && options.Timeout > 0) {
            r.Timeout = Number(options.Timeout)
            setTimeout(() => {
                this.reject(r.ID, new Error(WSClientError.Timeout))
            }, options.Timeout)
        }
        if (options.NeedReply !== false) {
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
        if (this._ws.readyState == this._wsInstance.OPEN) {
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
    protected message(data: any) {
        let rpc: RPC;
        if ('string' == typeof data) {
            try {
                rpc = JSON.parse(data)
            } catch (error) {

            }
        } else {
            try {
                rpc = RPC.decode(data)
            } catch (error) {
                console.log(error)
            }
        }
        if (rpc === undefined || rpc.To !== this._address) { return; }
        this.dispatch(WSClientEvent.Message, rpc)
        switch (rpc.Type) {
            case RPCType.Response:
                if (rpc.Status) {
                    this.resolve(rpc.ID, rpc.Data)
                }
                else {
                    this.reject(rpc.ID, rpc.Data)
                }
                break;
            case RPCType.Request:
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
                } else {
                    if (rpc.NeedReply) {
                        rpc.Type = RPCType.Response
                        rpc.To = rpc.From
                        rpc.From = this._address
                        rpc.Time = Date.now()
                        rpc.Data = 'NoService';
                        rpc.Status = false;
                        this.send(rpc)
                    }
                }
                break;
            case RPCType.Push:
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
                break;
            case RPCType.Move:
                //切换服务器地址
                this.dispatch(WSClientEvent.Move, rpc)
                let i = this._wsurls.indexOf(this._wsurl)
                if (i > 0) { this._wsurls.splice(i, 1) }
                this._wsurl = rpc.Data.toString()
                this._wsurls.push(this._wsurl)
                this.createws()
                break;
            case RPCType.Pub:
                //处理订阅推送，触发订阅回调
                if (this.subscribes[rpc.Path]) {
                    // console.log(this.subscribes[rpc.Path].length)
                    this.subscribes[rpc.Path].forEach((e: Function) => {
                        e(rpc.Data, rpc.From, rpc.Path)
                    })
                }
                break;
        }
    }
    /**
     * 订阅
     * @param topic 
     * @param cb 
     */
    public async subscribe(topic: string | string[], cb: (data: any, from?: string, topic?: string) => any) {
        let Data: any = [];
        if ('string' == typeof topic && checkTopic(topic)) {
            Data = [topic]
        } else if (topic instanceof Array) {
            topic.forEach((t: string) => {
                if (checkTopic(t)) {
                    Data.push(t)
                }
            })
        }
        await this.request('', Data, { Type: RPCType.Sub, NeedReply: true })
        Data.forEach((t: string) => {
            if (!this.subscribes[t]) { this.subscribes[t] = [] }
            this.subscribes[t].push(cb)
        })
        return true;
    }
    /**
     * 取消订阅
     * @param topic 
     */
    public async unsubscribe(topic) {
        let Data: any = [];
        if ('string' == typeof topic && checkTopic(topic)) {
            Data = [topic]
        } else if (topic instanceof Array) {
            topic.forEach((t: string) => {
                if (checkTopic(t)) {
                    Data.push(t)
                }
            })
        }
        await this.request('', Data, { Type: RPCType.UnSub, NeedReply: true })
        Data.forEach((t: string) => {
            if (this.subscribes[t]) { delete this.subscribes[t] }
        })
        return true;
    }
    /**
     * 发布
     * @param topic 
     * @param data 
     */
    public async publish(topic: string, data: any) {
        return await this.request(topic, data, { Type: RPCType.Pub, NeedReply: true })
    }
    /**
     * 触发事件
     * @param event 
     * @param data 
     */
    protected dispatch(event: WSClientEvent, data: any) {
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