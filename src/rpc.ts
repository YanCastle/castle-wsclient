// import { Buffer } from 'buffer'
// export function b2u(buffer: any): any {
//     // var ab = new ArrayBuffer(buffer.length);
//     var view = new Uint8Array(buffer.size);
//     for (var i = 0; i < buffer.size; ++i) {
//         view[i] = buffer[i];
//     }
//     return view;
// }
export class RPC {
    //来源 8 字节
    From: string | any = "";
    //接收方 8 字节
    To: string | any = "";
    //是否需要回复，若不需要回复这不创建Promise，否则创建Promise并控制超时逻辑
    NeedReply: boolean = true;
    //响应状态，成功、失败
    Status: boolean = true;
    //超时时间，超过255自动进时间
    Timeout: number = 0;
    //请求编号，不得超过255
    ID: number = 0;
    //请求路径，长度不得超过32
    Path: string = ''
    //请求类型
    Type: RPCType = RPCType.Heart
    //数据内容
    Data: Object | string | Buffer = ''
    //消息时间
    Time: number = 0
    //响应状态，成功、失败
    encode() {
        if (this.Path.length > 31) {
            throw new Error('错误的请求路径')
        }
        let From = this.From.length > 8 ? this.From.substr(0, 8) : this.From.padEnd(8, ' ')
        let To = this.To.length > 8 ? this.To.substr(0, 8) : this.To.padEnd(8, ' ')
        //预留7个字节
        let b = Buffer.alloc(19)
        b[0] |= this.NeedReply ? 0x80 : 0x00
        b[0] |= this.Status ? 0x40 : 0x00
        b[0] |= this.Timeout
        b[1] = this.ID
        // b[2] |= this.IsUp ? 0x80 : 0x00;
        b[2] = this.Path.length
        let type = getDataType(this.Data);
        b[2] |= (type << 5)
        //开始编码时间和请求类型数据
        let sTime = this.Time.toString();
        b[3] = this.Type
        b[4] = Number(sTime.substr(0, 1))

        for (let i = 0; i < 6; i++) {
            b[i + 5] = Number(sTime.toString().substr(i * 2 + 1, 2))
        }

        // 需要标识数据类型用于做解码
        let data: string | Buffer | any = this.Data;
        if (type == DataType.JSON) {
            data = JSON.stringify(data)
        } else if (DataType.Boolean == type) {
            data = data ? 1 : 0
        }
        data = data.toString()
        return Buffer.concat([
            Buffer.from([0x68]),
            b,
            Buffer.from(From),
            Buffer.from(To),
            Buffer.from(this.Path),
            Buffer.from(data),
            Buffer.from([0x68]),
        ])
    }
    static decode(b: Buffer) {
        if (b[0] !== 0x68 || b[b.length - 1] !== 0x68) { throw 'ErrorPacket' }
        b = b.slice(1, b.length - 1)
        let t = new RPC()
        t.NeedReply = (b[0] & 0x80) == 0x80
        t.Status = (b[0] & 0x40) == 0x40
        t.Timeout = (b[0] & 0x3F)
        t.ID = b[1]
        // t.IsUp = (b[2] & 0x80) == 0x00
        let c = b[2]
        let dt = c >> 5
        let len = c & 0x1F

        t.Type = b[3]
        let tTime: number[] = [
            b[4] & 0xF
        ];
        for (let i = 0; i < 6; i++) {
            tTime.push(b[i + 5])
        }

        t.Time = Number(tTime.join(''))
        t.From = b.slice(19, 19 + 8).toString().trim()
        t.To = b.slice(19 + 8, 19 + 8 + 8).toString().trim()
        //预留7个字节不处理
        t.Path = b.slice(35, len + 35).toString()
        t.Data = b.slice(35 + len)
        switch (dt) {
            case DataType.JSON:
                t.Data = JSON.parse(t.Data.toString())
                break;
            case DataType.Boolean:
                t.Data = t.Data.toString() == '1'
                break;
            case DataType.Number:
                t.Data = Number(t.Data.toString())
                break;
            case DataType.String:
                t.Data = t.Data.toString()
                break;
            case DataType.Buffer:
                // t.Data=
                break;
        }
        return t;
    }
}
export enum RPCType {
    //请求
    Request,
    //响应
    Response,
    //推送
    Push,
    //更换地址
    Move,
    //转发
    Proxy,
    //心跳
    Heart,
    //登陆
    Login,
    //服务注册,Data==true表示注册，Data==false表示反注册
    Regist,
    //发布
    Pub,
    //订阅
    Sub,
    //取消订阅
    UnSub,
}
export enum TimeoutUnit {
    s, m
}
export enum DataType {
    Buffer,
    JSON,
    Boolean,
    Number,
    String,
}
export function getDataType(data: any): DataType {
    if (data instanceof Buffer) {
        return DataType.Buffer
    } else if ('number' == typeof data) {
        return DataType.Number
    } else if ('boolean' == typeof data) {
        return DataType.Boolean
    } else if ('string' == typeof data) {
        return DataType.String
    } else {
        return DataType.JSON
    }
}