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
    var storeOid = request.params.storeOid;
    var userOid = request.params.userOid;
    var remark = request.params.remark;
    var detailList = request.params.detailList;
    var orderTime = moment().toDate();

    console.log("AddOrder，参数表：",storeOid, userOid, remark, detailList, orderTime);

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

        store.fetch({//首先fetch店铺，以防店铺参数错误导致明细保存完成后订单保存失败
            success: function (store) {
                order.set("orderDC", store.get("storeDC"));
                var storeRoute = store.get("storeRoute");
                order.set("orderDeliveryRoute", storeRoute);
                storeRoute.fetch({
                    success: function (storeRoute) {
                        var deliverer = storeRoute.get("deliverer");
                        order.set("orderDelivery", deliverer);

                        //store相关参数设置完毕，保存订单明细
                        var savedDetailCount = 0;
                        var orderDetailRelation = order.relation("orderDetail");
                        for (var i = 0; i < detailList.length; i++) {
                            var orderDetailInfo = detailList[i];
                            var orderDetail = new OrderDetail();
                            if(orderDetailInfo.productOid.length > 8) {
                                var product = AV.Object.createWithoutData("Product", orderDetailInfo.productOid);
                                orderDetail.set("orderDetailProductName", product);
                                orderDetail.set("orderDetailProductCount", orderDetailInfo.count);
                                orderDetail.set("orderTime", orderTime);
                                orderDetail.set("orderStore", store);
                                orderDetail.fetchWhenSave(true);
                                orderDetail.save(null, {
                                    success: function (orderDetail) {
                                        orderDetailRelation.add(orderDetail);
                                        order.increment("orderSumPrice", orderDetail.get('realPrice'));
                                        if (++savedDetailCount >= detailList.length) {
                                            //订单明细全部完成保存后，保存订单
                                            order.set("orderSC", orderDetail.get("orderSC"));//将order的分拣中心设置为最后一个明细关联的分拣中心
                                            order.save(null, {
                                                success: function (order) {
                                                    response.success(order);
                                                },
                                                error: function (order, error) {
                                                    response.error("服务器故障，请联系客服");
                                                }
                                            });//订单保存结束
                                        }
                                    },
                                    error: function (orderDetail, error) {
                                        response.error("订单明细保存失败，请联系客服");
                                    }
                                });
                            }else{
                                ++savedDetailCount;
                            }
                        }//订单明细保存结束

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
});

var checkAddOrderParams = function(params){

}

AV.Cloud.define('Number2ID', function(request, response) {
    var number = request.params.number;
    var keepLength = request.params.keepLength;
    var len = number.toString().length;
    if (len > keepLength) {
        number = number % Math.pow(10,keepLength);//截取低6位
    } else {
        while (len < keepLength) {
            number = "0" + number;
            len++;
        }
    }
    response.success(number);
});

AV.Cloud.beforeSave('OrderTable', function(request, response){
    //订单设置配送中心、配送线路、配送员的代码已经移到AddOrder中，待第一版APP停用后下列代码全部删除
    var order = request.object;
    order.set("orderStatus", 2);
    var store = order.get("orderStore");
    store.fetch({
        success: function(store){
            order.set("orderDC", store.get("storeDC"));
            var storeRoute = store.get("storeRoute");
            order.set("orderDeliveryRoute", storeRoute);
            order.set("orderSalesman", store.get("salesman"));
            storeRoute.fetch({
                success: function(storeRoute){
                    var deliverer = storeRoute.get("deliverer");
                    order.set("orderDelivery", deliverer);
                    response.success(order);
                },
                error: function(error){
                    response.error(error);
                }
            });
        },
        error: function(error){
            response.error(error);
        }
    })
});

AV.Cloud.afterSave('OrderTable', function(request){
    var order = request.object;
    AV.Cloud.run('GenerateOrderID', {object : order}, {
        success:function(object){
            //console.log("");
        },
        error:function(error) {
            console.log("Error: " + error);
        }
    });
});

AV.Cloud.define('GenerateOrderID', function(request, response){
    var orderTable = request.params.object;

    var orderNo = orderTable.get("orderNo");
    var orderSC = orderTable.get("orderSC");
    var orderDC = orderTable.get("orderDC");
    var orderID = orderTable.get("orderID");

    if(orderNo && orderSC && orderDC && !orderID) {
        AV.Cloud.run('Number2ID', {number: orderNo, keepLength: 6}, {
            success: function (num) {
                orderSC.fetch({
                    success: function (sc) {
                        var scID = sc.get("scID");
                        orderDC.fetch({
                            success: function (dc) {
                                var dcID = dc.get("dcID");
                                orderTable.set("orderID", scID + dcID + num);
                                orderTable.save();
                                response.success();
                            },
                            error: function (error) {
                                var dcID = "";
                                orderTable.set("orderID", scID + dcID + num);
                                orderTable.save();
                                response.success();
                            }
                        });
                    },
                    error: function (error) {
                        var scID = "";
                        orderDC.fetch({
                            success: function (dc) {
                                var dcID = dc.get("dcID");
                                orderTable.set("orderID", scID + dcID + num);
                                orderTable.save();
                                response.success();
                            },
                            error: function (error) {
                                var dcID = "";
                                orderTable.set("orderID", scID + dcID + num);
                                orderTable.save();
                                response.success();
                            }
                        });
                    }
                });
            }
        });
    }
    else{
        if(!orderID){
            console.log("编号生成失败：", orderNo);
            response.error();
        }
        else{
            response.success();
        }
    }
});

AV.Cloud.define('OrderDivision', function(request, response){
    var originOrder = request.params.object;
    var originOrderSC = originOrder.get("orderSC");
    var OrderTable = AV.Object.extend("OrderTable");
    if(!originOrderSC){
        console.log("原始订单分拣中心字段为空");
        var orderArray = new Array();
        var orderDetail = originOrder.relation("orderDetail");
        orderDetail.query().find({
            success:function(orderDetailList){
                console.log("订单明细数量为：", orderDetailList.length);
                if(orderDetailList.length > 0){
                    var firstOrderDetail = orderDetailList[0];
                    var firstOrderSC = firstOrderDetail.get("orderSC");
                    originOrder.set("orderSC", firstOrderSC);//原订单的分拣中心设为和首个订单明细相同
                    //originOrder.set("orderSumPrice", firstOrderDetail.get("realPrice"));//重新统计订单总价
                    orderArray.push(originOrder);//将原订单添加到订单数组
                    //遍历所有的订单明细,由于第一个明细会保留在原订单，所以从第二个明细开始遍
                    //for(var i=1; i<orderDetailList.length; i++){
                    //  var pendingOrderDetail = orderDetailList[i];
                    //  var pendingOrderSC = pendingOrderDetail.get("orderSC");
                    //  console.log("分拣中心Oid对比：",pendingOrderSC.id,firstOrderSC.id);
                    //  if (pendingOrderSC.id != firstOrderSC.id){//如果有和原订单分拣中心不同的订单明细
                    //    orderDetail.remove(pendingOrderDetail);//将该订单明细从原订单中移除
                    //    var matchedOrder = null;
                    //    for(var j=0; j<orderArray.length; j++){//从订单数组中查询是否有分拣中心匹配的订单
                    //      var curOrder = orderArray[j];
                    //      var curOrderSC = curOrder.get("orderSC");
                    //      if(pendingOrderSC.get("objectId") == curOrderSC.get("objectId")){
                    //        matchedOrder =curOrder;
                    //        break;
                    //      }
                    //    }
                    //    if(~matchedOrder){//如果没有找到同分拣中心匹配的子订单，则新建一个
                    //      var newOrder = new OrderTable();
                    //      newOrder.set("orderStore", originOrder.get("orderStore"));
                    //      newOrder.set("orderTime", originOrder.get("orderTime"));
                    //      newOrder.set("orderUser", originOrder.get("orderUser"));
                    //      newOrder.set("orderStatus", originOrder.get("orderStatus"));
                    //      newOrder.set("orderSC", pendingOrderSC);
                    //      newOrder.set("orderDC", originOrder.get("orderDC"));
                    //      newOrder.set("refunded", true);
                    //      newOrder.set('orderSumPrice', 0);
                    //      newOrder.set("orderDeliveryRoute", originOrder.get("orderDeliveryRoute"));
                    //
                    //      orderArray.push(newOrder);//将新订单放进订单数组
                    //      matchedOrder = newOrder;
                    //    }
                    //
                    //    var orderDetailInNewOrder = matchedOrder.relation("orderDetail");
                    //    orderDetailInNewOrder.add(pendingOrderDetail);
                    //    var curSumPrice = matchedOrder.get("orderSumPrice");
                    //    console.log("详情对象：", pendingOrderDetail.id, "curSumPrice现值：", curSumPrice);
                    //    if(curSumPrice == undefined) curSumPrice = 0;
                    //    matchedOrder.set('orderSumPrice', curSumPrice + pendingOrderDetail.get('realPrice'));
                    //  }
                    //  else{//无需从原单拆出的明细，则直接向
                    //    originOrder.increment("orderSumPrice", pendingOrderDetail.get('realPrice'));
                    //  }
                    //}

                    for(var k = 0; k < orderArray.length; k++){
                        var order = orderArray[k];
                        var orderNo = k + 1;
                        console.log("保存订单：" + orderNo + "/" + orderArray.length);

                        order.fetchWhenSave(true);
                        order.save(null, {
                            success: function(savedOrder) {//save成功后才能fetch到orderNo
                                AV.Cloud.run('GenerateOrderID', {object : savedOrder}, {
                                    success:function(object){

                                    },
                                    error:function(error) {
                                        console.log("Error: " + error.code + " " + error.message);
                                    }
                                });
                            }
                        });
                    }
                }else{
                    console.log("原始订单不包含订单明细，放弃处理");
                }
                response.success();
            },
            error:function(error){
                console.log(error.code + ' : ' + error.message);
                response.error(error);
            }
        })
    }
    else {
        //已绑定分拣中心的订单，前端不允许再增加非该中心的产品，所以这里也不再做拆单
        var canceled = originOrder.get("canceled");
        var enabled = originOrder.get("enabled");
        if (enabled) {
            console.log("原始订单分拣中心字段非空，仅更新价格");
            var orderLastSumPrice = originOrder.get("orderSumPrice");
            var orderDetail = originOrder.relation("orderDetail");
            orderDetail.query().find({
                success: function (orderDetailList) {
                    if (orderDetailList.length > 0) {
                        var firstOrderDetail = orderDetailList[0];
                        ////为处理订单从取消/删除的状态改回正常状态时的订货量和价格
                        ////首先判断首条明细的实际订货量是否为0，如果为0则冲新计算
                        //var firstRealUnit = firstOrderDetail.get("realUnit");
                        //if (firstRealUnit == 0){
                        //
                        //}
                        originOrder.set("orderSumPrice", firstOrderDetail.get("realPrice"));//重新统计订单总价
                        for (var i = 1; i < orderDetailList.length; i++) {
                            var pendingOrderDetail = orderDetailList[i];
                            originOrder.increment("orderSumPrice", pendingOrderDetail.get('realPrice'));
                        }
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
        }
        else {
            //console.log("原始订单已被删除，将订单明细实际订货数修改为0");
            //var orderDetail = originOrder.relation("orderDetail");
            //orderDetail.query().find({
            //  success:function(orderDetailList){
            //    for(var i=0; i<orderDetailList.length; i++){
            //      var pendingOrderDetail = orderDetailList[i];
            //      var curRealUnit = pendingOrderDetail.get("realUnit");
            //      if (curRealUnit != 0){
            //        pendingOrderDetail.set("realUnit", 0);
            //        pendingOrderDetail.save();
            //      }
            //    }
            //  },
            //  error: function (error) {
            //    console.log("Error: " + error.code + " " + error.message);
            //  }
            //});
        }
    }
});

AV.Cloud.afterUpdate('OrderTable', function(request){
    console.log("进入OrderTable afterUpdate");
    var originOrder = request.object;
    AV.Cloud.run('OrderDivision', {object : request.object}, {
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

AV.Cloud.define("PrintOrder", function(request, response){
    var oid = request.params.oid;
    var query = new AV.Query(OrderTable);
    query.get(oid, {
        success: function(order){
            response.success(order);
        },
        error: function(order, error){
            response.error();
        }
    });
});

module.exports = AV.Cloud;
