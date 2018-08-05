"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const rpc_1 = require("./rpc");
let r = new rpc_1.RPC();
r.Time = Date.now();
r.ID = 255;
r.NeedReply = true;
r.Type = rpc_1.RPCType.Request;
r.Data = { abc: 1 };
r.Path = '1/1';
r.From = 'A5';
r.To = 'Z5';
let b = r.encode();
let c = rpc_1.RPC.decode(b);
console.log(c);
//# sourceMappingURL=test.js.map