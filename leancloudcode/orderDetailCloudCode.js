/**
 * Created by tsaolipeng on 15/10/21.
 */
var AV = require('leanengine');
var _ = require('underscore');

var moment = require('moment');
var OrderSum4SC = AV.Object.extend("OrderSum4SC");
var OrderTable = AV.Object.extend("OrderTable");
var OrderDetail = AV.Object.extend("OrderDetail");
var DistributionCenter = AV.Object.extend("DistributionCenter");
var DeliveryRoute = AV.Object.extend("DeliveryRoute");
var User = AV.Object.extend("User");
var OftenBuyProducts = AV.Object.extend("OftenBuyProducts");

AV.Cloud.define('incrementOrderSum4SC', function(request, response) {
    var orderDetail = request.params.object;
    var orderDetailProductCount = orderDetail.get("orderDetailProductCount");
    var lastCount = orderDetail.get("lastCount");
    var realUnit = orderDetail.get("realUnit");
    var lastRealUnit = orderDetail.get("lastRealUnit");
    //如果该订单明细的订货数量和档次修改前的订货数量不符，则表示有修改，需更新每日订货总量
    if (orderDetailProductCount != lastCount || realUnit != lastRealUnit) {
        var dt = orderDetail.get("orderTime");
        var todayStart = moment(dt).startOf('day');
        var todayEnd = moment(dt).endOf('day');
        var orderSC = orderDetail.get("orderSC");
        var product = orderDetail.get("orderDetailProductName");

        var query = new AV.Query(OrderSum4SC);
        query.equalTo("sortingCenter", orderSC);
        query.equalTo("product", product);
        query.greaterThanOrEqualTo("date", todayStart.toDate());
        query.lessThanOrEqualTo("date", todayEnd.toDate());
        query.first({
            success: function (object) {
                if (object) {//查到已存在的当日订货数据，则更新

                    var dCountValue = orderDetailProductCount - lastCount;
                    var dUnitValue = realUnit - lastRealUnit;
                    console.log(dCountValue, "  ", dUnitValue);
                    object.increment("productCount", dCountValue);
                    object.increment("unitCount", dUnitValue);
                } else {//没有查到，则新建
                    object = new OrderSum4SC();
                    object.set("sortingCenter", orderSC);
                    object.set("product", product);
                    object.set("productCount", orderDetailProductCount);
                    object.set("unitCount", realUnit);
                    object.set("date", moment(todayStart).add(12, 'h').toDate());
                }
                object.save(null, {
                    success: function(object){
                        //console.log("订货数量更新成功");
                        response.success(object);
                    },
                    error: function(object, error) {
                        console.log("产品:", product.id, ",中心:", orderSC.id, ",详情:", orderDetail.id, ",原子操作失败");
                        console.log("Error: " + error.code + " " + error.message);
                        response.error(error);
                    }
                });
            },
            error: function (error) {
                console.log("Error: " + error.code + " " + error.message);
                response.error(error);
            }
        })
    } else {
        response.success(null);
    }
});

AV.Cloud.beforeSave('OrderDetail', function(request, response){
    var orderDetail = request.object;
    if (orderDetail) {
        orderDetail.set("lastCount", 0);
        orderDetail.set("lastRealUnit", 0);
        var product = orderDetail.get("orderDetailProductName");
        product.fetch({
            success: function (pd) {
                var unitPerPackage = pd.get("unitPerPackage");
                var unitPrice = pd.get("unitPrice");
                var orderDetailProductCount = orderDetail.get("orderDetailProductCount");
                var realUnit = unitPerPackage * orderDetailProductCount;
                orderDetail.set("realUnit", realUnit);
                var realPrice = unitPrice * realUnit;
                orderDetail.set("realPrice", parseFloat(realPrice.toFixed(2)));
                orderDetail.set("orderSC", pd.get("sortingCenter"));
                orderDetail.set("isIndividualPackage", pd.get("isIndividualPackage"));

                var curOrderTime = orderDetail.get("orderTime");
                if (!curOrderTime){
                    orderDetail.set("orderTime", orderDetail.createdAt);
                }

                response.success();
                //AV.Cloud.run('incrementOrderSum4SC', {object: orderDetail}, {
                //    success: function (orderSum) {
                //        orderDetail.set("lastCount", orderDetailProductCount);
                //        orderDetail.set("lastRealUnit", orderDetail.get("realUnit"));
                //        response.success();
                //    },
                //    error: function (err) {
                //        //即便订货总量更新失败，仍然让订单明细保存成功
                //        //但这里不修改lastCount和lastRealUnit，仍保留值0，那么如果orderDetail会发生修改，则还有一次将总量修正的机会
                //        response.success();
                //    }
                //});
            }
        });
        //console.log("订单明细保存成功");
    }
});

