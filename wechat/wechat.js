/**
 * Created by tsaolipeng on 15/10/30.
 */
var crypto = require('crypto');
var config = require('./wcConfig');
var debug = require('debug')('AV:weixin');

exports.exec = function(params, cb) {
    if (params.signature) {
        checkSignature(params.signature, params.timestamp, params.nonce, params.echostr, cb);
    } else {
        receiveMessage(params, cb)
    }
}

// 验证签名
var checkSignature = function(signature, timestamp, nonce, echostr, cb) {
    var oriStr = [config.token, timestamp, nonce].sort().join('');
    var code = crypto.createHash('sha1').update(oriStr).digest('hex');
    debug('code:', code);
    if (code == signature) {
        cb(null, echostr);
    } else {
        var err = new Error('Unauthorized');
        err.code = 401;
        cb(err);
    }
}

// 接收普通消息
var receiveMessage = function(msg, cb) {
    var result = {
        xml: {
            ToUserName: msg.xml.FromUserName[0],
            FromUserName: '' + msg.xml.ToUserName + '',
            CreateTime: new Date().getTime(),
            MsgType: 'text',
            Content: '你好，你发的内容是「' + msg.xml.Content + '」。'
        }
    }
    cb(null, result);
}
