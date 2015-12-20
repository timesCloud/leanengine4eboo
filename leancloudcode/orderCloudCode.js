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

AV.Cloud.define("AddOrder", function(request, response){
  var hour = moment().hour();
  var caller = request.params.caller;//为1时表示为后台调用，不受时间限制
  if ((hour >= 10 && hour < 23) || caller == 1){
    var storeOid = request.params.storeOid;
    var userOid = request.params.userOid;
    var remark = request.params.remark;
    var detailList = request.params.detailList;
    var orderTime = moment().toDate();

    console.log("AddOrder，参数表：",storeOid, userOid, caller, remark, detailList, orderTime);

    if(storeOid && userOid && detailList.length > 0) {
        var order = new OrderTable();
        var store = AV.Object.createWithoutData("Store", storeOid);
        order.set("orderStore", store);
        var user = AV.Object.createWithoutData("_User", userOid);
        order.set("orderUser", user);
        order.set("remark", remark);
        order.set("orderSumPrice", 0);
        order.set("orderTime", orderTime);
        order.set("paymentTerm", 2);
        order.set("paymentMedium", 2);
        order.set("orderStatus", 2);

        store.fetch({//首先fetch店铺，以防店铺参数错误导致明细保存完成后订单保存失败
            success: function (store) {
                order.set("orderDC", store.get("storeDC"));
                var storeRoute = store.get("storeRoute");
                order.set("orderDeliveryRoute", storeRoute);
                order.set("orderSalesman", store.get("salesman"));
                storeRoute.fetch({
                    success: function (storeRoute) {
                        var deliverer = storeRoute.get("deliverer");
                        order.set("orderDelivery", deliverer);
                        order.fetchWhenSave(true);
                        //主要参数设置完毕，将order保存一次，获取objectId
                        order.save(null, {
                            success: function (order) {
                                var savedDetailCount = 0;
                                var orderDetailRelation = order.relation("orderDetail");
                                var detailerror = "";
                                for (var i = 0; i < detailList.length; i++) {
                                    var orderDetailInfo = detailList[i];
                                    var orderDetail = new OrderDetail();
                                    if(orderDetailInfo.productOid.length > 8) {
                                        var product = AV.Object.createWithoutData("Product", orderDetailInfo.productOid);
                                        orderDetail.set("orderDetailProductName", product);
                                        orderDetail.set("orderDetailProductCount", orderDetailInfo.count);
                                        orderDetail.set("orderTime", orderTime);
                                        orderDetail.set("orderStore", store);
                                        orderDetail.set("order", order);
                                        orderDetail.fetchWhenSave(true);
                                        orderDetail.save(null, {
                                            success: function (orderDetail) {
                                                orderDetailRelation.add(orderDetail);
                                                order.increment("orderSumPrice", orderDetail.get('realPrice'));
                                                if (++savedDetailCount >= detailList.length) {
                                                    //订单明细全部完成保存后，再次保存订单
                                                    //将order的分拣中心设置为最后一个明细关联的分拣中心
                                                    order.set("orderSC", orderDetail.get("orderSC"));
                                                    AV.Cloud.run('GenerateOrderID', {object: order}, {
                                                        success:function(orderID){
                                                            order.set("orderID", orderID);
                                                            order.save(null, {
                                                                success: function (order) {
                                                                    console.log("下单成功", detailerror);
                                                                    response.success(detailerror);
                                                                },
                                                                error: function (order, error) {
                                                                    response.error("服务器故障，请联系客服");
                                                                }
                                                            });//订单保存结束
                                                        },
                                                        error:function(error){
                                                            response.error("订单编号生成失败");
                                                        }
                                                    });

                                                }
                                            },
                                            error: function (orderDetail, error) {
                                                //订单明细保存失败不影响订单本身的保存，但需要将错误提示积累起来，最后返回
                                                ++savedDetailCount;
                                                detailerror = detailerror + error.message + ",";
                                            }
                                        });
                                    }else{
                                        ++savedDetailCount;
                                    }
                                }//订单明细保存结束
                            },
                            error: function (order, error) {
                                response.error("服务器故障，订单保存失败，请联系客服");
                            }
                        });//订单保存结束
                        //store相关参数设置完毕，保存订单明细
                    },
                    error: function (error) {
                        response.error("配送路线匹配失败，请联系客服");
                    }
                });
            },
            error: function (error) {
                response.error("店铺查询失败，请联系客服");
            }
        });
    }else{
        response.error("创建订单的参数错误，请联系客服");
    }
  }else{
      response.error("抱歉，系统下单时段为10:00-23:00，当前时间系统已停止接单");
  }
});

