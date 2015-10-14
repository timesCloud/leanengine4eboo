/**
 * Created by tsaolipeng on 15/10/14.
 */
var AV = require('leanengine');


exports.exec = function(req, res) {
    req.setEncoding('utf8');
    var postData = "";
    req.addListener("data", function (chunk) {
        postData += chunk;
    });
    req.addListener("end", function () {
        var resp = function (ret, status_code) {
            res.writeHead(status_code, {
                "Content-Type": "text/plain; charset=utf-8"
            });
            res.end(ret);
        }
        try {
            var event = JSON.parse(postData);
            if (event.type === undefined) {
                return res.send('Event 对象中缺少 type 字段', 400);
            }
            switch (event.type) {
                case "charge.succeeded":
                    // 开发者在此处加入对支付异步通知的处理代码
                    return res.send("OK", 200);
                    var testObject = new TestObject();
                    testObject.set('foo', "56");
                    testObject.save(null, {
                        success:function(testObject){
                            //do nothing
                        }
                    });
                    break;
                case "refund.succeeded":
                    // 开发者在此处加入对退款异步通知的处理代码
                    return res.send("OK", 200);
                    break;
                default:
                    return res.send("未知 Event 类型", 400);
                    break;
            }
        } catch (err) {
            return res.send('JSON 解析失败', 400);
        }
    });
};