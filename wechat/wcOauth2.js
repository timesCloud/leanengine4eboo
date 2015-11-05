/**
 * Created by tsaolipeng on 15/10/15.
 */

var https = require("https");
var AV = require('leanengine');
var User = AV.Object.extend("User");
var UserWCInfos = AV.Object.extend("UserWCInfos");

var getAppsInfo = require('./apps-info'); // 从外部加载app的配置信息
var appIds = getAppsInfo();

var BindingOpenid = function(access_token, userObjectId, res){
    if (access_token) {
        console.log('access_token_obj:', access_token);
        var openid = access_token.openid;
        //var unionid = access_token_obj.unionid;
        console.log('current openid:', openid, 'currentUser:', userObjectId);

        var query = new AV.Query(User);
        query.get(userObjectId, {
            success: function (user) {
                var queryWCInfos = new AV.Query(UserWCInfos);
                queryWCInfos.equalTo("user", user);
                queryWCInfos.first({
                    success: function (object) {
                        var userWCInfos = null;
                        if(object){
                            userWCInfos = object;
                        }else {
                            userWCInfos = new UserWCInfos();
                        }
                        userWCInfos.set("user", user);
                        userWCInfos.set("openid", openid);
                        userWCInfos.save(null, {
                            success: function (userWCInfos) {
                                // 成功保存之后，执行其他逻辑.
                                console.log("userWCInfos saved", openid);
                                //res.end(0);
                                res.redirect('http://www.91ebu.com/wechat');
                            },
                            error: function (userWCInfos, error) {
                                console.log("userWCInfos save failure", error.message);
                                res.end(40002);
                            }
                        });
                    },
                    error: function (error) {
                        res.end(40003);
                    }
                });
            },
            error: function (user, error) {
                console.log("binding openid to user failure, objectId:", userObjectId, error.message);
                res.end("绑定微信账号失败，请联系管理员");
            }
        });
    }
};

exports.exec = function(params, res){
    var code = params.code;
    var state = params.state;
    console.log("wechat code:",code);
    // 获取微信签名所需的access_token
    var getTokenUrl = 'https://api.weixin.qq.com/sns/oauth2/access_token?appid=' + appIds[0].appid
        + '&secret=' + appIds[0].secret + '&code=' + code + '&grant_type=authorization_code';
    //console.log('get accessToken url when oauth2：', getTokenUrl);
    https.get(getTokenUrl, function (_res) {
        var str = '';
        _res.on('data', function (data) {
            str += data;
            //console.log(str);
        });
        _res.on('end', function () {
            //console.log('return accessToken when oauth2:  ' + str);
            try {
                var resp = JSON.parse(str);
                console.log("transfer success", str, resp);
            } catch (e) {
                console.log("trasfer error", e);
                res.end(40001);
            }

            BindingOpenid(resp, state, res);
        });
    });
};

/*OAuth2请求授权的URL
 https://open.weixin.qq.com/connect/oauth2/authorize?appid=wxe54b53d8fb59af50&redirect_uri=http://ebutest.avosapps.com/wcOauth2Redirect&response_type=code&scope=snsapi_userinfo&state=userObjectId#wechat_redirect
*/