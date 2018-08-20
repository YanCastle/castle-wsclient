import { RPC, RPCType } from "./rpc";

let r = new RPC()
r.Time = Date.now()
r.ID = 255;
r.NeedReply = true;
r.Type = RPCType.Request
r.Data = { abc: 1 }
r.Path = '1/1'
r.From = 'docker'
r.To = 'docker'
let b = r.encode()
let c = RPC.decode(b)
console.log(c)