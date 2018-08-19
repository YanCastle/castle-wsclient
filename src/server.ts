import { RPC, RPCType } from './rpc'
export class RPCServer {
    protected clients: {
        [index: string]: {
            options: any,
            services: string[]
        }
    } = {}
    protected services: {
        [index: string]: {
            [index: string]: any
        }
    } = {}
    protected debug: boolean = false;
    constructor(options: { debug?: boolean }) { }
    async controller(path: string, data: any, rpc: RPC, options: any) {
        return true;
    }
    async send(content: string | Buffer, options: any) {
        throw ServerError.UNKONW_SEND
    }
    async sendTo(ID: string, content: string | Buffer, options: any) {
        throw ServerError.UNKONW_SEND
    }
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
                        if (rpc.NeedReply) {
                            rpc.Type = RPCType.Response
                            rpc.To = rpc.From;
                            rpc.From = ''
                            rpc.NeedReply = false;
                            this.send(rpc.encode(), options)
                        }
                    } catch (e) {
                        rpc.Data = { m: e.message }
                        if (this.debug) {
                            rpc.Data['e'] = e.stack
                        }
                        rpc.Type = RPCType.Response
                        rpc.To = rpc.From;
                        rpc.From = ''
                        rpc.NeedReply = false;
                        this.send(rpc.encode(), options)
                    } finally {
                    }
                    break;
                case RPCType.Proxy:
                    break;
                case RPCType.Response:
                    this.resolve(rpc.ID, rpc.Data)
                    break;
                case RPCType.Login:
                    this.clients[rpc.From] = {
                        options,
                        services: []
                    };
                    options.ID = rpc.From
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
                    rpc.From = ''
                    rpc.To = rpc.From
                    rpc.Type = RPCType.Response
                    this.send(rpc.encode(), options)
                    break;
            }
        } catch (error) {

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