import { RPC, RPCType } from './rpc'
const code = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T'
    , 'U', 'V', 'W', 'X', 'Y', 'Z', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's',
    't', 'u', 'v', 'w', 'x', 'y', 'z']
const codeLen = code.length;
const max = 218340105584896;
export class RPCServer {
    protected ClientAddress: number = 0
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
                    rpc.Data = true
                    rpc.Type = RPCType.Response
                    if (this.clients[rpc.From] || rpc.From.replace(/0/g, '').length == 0) {
                        rpc.Status = false;
                        rpc.Data = this.genClientAddress()
                    } else {
                        if (options.ID) {
                            this.close(options)
                        }
                        options.ID = rpc.From;
                        this.clients[rpc.From] = {
                            options,
                            services: []
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
                    rpc.From = ''
                    rpc.To = rpc.From
                    rpc.Type = RPCType.Response
                    this.send(rpc.encode(), options)
                    break;
            }
        } catch (error) {

        }
    }
    protected genClientAddress() {
        let r = "";
        let o = ++this.ClientAddress
        while (true) {
            r += o % codeLen
            if (o > codeLen) {
                o = Math.floor(o / codeLen)
            } else {
                if (this.clients[r]) {
                    o = ++this.ClientAddress
                    if (max < o) {
                        this.ClientAddress = 0
                        o = 0;
                    }
                } else
                    return r;
            }
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