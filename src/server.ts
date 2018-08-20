import { RPC, RPCType } from './rpc'
import { checkTopic } from './utils';
import { base_covert } from 'castle-covert';
const max = 218340105584896;
export class RPCServer {
    protected ClientAddress: number = 0
    protected clients: {
        [index: string]: {
            options: any,
            services: string[],
            subscribes: string[]
        }
    } = {}
    protected services: {
        [index: string]: {
            [index: string]: any
        }
    } = {}
    /**
     * 订阅列表
     */
    protected subscribes: { [index: string]: string[] } = {}
    protected debug: boolean = false;
    constructor(options: { debug?: boolean }) { }
    async controller(path: string, data: any, rpc: RPC, options: any) {
        return true;
    }
    /**
     * 获取所有终端
     */
    getClients() {
        return Object.keys(this.clients)
    }
    /**
     * 获取指定客户端
     * @param ID 
     */
    getClient(ID: string) {
        return this.clients[ID]
    }
    /**
     * 获取所有服务
     */
    getServices() {
        return Object.keys(this.services)
    }
    /**
     * 查询具有某个服务的在线设备
     * @param ServiceName 
     */
    getServicesClients(ServiceName: string) {
        return this.services[ServiceName] ? Object.keys(this.services[ServiceName]) : []
    }
    /**
     * 发送
     * @param content 
     * @param options 
     */
    async send(content: string | Buffer, options: any) {
        throw ServerError.UNKONW_SEND
    }
    /**
     * 发送
     * @param ID 
     * @param content 
     * @param options 
     */
    async sendTo(ID: string, content: string | Buffer, options?: any) {
        throw ServerError.UNKONW_SEND
    }
    /**
     * 消息
     * @param data 
     * @param options 
     */
    async message(data: any, options: {
        ID: string,
        [index: string]: any
    }) {
        let rpc: RPC;
        if ('string' == typeof data) {
            rpc = JSON.parse(data)
        } else if (data instanceof Buffer) {
            rpc = RPC.decode(data)
        } else {
            throw ServerError.UNKNOW_DATA
        }
        try {
            switch (rpc.Type) {
                case RPCType.Request:
                    try {
                        rpc.Data = await this.controller(rpc.Path, rpc.Data, rpc, options)

                    } catch (e) {
                        rpc.Data = { m: e.message }
                        if (this.debug) {
                            rpc.Data['e'] = e.stack
                        }
                    } finally {
                        if (rpc.NeedReply) {
                            rpc.Type = RPCType.Response
                            rpc.To = rpc.From;
                            rpc.From = ''
                            rpc.NeedReply = false;
                            this.send(rpc.encode(), options)
                        }
                    }
                    break;
                case RPCType.Proxy:
                    break;
                case RPCType.Response:
                    if (rpc.Status)
                        this.resolve(rpc.ID, rpc.Data)
                    else
                        this.reject(rpc.ID, rpc.Data)
                    break;
                case RPCType.Login:
                    rpc.Data = true
                    rpc.Type = RPCType.Response
                    if (this.clients[rpc.From]) {
                        rpc.Status = false;
                        rpc.Data = this.genClientAddress()
                    } else {
                        if (options.ID) {
                            this.close(options)
                        }
                        options.ID = rpc.From;
                        this.clients[rpc.From] = {
                            options,
                            services: [],
                            subscribes: []
                        };
                    }
                    rpc.To = rpc.From
                    rpc.From = ''
                    this.send(rpc.encode(), options)
                    break;
                case RPCType.Regist:
                    if (!this.services[rpc.Path]) { this.services[rpc.Path] = {} }
                    if (rpc.Data) {
                        //注册
                        this.services[rpc.Path][options.ID] = options
                        this.clients[rpc.From].services.push(rpc.Path)
                    } else {
                        //注销                        
                        if (this.services[rpc.Path][options.ID])
                            delete this.services[rpc.Path][options.ID]
                        let i = this.clients[rpc.ID].services.indexOf(rpc.Path)
                        if (i > -1) { this.clients[rpc.ID].services.splice(i, 1) }
                    }
                    rpc.To = rpc.From
                    rpc.From = ''
                    rpc.Type = RPCType.Response
                    this.send(rpc.encode(), options)
                    break;
                case RPCType.Pub:
                    //发布
                    let pubs: string[] = [];
                    console.log(`From:${rpc.From},ID:${rpc.ID},Data:${rpc.Data}`)
                    Object.keys(this.subscribes).forEach((topic: string) => {
                        if (new RegExp(topic).test(rpc.Path)) {
                            this.subscribes[topic].forEach((id: string) => {
                                rpc.To = id;
                                try {
                                    this.sendTo(id, rpc.encode(), options)
                                    pubs.push(id)
                                    console.log(`To:${rpc.To},ID:${rpc.ID},Data:${rpc.Data}`)
                                } catch (error) {

                                }
                            })
                        }
                    })
                    rpc.To = rpc.From
                    rpc.Data = pubs.length > 100 ? pubs.length : pubs;
                    rpc.Type = RPCType.Response
                    this.send(rpc.encode(), options)
                    break;
                case RPCType.Sub:
                    //订阅
                    try {
                        if ('string' == typeof rpc.Data) {
                            let topic = checkTopic(rpc.Data)
                            this.handleSubscribe(rpc.From, topic)
                        } else if (rpc.Data instanceof Array) {
                            rpc.Data.forEach((topic: string) => {
                                topic = checkTopic(topic)
                                this.handleSubscribe(rpc.From, topic)
                            })
                        } else {
                            rpc.Status = false;
                            rpc.Data = 'ErrorTopic'
                        }
                    } catch (error) {
                        rpc.Status = false;
                        rpc.Data = 'ErrorTopic'
                    } finally {
                        rpc.To = rpc.From
                        rpc.Type = RPCType.Response
                        this.send(rpc.encode(), options)
                    }

                    break;
                case RPCType.UnSub:
                    //取消订阅
                    try {
                        if ('string' == typeof rpc.Data) {
                            let topic = checkTopic(rpc.Data)
                            if (!this.subscribes[topic]) { this.subscribes[topic] = [] }
                            let i = this.subscribes[topic].indexOf(rpc.From)
                            if (i > -1) { this.subscribes[topic].splice(i, 1) }
                        } else if (rpc.Data instanceof Array) {
                            rpc.Data.forEach((topic: string) => {
                                topic = checkTopic(topic)
                                this.handleSubscribe(rpc.From, topic)
                            })
                        } else {
                            rpc.Status = false;
                            rpc.Data = 'ErrorTopic'
                        }
                    } catch (error) {
                        rpc.Status = false;
                        rpc.Data = 'ErrorTopic'
                    } finally {
                        if (rpc.Status) { rpc.Data = '' }
                        rpc.Type = RPCType.Response
                        this.send(rpc.encode(), options)
                    }
                    break;

            }
        } catch (error) {
            if (rpc.NeedReply) {
                rpc.Status = false;
                rpc.Data = error.message
                rpc.To = rpc.From;
                rpc.From = ''
                this.send(rpc.encode(), options)
            }
        }
    }
    protected handleSubscribe(ID: string, topic: string) {
        if (!this.subscribes[topic]) { this.subscribes[topic] = [] }
        if (this.subscribes[topic].indexOf(ID) == -1) {
            this.subscribes[topic].push(ID)
            this.clients[ID].subscribes.push(topic)
        }
    }
    protected genClientAddress() {
        while (true) {
            if (this.clients[base_covert(10, 62, this.ClientAddress)]) {
                this.ClientAddress++
                if (this.ClientAddress > max) { this.ClientAddress = 0 }
            } else { return base_covert(10, 62, this.ClientAddress) }
        }
    }
    async push(to: string, path: string, data: any) {
        if (this.clients[to]) {
            let rpc = new RPC()
            rpc.Type = RPCType.Push;
            rpc.To = to;
            rpc.ID = 0;
            rpc.NeedReply = false;
            rpc.Path = path
            rpc.Status = true
            rpc.Data = data
            this.sendTo(to, rpc.encode(), this.clients[to].options)
        } else {
            throw ServerError.NOT_ONLINE
        }
    }
    async close(ctx) {
        if (ctx.ID && this.clients[ctx.ID]) {
            this.clients[ctx.ID].services.forEach((e: string) => {
                if (this.services[e][ctx.ID]) {
                    delete this.services[e][ctx.ID]
                }
            })
            this.clients[ctx.ID].subscribes.forEach((e: string) => {
                let i = this.subscribes[e].indexOf(ctx.ID);
                if (i > -1) {
                    this.subscribes[e].splice(i, 1)
                }
            })
            delete this.clients[ctx.ID]
        }
    }
    async request(to: string, path: string, data: any, options: { NeedReply?: Boolean, Timeout?: number } = {}) {
        if (!this.clients[to]) {
            throw ServerError.NOT_ONLINE
        }
        let r = new RPC()
        r.Path = path;
        r.Data = data;
        r.From = '';
        r.To = to;
        r.Type = RPCType.Request
        r.Time = Date.now()
        if (options.Timeout && options.Timeout > 0) {
            r.Timeout = Number(options.Timeout)
            setTimeout(() => {
                this.reject(r.ID, ServerError.TIMEOUT)
            }, options.Timeout)
        }
        this.sendTo(to, r.encode(), this.clients[to].options)
        if (options.NeedReply !== false) {
            r.NeedReply = true;
            return new Promise((resolve, reject) => {
                this._promise[r.ID] = { resolve, reject }
            })
        }
        return true;
    }
    _promise = {};
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
}
export enum ServerError {
    UNKNOW_DATA,
    UNKONW_SEND,
    NOT_ONLINE,
    TIMEOUT,
}