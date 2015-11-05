/**
 * Created by tsaolipeng on 15/10/31.
 */
var AV = require('leanengine');
var https = require('https');
var url = require('url');

var wcAccessToken = require('../wechat/wcAccessToken');
var wcSignature = require('../wechat/wcSignature');

AV.Cloud.define('CreateWechatMenu', function(request, response) {
    wcAccessToken.exec(function(err, data) {
        if (err) {
            response.error(err.code || 500, err.message);
        } else {
            menuData = request.params.menuData;
            var postParams = JSON.stringify(menuData);
            var getTicketUrl = 'https://api.weixin.qq.com/cgi-bin/menu/create?access_token='+ data.accesstoken.access_token;
            var options = url.parse(getTicketUrl);
            options.method = 'POST';
            options.headers = {
                'Content-Type' : 'application/x-www-form-urlencoded',
                'Content-Length' : postParams.length,
                'encoding' : 'utf-8'
            };
            var post_req = https.request(options, function(res) {
                console.log('STATUS: ' + res.statusCode);
                console.log('HEADERS: ' + JSON.stringify(res.headers));
                var _data="";
                res.on('data', function (chunk) {
                    _data+=chunk;
                    console.log('BODY: ' + chunk);
                });
                res.on('end', function(){
                    console.log("REBOAK:",_data)
                });
                res.on('error', function(e) {
                    console.log('problem with request: ' + e.message);
                });
            });
            console.log(postParams);
            post_req.write(postParams + '\n');
            post_req.end();
            response.success(data);
        }
    });
});

AV.Cloud.define('QueryWechatMenu', function(request, response){
    wcAccessToken.exec(function(err, data) {
        if (err) {
            response.error(err.code || 500, err.message);
        } else {
            var QueryWechatMenuUrl = 'https://api.weixin.qq.com/cgi-bin/menu/get?access_token='+ data.accesstoken.access_token;
            console.log(QueryWechatMenuUrl);
            https.get(QueryWechatMenuUrl, function(_res) {
                var str = '', resp;
                _res.on('data', function (data) {
                    console.log(str);
                    str += data;
                });
                _res.on('end', function () {
                    try {
                        resp = JSON.parse(str);
                    } catch (e) {
                        var error = new Object();
                        error.code = -1;
                        error.message = '解析远程JSON数据错误' + str;
                        response.error(error);
                    }
                    response.success(resp);
                });
                _res.on('error', function(e) {
                    var error = new Object();
                    error.code = -1;
                    error.message = 'POST请求错误';
                    response.error(error);
                });
            });
        }
    });
});

AV.Cloud.define('GetWechatSignature', function(request, response){
    console.log('GetWechatSignature begin');
    wcSignature.exec(request.params, function(err, data) {
        if (err) {
            response.error(err.code || 500, err.message);
        } else {
            response.success(data);
        }
    });
});

module.exports = AV.Cloud;