AV.Cloud.afterSave('OrderDetail', function(request){
  console.log("进入orderDetail afterSave");
  var orderDetail = request.object;
  if (orderDetail) {
        //更新常购产品
    var product = orderDetail.get("orderDetailProductName");
    var store = orderDetail.get("orderStore");
    var queryOBP = new AV.Query(OftenBuyProducts);
    queryOBP.equalTo("store", store);
    queryOBP.equalTo("product", product);
    queryOBP.first({
      success:function(obp){
        if(obp){
          obp.set("refreshTime", moment().toDate());
          obp.save();
        }else{
          console.log("fuck you");
          var newOBP = new OftenBuyProducts();
          newOBP.set("store", store);
          newOBP.set("product", product);
          newOBP.set("refreshTime", moment().toDate());
          newOBP.save(null, {
            success:function(newOBP){

            },
            error:function(newOBP, error){
              console.log(error);
            }
          });
        }
      },
      error: function(error) {
        console.log("更新常购产品发生错误: " + error.code + " " + error.message);
      }
    });
  }
});

AV.Cloud.afterUpdate('OrderDetail', function(request){
    var orderDetail = request.object;
    if (orderDetail) {
        AV.Cloud.run('incrementOrderSum4SC', {object: orderDetail}, {
            success: function (orderSum) {
                //if(orderSum != null) {//即在incrementOrderSum4SC中发生了更新
                //console.log("订货数量更新成功");
                var product = orderDetail.get("orderDetailProductName");
                product.fetch({
                    success: function (pd) {
                        var unitPerPackage = pd.get("unitPerPackage");
                        var unitPrice = pd.get("unitPrice");
                        var orderDetailProductCount = orderDetail.get("orderDetailProductCount");
                        var realUnit = orderDetail.get("realUnit");
                        //第一次保存时，两个历史值lastCount和lastRealUnit都设置为0，之后在afterSave中就可以以正确的差值修改每日订货量
                        orderDetail.set("lastCount", orderDetailProductCount);
                        orderDetail.set("lastRealUnit", realUnit);
                        var realPrice = unitPrice * realUnit;
                        orderDetail.set("realPrice", parseFloat(realPrice.toFixed(2)));
                        orderDetail.save(null, {
                            success: function (orderDetail) {
                                //console.log("orderDetail保存成功,",orderDetail.get("realPrice"));
                            },
                            error: function (orderDetail, error) {

                            }
                        });
                    }
                });
            },
            error: function (err) {
                //处理调用失败
            }
        });
    }
});

AV.Cloud.define("PrintOrderDetail", function(request, response){
    var oid = request.params.oid;
    var query = new AV.Query(OrderDetail);
    query.get(oid, {
        success: function(orderDetail){
            response.success(orderDetail);
        },
        error: function(orderDetail, error){
            response.error();
        }
    });
});

// AV.Cloud.define("RefreshOftenBuyProducts", function(request, response){
//     var todayStart = moment().startOf('day').toDate();
//     var lastDayStart = moment().startOf('day').subtract(1, 'days').toDate();
//     var skipedCount = 0;
//     while(skipedCount < 10000)
//     {
//       var query = new AV.Query(OrderDetail);
//       query.greaterThanOrEqualTo("orderTime", lastDayStart);
//       query.lessThan("orderTime", todayStart);
//       query.skip(skipedCount);
//       skipedCount = skipedCount + 100;
//
//       query.find({
//         success: function(results) {
//           if (results.length > 0) {
//             console.log("更新常购产品，查询到昨日 " + results.length + " 个订单明细");
//             // 处理返回的结果数据
//             for (var i = 0; i < results.length; i++) {
//               var orderDetail = results[i];
//               var store = orderDetail.get("orderStore");
//               var product = orderDetail.get("orderDetailProductName");
//               var queryOBP = new AV.Query(OftenBuyProducts);
//               queryOBP.equalTo("store", store);
//               queryOBP.equalTo("product", product);
//               queryOBP.first({
//                 success:function(obp){
//                   if(obp){
//                     obp.set("refreshTime", moment().toDate);
//                     obp.save();
//                   }else{
//                     var newOBP = new OftenBuyProducts();
//                     newOBP.set("store", store);
//                     newOBP.set("product", product);
//                     newOBP.set("refreshTime", moment().toDate);
//                     newOBP.save();
//                   }
//                 }
//               });
//             }
//           }else{
//             console.log("更新常购产品完毕，退出执行");
//             return response.success();
//           }
//         },
//         error: function(error) {
//           console.log("更新常购产品发生错误: " + error.code + " " + error.message);
//           return response.error();
//         }
//       });
//     }
// });

module.exports = AV.Cloud;
