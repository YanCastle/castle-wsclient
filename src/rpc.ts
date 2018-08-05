import { Buffer } from 'buffer'
export class RPC {
    //来源 8 字节
    From: string = "00000000";
    //接收方 8 字节
    To: string = "00000000";
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
    Type: RPCType
    //数据内容
    Data: Object | string | Buffer = ''
    //消息时间
    Time: number = 0
    //响应状态，成功、失败
    encode() {
        if (this.Path.length < 1 && this.Path.length > 31) {
            throw new Error('错误的请求路径')
        }
        let From = this.From.length > 8 ? this.From.substr(0, 8) : this.From.padEnd(8, ' ')
        let To = this.To.length > 8 ? this.To.substr(0, 8) : this.To.padEnd(8, ' ')
        //预留7个字节
        let b = Buffer.alloc(18)
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
        b[3] |= (this.Type << 4)
        b[3] |= (Number(sTime.substr(0, 1)))

        for (let i = 0; i < 6; i++) {
            b[i + 4] = Number(sTime.toString().substr(i * 2 + 1, 2))
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
            b,
            Buffer.alloc(8, From, 'ascii'),
            Buffer.alloc(8, To, 'ascii'),
            Buffer.alloc(this.Path.length, this.Path),
            Buffer.alloc(data.length, data)
        ])
    }
    static decode(b: Buffer) {
        let t = new RPC()
        t.NeedReply = (b[0] & 0x80) == 0x80
        t.Status = (b[0] & 0x40) == 0x40
        t.Timeout = (b[0] & 0x3F)
        t.ID = b[1]
        // t.IsUp = (b[2] & 0x80) == 0x00
        let c = b[2]
        let dt = c >> 5
        let len = c & 0x1F

        t.Type = b[3] >> 4
        let tTime: number[] = [
            b[3] & 0xF
        ];
        for (let i = 0; i < 6; i++) {
            tTime.push(b[i + 4])
        }

        t.Time = Number(tTime.join(''))
        t.From = b.slice(18, 18 + 6).toString('ascii').trim()
        t.To = b.slice(18 + 6, 18 + 6 + 6).toString('ascii').trim()
        //预留7个字节不处理
        t.Path = b.slice(34, len + 34).toString()
        t.Data = b.slice(34 + len)
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
export function getDataType(data): DataType {
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