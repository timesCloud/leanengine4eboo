/**
 * Created by tsaolipeng on 15/10/22.
 */
var AV = require('leanengine');
var _ = require('underscore');
var moment = require('moment');

var Salesman = AV.Object.extend('Salesman');
var Store = AV.Object.extend('Store');
var User = AV.Object.extend("User");
var UserJoinStore = AV.Object.extend('UserJoinStore');
var DistributionCenter = AV.Object.extend('DistributionCenter');
var DeliveryRoute = AV.Object.extend('DeliveryRoute');

AV.Cloud.define('AddStore', function(request, response) {
    var salesmanPhoneNo = request.params.mobilePhoneNo;
    var orangeCode = request.params.orangeCode;
    var storeName = request.params.storeName;
    var storePosition = request.params.storePosition;
    var storeContact = request.params.storeContact;
    var contactName = request.params.contactName;
    var ownerOid = request.params.ownerOid;
    var storeAddress = request.params.storeAddress;
    var earlyHour = request.params.earlyHour;
    var earlyMinute = request.params.earlyMinute;
    var latestHour = request.params.latestHour;
    var latestMinute = request.params.latestMinute;
    var cityOid = request.params.cityOid;
    var storeTypeOid = request.params.storeTypeOid;

    AV.Cloud.run('VerifyOrangeCode', {'mobilePhoneNo':salesmanPhoneNo, 'orangeCode':orangeCode}, {
        success:function(salesman, message){
            var store = new Store();
            store.set('storeName', storeName);
            store.set('storePosition', storePosition);
            store.set('storeContact', parseInt(storeContact));
            store.set('contactName', contactName);
            store.set('owner', AV.Object.createWithoutData('User', ownerOid));
            store.set('storeAddress', storeAddress);

            var earlyTime = moment("2007-1-9").set({'hour':earlyHour, 'minute':earlyMinute, 'second':0}).toDate();
            var latestTime = moment("2007-1-9").set({'hour':latestHour, 'minute':latestMinute, 'second':0}).toDate();

            store.set('earlyTime', earlyTime);
            store.set('latestTime', latestTime);
            store.set('city', AV.Object.createWithoutData('City', cityOid));
            store.set('storeType', AV.Object.createWithoutData('StoreType', storeTypeOid));
            store.set('salesman', salesman);
            store.set('paymentDays', 2);

            store.save(null, {
                success:function(store){
                    var userJoinStore = new UserJoinStore();
                    userJoinStore.set('user', AV.Object.createWithoutData('User', ownerOid));
                    userJoinStore.set('store', store);
                    userJoinStore.set('owner', true);
                    userJoinStore.save(null, {
                        success:function(userJoinStore){
                            response.success('店铺新建成功，敬请等待后台审核通过的通知，通过后您即可下单');
                        },
                        error:function(error, userJoinStore){
                            console.log('抱歉，店铺新建成功，但为您和店铺建立绑定关系时出错，请联系技术支持协助处理');
                            response.error('抱歉，店铺新建成功，但为您和店铺建立绑定关系时出错，请联系技术支持协助处理');
                        }
                    });
                },
                error:function(error, store){
                    console.log(error);
                    response.error('店铺创建失败，请稍后重试，或联系您的业务经理');
                }
            });
        },
        error:function(message){
            console.log(message);
            response.error(message);
        }
    });
});

/*
 {
 'mobilePhoneNo':'18981892803',
 'orangeCode':'abp0rs',
 'storeName':'测试Add店铺',
 'storePosition':{
     "__type": "GeoPoint",
     "latitude": 30.573545,
     "longitude": 104.004378
     },
 'storeContact':'18981892803',
 'contactName':'曹师傅',
 'ownerOid':'55b3b6c8e4b0bb488d49b8bd',
 'storeAddress':'蓝光空港国际城',
 'earlyHour':'8',
 'earlyMinute':'15',
 'latestHour':'9',
 'latestMinute':'30',
 'cityOid':'55efd7a3ddb20257e9e37a33',
 'storeTypeOid':'55f67c0660b2b52c545bda7e'
 'salesmanPhoneNo':'18981892803',
 }
 */


AV.Cloud.beforeSave("Store", function(request, response){
    var store = request.object;
    var queryDC = new AV.Query(DistributionCenter);
    queryDC.get("55f23ce460b2b52c5403f0ce", {
        success: function(dc){
            store.set("storeDC", dc);
            var queryDR = new AV.Query(DeliveryRoute);
            queryDR.get("55f7d8b4ddb23dadf520f6fe", {
                success: function(dr){
                    store.set("storeRoute", dr);
                    console.log('自动绑定配送站成功');
                    response.success();
                },
                error: function(error){
                    console.log("自动绑定配送站失败",error.message);
                    response.error(error);
                }
            });
        },
        error: function(error){
            console.log("自动绑定配送站失败",error.message);
            response.error(error);
        }
    });
});

AV.Cloud.define("ResetEarlyNLatestTime", function(request, response){
    var oid = request.params.oid;
    var query = new AV.Query(Store);
    query.find({
        success: function(results){
            var completeCount = 0;
            for (var i = 0; i < results.length; i++) {
              var object = results[i];
              var earlyTime = moment(object.get("earlyTime"));
              var latestTime = moment(object.get("latestTime"));
              var earlyHour = earlyTime.hour();
              var earlyMinute = earlyTime.minute();
              var latestHour = latestTime.hour();
              var latestMinute = latestTime.minute();
              var newEarlyTime = moment("2007-01-09").set({'hour':earlyHour, 'minute':earlyMinute, 'second':0}).toDate();
              var newLatestTime = moment("2007-01-09").set({'hour':latestHour, 'minute':latestMinute, 'second':0}).toDate();
              object.set("earlyTime", newEarlyTime);
              object.set("latestTime", newLatestTime);
              object.save(null, {
                success:function(object){
                  completeCount++;
                  if (completeCount == results.length) {
                    response.success(results.length);
                  }
                },
                error:function(error, object){
                  completeCount++;
                  console.log(error);
                  if (completeCount == results.length) {
                    response.success(results.length);
                  }
                }
              });
            }
        },
        error: function(error){
            response.error();
        }
    });
});

AV.Cloud.define("BatchUpdateAFieldValue", function(request, response){
    var fieldName = request.params.fieldName;
    var value = request.params.fieldValue;
    console.log(fieldName, value);
    var completeCount = 0;
    var query = new AV.Query(Store);
    query.limit(1000);
    query.find({
        success: function(results){
          for (var i = 0; i < results.length; i++) {
            var object = results[i];
            object.set(fieldName, 2);//这里需要修正，如果一个字段已经是字符串之外的类型，这里将修正失败
            object.save(null, {
              success:function(object){
                completeCount++;
                if (completeCount == results.length) {
                  response.success(results.length);
                }
              },
              error:function(error, object){
                completeCount++;
                console.log(error);
                if (completeCount == results.length) {
                  response.success(results.length);
                }
              }
            });
          }
        },
        error: function(error){
            response.error();
        }
    });
});

module.exports = AV.Cloud;
