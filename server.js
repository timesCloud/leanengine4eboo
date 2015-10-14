var AV = require('leanengine');
var TestObject = AV.Object.extend("TestObject");

var APP_ID = process.env.LC_APP_ID;
var APP_KEY = process.env.LC_APP_KEY;
var MASTER_KEY = process.env.LC_APP_MASTER_KEY;

AV.initialize(APP_ID, APP_KEY, MASTER_KEY);

AV.Cloud.useMasterKey();

var app = require('./app');

// 端口一定要从环境变量 `LC_APP_PORT` 中获取。
// LeanEngine 运行时会分配端口并赋值到该变量。
var PORT = parseInt(process.env.LC_APP_PORT || 3000);
var server = app.listen(PORT, function () {
  console.log('Node app is running, port:', PORT);
});

var http = require('http');
http.createServer(function (req, res) {
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
        return resp('Event 对象中缺少 type 字段', 400);
      }
      switch (event.type) {
        case "charge.succeeded":
          // 开发者在此处加入对支付异步通知的处理代码
          return resp("OK", 200);
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
          return resp("OK", 200);
          break;
        default:
          return resp("未知 Event 类型", 400);
          break;
      }
    } catch (err) {
      return resp('JSON 解析失败', 400);
    }
  });
}).listen(8080, "0.0.0.0");
