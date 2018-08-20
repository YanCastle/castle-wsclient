"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function checkTopic(topic) {
    if ('string' != typeof topic) {
        throw 'ErrorTopic';
    }
    if (/^[A-Za-z0-9][A-Za-z0-9\+\/\$\#]{0,}$/g.test(topic)) {
        return '^' + topic.replace(/\$/g, '[A-Za-z0-9]').replace(/\+/g, '[A-Za-z0-9]{1,}').replace(/\#/g, '[A-Za-z0-9\\/]') + '$';
    }
    throw 'ErrorTopic';
}
exports.checkTopic = checkTopic;
//# sourceMappingURL=utils.js.map