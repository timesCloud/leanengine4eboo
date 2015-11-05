/**
 * Created by tsaolipeng on 15/10/14.
 */
var http = require("http");
var https = require("https");
//var jsSHA = require('jssha');
var crypto = require('crypto');

// 输出数字签名对象
var responseWithJson = function (res, data) {
    // 允许跨域异步获取
    res.set({
        "Access-Control-Allow-Origin": "*"
        ,"Access-Control-Allow-Methods": "POST,GET"
        ,"Access-Control-Allow-Credentials": "true"
    });
    res.json(data);
};

// 随机字符串产生函数
var createNonceStr = function() {
    return Math.random().toString(36).substr(2, 15);
};

// 时间戳产生函数
var createTimeStamp = function () {
    return parseInt(new Date().getTime() / 1000) + '';
};

// 计算签名
var calcSignature = function (ticket, noncestr, ts, url) {
    var str = 'jsapi_ticket=' + ticket + '&noncestr=' + noncestr + '&timestamp='+ ts +'&url=' + url;
    console.log(str);
    var shasum = crypto.createHash('sha1');
    shasum.update(str);
    return shasum.digest('hex');;
    //var shaObj = new jsSHA(str, 'TEXT');
    //return shaObj.getHash('SHA-1', 'HEX');
};

// 2小时后过期，需要重新获取数据后计算签名
var expireTime = 7200 - 100;

var getAppsInfo = require('./apps-info'); // 从外部加载app的配置信息
var appIds = getAppsInfo();

/**
 缓存在服务器的每个URL对应的数字签名对象
 {
     'http://game.4gshu.com/': {
         appid: 'wxa0f06601f194xxxx'
         ,secret: '097fd14bac218d0fb016d02f525dxxxx'
         ,timestamp: '1421135250'
         ,noncestr: 'ihj9ezfxf26jq0k'
     }
 }
 */
var cachedSignatures = {};

// 获取微信签名所需的ticket
var getTicket = function (url, index, accessData, cb) {
    var getTicketUrl = 'https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token='+ accessData.access_token +'&type=jsapi';
    console.log(getTicketUrl);
    https.get(getTicketUrl, function(_res){
        var str = '', resp;
        _res.on('data', function(data){
            str += data;
        });
        _res.on('end', function(){
            console.log('return ticket:  ' + str);
            try{
                resp = JSON.parse(str);
            }catch(e){
                var error = new Object();
                error.code = -1;
                error.message = '解析远程JSON数据错误' + str;
                cb(error, null);
            }

            var appid = appIds[index].appid;
            var ts = createTimeStamp();
            var nonceStr = createNonceStr();
            var ticket = resp.ticket;
            var signature = calcSignature(ticket, nonceStr, ts, url);

            cachedSignatures[url] = {
                nonceStr: nonceStr
                ,appid: appid
                ,timestamp: ts
                ,signature: signature
                ,url: url
            };

            cb(null, {
                nonceStr: nonceStr
                ,timestamp: ts
                ,appid: appid
                ,signature: signature
                ,url: url
            });
        });
    });
};


exports.exec = function(params, cb) {
    var index = params.index;
    var _url = params.url;

    console.log(_url, appIds);
    var signatureObj = cachedSignatures[_url];

    if(!_url){
        var error = new Object();
        error.code = -1;
        error.message = '缺少url参数';
        cb(error, null);
    }else {
        // 如果缓存中已存在签名，则直接返回签名
        if (signatureObj && signatureObj.timestamp) {
            var t = createTimeStamp() - signatureObj.timestamp;
            console.log(signatureObj.url, _url);
            // 未过期，并且访问的是同一个地址
            // 判断地址是因为微信分享出去后会额外添加一些参数，地址就变了不符合签名规则，需重新生成签名
            if (t < expireTime && signatureObj.url == _url) {
                console.log('======== result from cache ========');
                cb(null, {
                    nonceStr: signatureObj.nonceStr
                    , timestamp: signatureObj.timestamp
                    , appid: signatureObj.appid
                    , signature: signatureObj.signature
                    , url: signatureObj.url
                });
            }
        }else {
            // 此处可能需要清理缓存当中已过期的数据
            // 获取微信签名所需的access_token
            var getTokenUrl = 'https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=' + appIds[index].appid + '&secret=' + appIds[index].secret;
            console.log(getTokenUrl);
            https.get(getTokenUrl, function (_res) {
                var str = '';
                _res.on('data', function (data) {
                    str += data;
                    console.log(str);
                });
                _res.on('end', function () {
                    console.log('return access_token:  ' + str);
                    try {
                        var resp = JSON.parse(str);
                    } catch (e) {
                        var error = new Object();
                        error.code = -1;
                        error.message = '解析access_token返回的JSON数据错误' + str;
                        cb(error, null);
                    }

                    getTicket(_url, index, resp, cb);
                });
            });
        }
    }
};