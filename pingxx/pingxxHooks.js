/**
 * Created by tsaolipeng on 15/10/14.
 */
var AV = require('leanengine');
var OrderTable = AV.Object.extend("OrderTable");

/*测试参数
 {
 "id":"evt_ugB6x3K43D16wXCcqbplWAJo",
 "created":1440407501,
 "livemode":true,
 "type":"charge.succeeded",
 "data":{
     "object":{
         "id":"ch_Xsr7u35O3m1Gw4ed2ODmi4Lw",
         "object":"charge",
         "created":1440407501,
         "livemode":true,
         "paid":true,
         "refunded":false,
         "app":"app_urj1WLzvzfTK0OuL",
         "channel":"upacp",
         "order_no":"123456789",
         "client_ip":"127.0.0.1",
         "amount":100,
         "amount_settle":0,
         "currency":"cny",
         "subject":"Your Subject",
         "body":"Your Body",
         "extra":{
         },
         "time_paid":1440407501,
         "time_expire":1440407501,
         "time_settle":null,
         "transaction_no":"1224524301201505066067849274",
         "refunds":{
         "object":"list",
         "url":"/v1/charges/ch_L8qn10mLmr1GS8e5OODmHaL4/refunds",
         "has_more":false,
         "data":[
         ]
     },
     "amount_refunded":0,
     "failure_code":null,
     "failure_msg":null,
     "metadata":{
     },
     "credential":{
     },
     "description":null
     }
 },
 "object":"event",
 "pending_webhooks":0,
 "request":"iar_qH4y1KbTy5eLGm1uHSTS00s"
 }
 */

var timestampToTime = function getLocalTime(nS) {
    return new Date(parseInt(nS) * 1000).toLocaleString().replace(/:\d{1,2}$/,' ');
};

exports.exec = function(req, res) {
    req.setEncoding('utf8');
    var postData = req.body;
    var resp = function (ret, status_code) {
        res.writeHead(status_code, {
            "Content-Type": "text/plain; charset=utf-8"
        });
        res.end(ret);
    };
    try {
        var eventType = req.body.type;
        if (eventType === undefined) {
            return resp('Event 对象中缺少 type 字段', 400);
        }
        switch (eventType) {
            case "charge.succeeded":
                // 开发者在此处加入对支付异步通知的处理代码
                var ch_id = req.body.data.object.id;
                var orderID = req.body.data.object.order_no;
                var amount = req.body.data.object.amount;
                var payTime = timestampToTime(req.body.data.object.time_paid);
                console.log("订单支付成功回调参数：", ch_id, orderID, amount, payTime);
                if(orderID.length > 12){
                  orderID = orderID.substr(0, 12);
                  console.log("订单增加后缀后支付成功，原始订单号为：", orderID);
                }
                var query = new AV.Query(OrderTable);
                query.equalTo("orderID", orderID);
                query.first({
                    success: function (order) {
                        if(order) {
                            order.set("ch_id", ch_id);
                            order.set("paid", true);
                            order.set("payTime", payTime);
                            order.set("paymentMedium",1);
                            order.set("paymentTerm",1);
                            order.save(null, {
                                success: function (order) {
                                    console.log("订单支付信息保存成功，订单号：", orderID);
                                },
                                error: function (error) {
                                    console.log(error);
                                }
                            });
                        }
                    },
                    error:function(error){
                        console.log(error);
                    }
                });
                return resp("OK", 200);
                break;
            case "refund.succeeded":
                // 开发者在此处加入对退款异步通知的处理代码
                return resp("OK", 200);
                break;
            default:
                return resp("未知 Event 类型", 400);
                break;
        }
    } catch (err) {
        console.log('错误原因',postData);
        return resp('JSON 解析失败', 400);
    }
};