var number2ID = function(number, keepLength){
    var len = number.toString().length;
    if (len > keepLength) {
        number = number % Math.pow(10,keepLength);//截取低6位
    } else {
        while (len < keepLength) {
            number = "0" + number;
            len++;
        }
    }
    return number;
};

AV.Cloud.define('GenerateOrderID', function(request, response){
    var orderTable = request.params.object;

    var orderNo = orderTable.get("orderNo");
    var orderSC = orderTable.get("orderSC");
    var orderDC = orderTable.get("orderDC");

    var num = number2ID(orderNo, 6);

    orderSC.fetch({
        success: function (sc) {
            var scID = sc.get("scID");
            orderDC.fetch({
                success: function (dc) {
                    var dcID = dc.get("dcID");
                    response.success(scID + dcID + num);
                },
                error: function (error) {
                    var dcID = "NaDC";
                    response.success(scID + dcID + num);
                }
            });
        },
        error: function (error) {
            var scID = "NS";
            orderDC.fetch({
                success: function (dc) {
                    var dcID = dc.get("dcID");
                    response.success(scID + dcID + num);
                },
                error: function (error) {
                    var dcID = "NaDC";
                    response.success(scID + dcID + num);
                }
            });
        }
    });
});

var DivideProductsBySC = function(params){

}

// AV.Cloud.define('Number2ID', function(request, response) {
//     var number = request.params.number;
//     var keepLength = request.params.keepLength;
//     var len = number.toString().length;
//     if (len > keepLength) {
//         number = number % Math.pow(10,keepLength);//截取低6位
//     } else {
//         while (len < keepLength) {
//             number = "0" + number;
//             len++;
//         }
//     }
//     response.success(number);
// });

// AV.Cloud.beforeSave('OrderTable', function(request, response){
//     //订单设置配送中心、配送线路、配送员的代码已经移到AddOrder中，待第一版APP停用后下列代码全部删除
//     var order = request.object;
//     order.set("orderStatus", 2);
//     var store = order.get("orderStore");
//     store.fetch({
//         success: function(store){
//             order.set("orderDC", store.get("storeDC"));
//             var storeRoute = store.get("storeRoute");
//             order.set("orderDeliveryRoute", storeRoute);
//             order.set("orderSalesman", store.get("salesman"));
//             storeRoute.fetch({
//                 success: function(storeRoute){
//                     var deliverer = storeRoute.get("deliverer");
//                     order.set("orderDelivery", deliverer);
//                     response.success(order);
//                 },
//                 error: function(error){
//                     response.error(error);
//                 }
//             });
//         },
//         error: function(error){
//             response.error(error);
//         }
//     })
// });

// AV.Cloud.afterSave('OrderTable', function(request){
//     var order = request.object;
//     //生成订单编号
//     AV.Cloud.run('GenerateOrderID', {object : order}, {
//         success:function(object){
//             //console.log("");
//         },
//         error:function(error) {
//             console.log("Error: " + error);
//         }
//     });
//
//     var orderDetail = originOrder.relation("orderDetail");
//     orderDetail.query().find({
//         success:function(orderDetailList){
//         },
//         error:function(error){
//
//         }
//     });
// });

// AV.Cloud.define('GenerateOrderID', function(request, response){
//     var orderTable = request.params.object;
//
//     var orderNo = orderTable.get("orderNo");
//     var orderSC = orderTable.get("orderSC");
//     var orderDC = orderTable.get("orderDC");
//     var orderID = orderTable.get("orderID");
//
//     if(orderNo && orderSC && orderDC && !orderID) {
//         AV.Cloud.run('Number2ID', {number: orderNo, keepLength: 6}, {
//             success: function (num) {
//                 orderSC.fetch({
//                     success: function (sc) {
//                         var scID = sc.get("scID");
//                         orderDC.fetch({
//                             success: function (dc) {
//                                 var dcID = dc.get("dcID");
//                                 orderTable.set("orderID", scID + dcID + num);
//                                 orderTable.save();
//                                 response.success();
//                             },
//                             error: function (error) {
//                                 var dcID = "";
//                                 orderTable.set("orderID", scID + dcID + num);
//                                 orderTable.save();
//                                 response.success();
//                             }
//                         });
//                     },
//                     error: function (error) {
//                         var scID = "";
//                         orderDC.fetch({
//                             success: function (dc) {
//                                 var dcID = dc.get("dcID");
//                                 orderTable.set("orderID", scID + dcID + num);
//                                 orderTable.save();
//                                 response.success();
//                             },
//                             error: function (error) {
//                                 var dcID = "";
//                                 orderTable.set("orderID", scID + dcID + num);
//                                 orderTable.save();
//                                 response.success();
//                             }
//                         });
//                     }
//                 });
//             }
//         });
//     }
//     else{
//         if(!orderID){
//             console.log("编号生成失败：", orderNo);
//             response.error();
//         }
//         else{
//             response.success();
//         }
//     }
// });

