/**
 * Created by tsaolipeng on 15/10/15.
 */
'use strict';
// 配置 API Key 和 App ID
// 从 Ping++ 管理平台应用信息里获取
//var API_KEY = "sk_test_4G4qDSTOibbD5yTOqTa14C00" // 这里填入你的 Test/Live Key
var API_KEY = "sk_live_P4uvPOibPWfHuHCyPGiXDmH0"
var APP_ID = "app_PyDiL4vrnH0GLCmT" // 这里填入你的应用 ID

var http = require('http');
var url = require('url');
var crypto = require('crypto');
var pingpp = require('pingpp')(API_KEY);

var createPayment = function(order_id, channel, amount, client_ip, open_id, cb){
    var extra = {};
    switch (channel) {
        case 'alipay_wap':
            extra = {
                'success_url': 'http://www.yourdomain.com/success',
                'cancel_url': 'http://www.yourdomain.com/cancel'
            };
            break;
        case 'upacp_wap':
            extra = {
                'result_url': 'http://www.yourdomain.com/result'
            };
            break;
        case 'upmp_wap':
            extra = {
                'result_url': 'http://www.yourdomain.com/result?code='
            };
            break;
        case 'bfb_wap':
            extra = {
                'bfb_login': true,
                'result_url': 'http://www.yourdomain.com/success'
            };
            break;
        case 'wx_pub':
            extra = {
                'open_id': open_id
            };
            break;
    }
    pingpp.charges.create({
        order_no:  order_id,
        app:       {id: APP_ID},
        channel:   channel,
        amount:    amount,
        client_ip: client_ip,
        currency:  "cny",
        subject:   "壹步网订单：" + order_id,
        body:      "Charge Body",
        extra:     extra
    }, cb);
};

exports.exec = function(req, res) {
    req.setEncoding('utf8');
    var postData = req.body;
    var resp = function (ret, http_code) {
        http_code = typeof http_code == "undefined" ? 200 : http_code;
        res.writeHead(http_code, {
            "Content-Type": "application/json;charset=utf-8"
        });
        if (typeof ret != "string") {
            ret = JSON.stringify(ret)
        }
        res.end(ret);
    }

    // 创建 charge
    console.log('请求体：',req.body);
    var client_ip = req.connection.remoteAddress;
    client_ip = client_ip.replace('::ffff:', '');
    var channel = req.body.channel.toLocaleLowerCase();
    var amount = req.body.amount;
    var open_id = req.body.open_id;
    var order_id = req.body.order_no;
    console.log('用户尝试支付，创建支付凭据 - ', 'ip:', client_ip, 'channel:', channel, 'amount:',  amount, 'openid:', open_id);
    createPayment(order_id, channel, amount, client_ip, open_id, function(err, charge) {
        if (charge != null) {
            return resp(charge);
        }else{
          console.log('支付凭据创建失败，错误信息：',err.raw);
          var selectChar = new Array('a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z');
          var charIndex = Math.floor(Math.random()*26);
          var new_order_id = order_id + selectChar[charIndex];//为重新的订单号增加一个随机尾字母
          console.log('尝试重新创建订单，更新的订单编号为:', new_order_id);
          createPayment(new_order_id, channel, amount, client_ip, open_id, function(err, charge) {
              if (charge != null) {
                  return resp(charge);
              }
              console.log('支付凭据再次创建失败:',err.message);
              return resp({error:err.raw});
          });
        }
    });
}
