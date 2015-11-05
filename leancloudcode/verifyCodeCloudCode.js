/**
 * Created by tsaolipeng on 15/10/20.
 */
var AV = require('leanengine');
var _ = require('underscore');
var moment = require('moment');

var Salesman = AV.Object.extend('Salesman');
var OrangeKey = AV.Object.extend('OrangeKey');

var createVerifyCode = function()
{
    code = "";
    var codeLength = 6;//验证码的长度
    var selectChar = new Array(0,1,2,3,4,5,6,7,8,9);//,'a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z');//所有候选组成验证码的字符，当然也可以用中文的

    for(var i=0;i<codeLength;i++)
    {
        var charIndex = Math.floor(Math.random()*10);
        code +=selectChar[charIndex];
    }
    return code;
};

var sendOrangeKeySMS = function(orangeKey, salesman, response, isNewOrangeKey){
    var expireTime = moment(orangeKey.get('expireTime'));
    var current = moment();
    expireTime.diff(current, 'hours');
    console.log('您的邀请码为：', orangeKey.get('verifyCode'), ',该邀请码还可以使用',
        expireTime.diff(current, 'hours'), '小时');
    AV.Cloud.requestSmsCode({
        mobilePhoneNumber: salesman.get('mobilePhoneNo'),
        template: "OrangeCode",
        orangecode: orangeKey.get('verifyCode'),
        expireHours: expireTime.diff(current, 'hours'),
        ttl: 5
    }).then(function(){
        orangeKey.set('lastSendTime', moment().toDate());
        orangeKey.save(null, {
            success:function(orangeKey){
                response.success('邀请码生成成功，将通过短信发送至业务经理手机，请稍候');
            },
            error:function(orangeKey, error){
                if(isNewOrangeKey) {
                    console.log('邀请码保存失败', error);
                    response.error('邀请码生成错误，验证将失败，请联系技术支持');
                }else{
                    console.log('邀请码更新发送时间失败', error);
                    //保存失败并不影响下一次发送，所以仍然返回成功
                    response.success('邀请码生成成功，将通过短信发送至业务经理手机，请稍候');
                }
            }
        });
    }, function(err){
        response.error('邀请码短信发送失败，请稍后重试');
    });
};

AV.Cloud.define('GetOrangeCode', function(reqest, response){
    var mobilePhoneNo = reqest.params.mobilePhoneNo;

    var salesmanQuery = new AV.Query(Salesman);
    salesmanQuery.equalTo('mobilePhoneNo', mobilePhoneNo);
    salesmanQuery.first({
        success: function(salesman){
            if(salesman){
                var orangeKeyQuery = new AV.Query(OrangeKey);
                orangeKeyQuery.equalTo('user', salesman.get('user'));
                var validExpireDate = moment().add(3, 'minutes').toDate();
                orangeKeyQuery.greaterThanOrEqualTo('expireTime', validExpireDate);
                orangeKeyQuery.first({
                    success:function(orangeKey){
                        if(!orangeKey){
                            orangeKey = new OrangeKey();
                            orangeKey.set('user', salesman.get('user'));
                            orangeKey.set('verifyCode', createVerifyCode());
                            orangeKey.set('expireTime', moment().add(3, 'days').toDate());//邀请码3天过期
                            sendOrangeKeySMS(orangeKey, salesman, response, true);
                        }else{
                            var lastSendTime = moment(orangeKey.get('lastSendTime'));
                            //15分钟内限发一次
                            if(moment().diff(lastSendTime, 'minutes') > 15){
                                sendOrangeKeySMS(orangeKey, salesman, response, false);
                            }else{
                                response.error('邀请码已在之前15分钟内发送过，请直接联系业务经理提供');
                            }
                        }
                    },
                    error:function(error){
                        console.log('邀请码查询出错', error);
                        response.error('邀请码查询出错，请联系技术支持');
                    }
                });
            }else{
                response.error('该手机号没有查到对应的业务员，请联系技术支持');
            }
        },
        error: function(error){
            console.log('业务员查询出错',error);
            response.error('业务员查询出错，请联系技术支持');
        }
    });
});

AV.Cloud.define('VerifyOrangeCode', function(request, response){
    var mobilePhoneNo = request.params.mobilePhoneNo;
    var orangeCode = request.params.orangeCode;

    if(mobilePhoneNo && orangeCode) {
        var salesmanQuery = new AV.Query(Salesman);
        salesmanQuery.equalTo('mobilePhoneNo', mobilePhoneNo);
        salesmanQuery.first({
            success: function (salesman) {
                if (salesman) {
                    //暂时取消对邀请码的判定
                    //var orangeKeyQuery = new AV.Query(OrangeKey);
                    //orangeKeyQuery.equalTo('user', salesman.get('user'));
                    //orangeKeyQuery.equalTo('verifyCode', orangeCode);
                    //orangeKeyQuery.descending('expireTime');
                    //orangeKeyQuery.first({
                    //    success: function (orangeKey) {
                    //        if (!orangeKey) {
                    //            response.error('邀请码不存在，验证失败');
                    //        } else {
                    //            var expireTime = moment(orangeKey.get('expireTime'));
                    //            if (moment().isBefore(expireTime)) {
                    //                response.success(salesman, '邀请码验证成功');
                    //                console.log(orangeCode);
                    //            } else {
                    //                response.error('邀请码已过期，验证失败');
                    //            }
                    //        }
                    //    },
                    //    error: function (error) {
                    //        console.log('邀请码查询出错', error);
                    //        response.error('邀请码查询出错，请联系技术支持');
                    //    }
                    //});
                    response.success(salesman, '邀请码验证成功');
                } else {
                    response.error('该手机号没有查到对应的业务员，请联系技术支持');
                }
            },
            error: function (error) {
                console.log('业务员查询出错', error);
                response.error('业务员查询出错，请联系技术支持');
            }
        });
    }else{
        response.error('验证参数不正确，请联系技术支持');
    }
});

module.exports = AV.Cloud;