AV.Cloud.define('RecalculateAmount', function(request, response){
    var originOrder = request.params.object;

    console.log("订单更新价格：",originOrder.get("orderID"));
    var orderLastSumPrice = originOrder.get("orderSumPrice");
    var orderDetail = originOrder.relation("orderDetail");
    orderDetail.query().find({
        success: function (orderDetailList) {
            if (orderDetailList.length > 0) {
                var firstOrderDetail = orderDetailList[0];
                //首先将总价设置为第一条明细的价格，否则可能因为lean的某些bug导致总价错误
                originOrder.set("orderSumPrice", firstOrderDetail.get("realPrice"));
                for (var i = 1; i < orderDetailList.length; i++) {
                    var pendingOrderDetail = orderDetailList[i];
                    originOrder.increment("orderSumPrice", pendingOrderDetail.get('realPrice'));
                }
                //截断到小数点后两位
                var orderCurSumPrice = originOrder.get("orderSumPrice");
                orderCurSumPrice = parseFloat(orderCurSumPrice.toFixed(2));
                originOrder.set("orderSumPrice", orderCurSumPrice);
                if (orderLastSumPrice != orderCurSumPrice) {
                    console.log("订单明细统计的总价发生变化", orderLastSumPrice, orderCurSumPrice);
                    originOrder.save();
                }
            }
        },
        error: function (error) {
            console.log("Error: " + error.code + " " + error.message);
        }
    });
});

AV.Cloud.afterUpdate('OrderTable', function(request){
    console.log("进入OrderTable afterUpdate");
    var originOrder = request.object;
    AV.Cloud.run('RecalculateAmount', {object : request.object}, {
        success:function(object){

        },
        error:function(error){
            console.log("Error: " + error.code + " " + error.message);
        }
    });
});


AV.Cloud.define('setOrderStatu', function(request, response) {
    var orderOidArray = request.params.orderOids;
    var statu = request.params.statu;
    var successArray = new Array();
    var failedArray = new Array();
    for(var i = 0; i < orderOidArray.length; i++){
        var oid = orderOidArray[i];
        var query = new AV.Query(OrderTable);
        query.get(oid, {
            success: function(order){
                order.set("orderStatus", statu);
                order.save(null, {
                    success: function(order) {
                        successArray.push(order);
                        if(successArray.length + failedArray.length >= orderOidArray.length){
                            response.success({"success" : successArray, "failed" : failedArray});
                        }
                    },
                    error: function(error){
                        failedArray.add(error);
                        response.success({"success" : successArray, "failed" : failedArray});
                    }
                });
            },
            error:function(error){
                failedArray.add(error);
                response.success({"success" : successArray, "failed" : failedArray});
            }
        });
    }
});

AV.Cloud.define('setOrderDetailBinding', function(request, response){
  var query = new AV.Query(OrderTable);
  query.equalTo('lastRealUnit', 9999);
  query.find({
    success: function(results) {
      response.success(results);
    },
    error: function(error) {
      response.error("Error: " + error.code + " " + error.message);
    }
  });
});

AV.Cloud.define('setOrderFieldValue', function(request, response) {
    var orderOidArray = request.params.orderOids;
    var field = request.params.field;
    var value = request.params.value;
    var successArray = new Array();
    var failedArray = new Array();
    for(var i = 0; i < orderOidArray.length; i++){
        var oid = orderOidArray[i];
        var query = new AV.Query(OrderTable);
        query.get(oid, {
            success: function(order){
                order.set(field, value);
                order.save(null, {
                    success: function(order) {
                        successArray.push(order);
                        if(successArray.length + failedArray.length >= orderOidArray.length){
                            response.success({"success" : successArray, "failed" : failedArray});
                        }
                    },
                    error: function(error){
                        failedArray.add(error);
                        response.success({"success" : successArray, "failed" : failedArray});
                    }
                });
            },
            error:function(error){
                failedArray.add(error);
                response.success({"success" : successArray, "failed" : failedArray});
            }
        });
    }
});

