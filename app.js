var express = require('express');
var path = require('path');
var bodyParser = require('body-parser');
var methodOverride = require('method-override')
var AV = require('leanengine');

var users = require('./routes/users');
var todos = require('./routes/todos');
var cloud = require('./cloud');
var orderCloud = require('./leancloudcode/orderCloudCode.js');
var verifyCodeCloud = require('./leancloudcode/verifyCodeCloudCode');
var pingxxHooks = require('./pingxx/pingxxHooks');
var createCharge = require('./pingxx/createCharge');
var wcOauth2 = require('./wechat/wcOauth2');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use('/static', express.static('public'));

// 加载云代码方法
app.use(cloud);
app.use(orderCloud);
app.use(verifyCodeCloud);

// 加载 cookieSession 以支持 AV.User 的会话状态
app.use(AV.Cloud.CookieSession({ secret: '05XgTktKPMkU', maxAge: 3600000, fetchUser: true }));

// 强制使用 https
app.enable('trust proxy');
app.use(AV.Cloud.HttpsRedirect());

app.use(methodOverride('_method'))
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// 可以将一类的路由单独保存在一个文件中
app.use('/todos', todos);
app.use('/users', users);

//跨域请求处理
app.all('*', function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type,Content-Length, Authorization, Accept,X-Requested-With");
  res.header("Access-Control-Allow-Methods","PUT,POST,GET,DELETE,OPTIONS");
  res.header("X-Powered-By",'3.2.1');
  console.log("跨域post");
  if(req.method=="OPTIONS") {
    res.sendStatus(200);
    /让options请求快速返回/
  }
  else  {
    next();
  }
});
//路由
app.get('/auth/:id/:password', function(req, res) {
  res.send({id:req.params.id, name: req.params.password});
});

app.get('/', function(req, res) {
  res.redirect('/todos');
});

app.get('/pingxxhooks', function(req, res) {
  console.log('pingxxhooks req:');
  pingxxHooks.exec(req, res);
});

app.post('/pingxxhooks', function(req, res) {
  console.log('pingxxhooks post:');
  pingxxHooks.exec(req, res);
});

app.post('/createCharge', function(req, res) {
  console.log('createCharge post:');
  createCharge.exec(req, res);
});

app.get('/wcOauth2Redirect', function(req, res) {
  console.log('wxOauth2Redirect req:');
  wcOauth2.exec(req.query, res);
});

// 如果任何路由都没匹配到，则认为 404
// 生成一个异常让后面的 err handler 捕获
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// 如果是开发环境，则将异常堆栈输出到页面，方便开发调试
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// 如果是非开发环境，则页面只输出简单的错误信息
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});

module.exports = app;
