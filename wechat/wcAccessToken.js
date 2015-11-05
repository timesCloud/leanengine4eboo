/**
 * Created by tsaolipeng on 15/10/31.
 */
/**
 * Created by tsaolipeng on 15/10/14.
 */
var http = require("http");
var https = require("https");

// 时间戳产生函数
var createTimeStamp = function () {
    return parseInt(new Date().getTime() / 1000) + '';
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

exports.exec = function(cb) {
    var _url = 'www.91ebu.com';

    var signatureObj = cachedSignatures[_url];

    // 如果缓存中已存在签名，则直接返回签名
    if (signatureObj && signatureObj.timestamp) {
        var t = createTimeStamp() - signatureObj.timestamp;
        console.log(signatureObj.url, _url);
        // 未过期，并且访问的是同一个地址
        // 判断地址是因为微信分享出去后会额外添加一些参数，地址就变了不符合签名规则，需重新生成签名
        if (t < expireTime && signatureObj.url == _url) {
            console.log('======== accessToken from cache ========');
            cb(null, signatureObj);
        }
    }else {
        // 此处可能需要清理缓存当中已过期的数据
        // 获取微信签名所需的access_token
        var getTokenUrl = 'https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=' + appIds[0].appid + '&secret=' + appIds[0].secret;
        https.get(getTokenUrl, function (_res) {
            var str = '';
            _res.on('data', function (data) {
                str += data;
            });
            _res.on('end', function () {
                try {
                    var resp = JSON.parse(str);
                } catch (e) {
                    var error = new Object();
                    error.code = -1;
                    error.message = '解析access_token返回的JSON数据错误' + str;
                    cb(error, null);
                }

                var ts = createTimeStamp();
                cachedSignatures[_url] = {
                    accesstoken: resp,
                    timestamp: ts,
                    url: _url
                };
                cb(null, cachedSignatures[_url]);
            });
        });
    }
};