AV.Cloud.define('SetOrderEnableNCancel', function(request, response){
    var orderOid = request.params.orderOid;
    var enabled = request.params.enabled;
    var canceled = request.params.canceled;
    var query = new AV.Query(OrderTable);
    query.get(orderOid, {
        success: function(order){
            var alreadyCanceled = order.get("canceled");//先缓存当前是否取消的状态
            var alreadyEnabled = order.get("enabled");//先缓存当前是否取消的状态
            order.set("enabled", (enabled == 'True' || enabled == 'true'));
            if(enabled)
                order.set("canceled", (canceled == 'True' || canceled == 'true'));
            else//如果订单被删除（enabled为false），那么订单必须设置为取消（canceled为true）
                order.set("canceled", true);

            var curCanceled = order.get("canceled");
            var curEnabled = order.get("enabled");
            //如果之前是正常状态，现在设置为取消，则需要将订单明细全部取消
            //反之，如果之前已取消，现在设置为正常，则需要将订单明细全部恢复
            if((!alreadyCanceled && curCanceled) || (alreadyCanceled && !curCanceled)
                || (!alreadyEnabled && curEnabled) || (alreadyEnabled && !curEnabled)){
                var detailRelation = order.relation("orderDetail");
                detailRelation.query().find({
                    success:function(detailList){
                        var processedDetailCount = 0;
                        for(var j = 0; j < detailList.length; j++){
                            var orderDetail = detailList[j];
                            orderDetail.set("canceled", curCanceled);
                            orderDetail.save(null,{
                                success:function(orderDetail){
                                    if(++processedDetailCount >= detailList.length){//此段代码和下方orderDetail保存失败内的代码相同
                                        order.save(null, {
                                            success: function(order) {
                                                response.success(order);
                                            },
                                            error: function(error){
                                                response.error(error);
                                            }
                                        });
                                    }
                                },
                                error:function(error){
                                    response.error(error);
                                }
                            });
                        }
                    },
                    error:function(error){
                        response.error(error);
                    }
                });
            }
            else{
                response.success(order);
            }
        },
        error:function(error){
            response.error(error);
        }
    });
});

AV.Cloud.define('BatchSetOrderEnableNCancel', function(request, response) {
    var orderOidArray = request.params.orderOids;
    var enabled = request.params.enabled;
    var canceled = request.params.canceled;
    var successArray = new Array();
    var failedArray = new Array();
    for(var i = 0; i < orderOidArray.length; i++){
        var oid = orderOidArray[i];
        AV.Cloud.run("SetOrderEnableNCancel", {orderOid:oid, enabled:enabled, canceled:canceled}, {
            success:function(order){
                successArray.push(order);
                if(successArray.length + failedArray.length >= orderOidArray.length){
                    response.success({"success" : successArray, "failed" : failedArray});
                }
            },
            error:function(error){
                failedArray.push(error);
                if(successArray.length + failedArray.length >= orderOidArray.length){
                    response.error({"success" : successArray, "failed" : failedArray});
                }
            }
        });
    }
});

AV.Cloud.define("SetOrderNumberInDay", function(request, response){
    var date = request.params.date;
    var dateStart = moment(date).startOf('day').toDate();
    var dateEnd = moment(date).endOf('day').toDate();
    console.log(dateStart, dateEnd);
    var query = new AV.Query(OrderTable);
    query.greaterThanOrEqualTo("orderTime", dateStart);
    query.lessThanOrEqualTo("orderTime", dateEnd);
    query.addAscending('earlyTime');
    query.addAscending('latestTime');
    query.find({
        success: function(orderList){
            var completeCount = 0;
            for (var i = 0; i < orderList.length; i++) {
                var order = orderList[i];
                order.set('numberInDay', i + 1);
                order.save(null, {
                    success: function(order){
                        if(++completeCount >= orderList.length){
                            response.success("共更新订单数：", completeCount);
                        }
                    },
                    error: function(order, error){
                        response.error(error);
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
