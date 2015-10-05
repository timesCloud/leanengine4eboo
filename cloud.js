var AV = require('leanengine');
var _ = require('underscore');
var moment = require('moment');
var OrderSum4SC = AV.Object.extend("OrderSum4SC");
var OrderTable = AV.Object.extend("OrderTable");
var OrderDetail = AV.Object.extend("OrderDetail");
var DistributionCenter = AV.Object.extend("DistributionCenter");
var DeliveryRoute = AV.Object.extend("DeliveryRoute");
var User = AV.Object.extend("User");

/**
 * 一个简单的云代码方法
 */
AV.Cloud.define('hello', function(req, res) {
  console.log(req)
  res.success('Hello world!');
});

// 从 content 中查找 tag 的正则表达式
var tagRe = /#(\w+)/g

/**
 * Todo 的 beforeSave hook 方法
 * 将 content 中的 #<tag> 标记都提取出来，保存到 tags 属性中
 */
AV.Cloud.beforeSave('Todo', function(req, res) {
  var todo = req.object;
  var content = todo.get('content');
  var tags = todo.get('content').match(tagRe);
  tags = _.uniq(tags);
  todo.set('tags', tags);
  res.success();
})

AV.Cloud.afterSave('DetailPrice', function(request){
  var answer = request.object.get('answer');
  console.log(answer);
  if(answer){
    var query = new AV.Query('Answer');
    query.get(answer.id, {
      success: function(answer){
        var relation = answer.relation('deatilPrice');
        relation.add(request.object);
        answer.save();
        console.log("向answer增加DetailPrice成功")
      },
      error: function(error){
        console.log('Error happened when find answer, after save DetailNeeds:', error);
      }
    })
  }
  else{
    console.log('当前DetailNeeds没有设置Answer')
  }
})

AV.Cloud.afterSave('BatchTable', function(request){
  var object1= request.object;
  var BatchTable=AV.Object.extend("BatchTable");
  var query=new AV.Query(BatchTable);
  query.include("product");
  query.include("productType");
  query.get(object1.id,{
    success:function(object){
      var date=new Date();
      var year = date.getFullYear();
      var month = date.getMonth() + 1;
      var day = date.getDate();
      var datenow=year.toString()+month.toString()+day.toString();

      var typeName=object.get("productType").get("typeID");

      var productName=object.get("product").get("productID");
      var serialNo=object.get("serialNo");
      var batchID=typeName+productName+datenow+serialNo;
      console.log(batchID);
      object.set("batchID",batchID);
      object.save();
    }
  });
});

AV.Cloud.define("AddOrder", function(request, response){
  var storeOid = request.params.storeOid;
  var userOid = request.params.userOid;
  var remark = request.params.remark;
  var detailList = request.params.detailList;
  var orderTime = moment().toDate();

  if(storeOid && userOid && detailList.length > 0) {
    var order = new OrderTable();
    var store = AV.Object.createWithoutData("Store", storeOid);
    order.set("orderStore", store);
    var user = AV.Object.createWithoutData("_User", userOid);
    order.set("orderUser", user);
    order.set("remark", remark);
    order.set("orderSumPrice", 0);
    order.set("orderTime", orderTime);

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
              var product = AV.Object.createWithoutData("Product", orderDetailInfo.productOid);
              orderDetail.set("orderDetailProductName", product);
              orderDetail.set("orderDetailProductCount", orderDetailInfo.count);
              orderDetail.set("orderTime", orderTime);
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
                        response.error("订单最终保存失败：" + error);
                      }
                    });//订单保存结束
                  }
                },
                error: function (orderDetail, error) {
                  response.error("订单明细保存失败：" + error);
                }
              });
            }//订单明细保存结束

          },
          error: function (error) {
            response.error("配送路线fetch失败，订单保存失败：" + error);
          }
        });
      },
      error: function (error) {
        response.error("店铺fetch失败订单保存失败：" + error);
      }
    });
  }else{
    response.error("调用AddOrder时参数传入错误");
  }
});

//AV.Cloud.define("")

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
  var store = order.get("orderStore");
  store.fetch({
    success: function(store){
      order.set("orderDC", store.get("storeDC"));
      var storeRoute = store.get("storeRoute");
      order.set("orderDeliveryRoute", storeRoute);
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
      console.log("Error: " + error.code + " " + error.message);
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
      console.log("原始订单已被删除，将订单明细实际订货数修改为0");
      var orderDetail = originOrder.relation("orderDetail");
      orderDetail.query().find({
        success:function(orderDetailList){
          for(var i=0; i<orderDetailList.length; i++){
            var pendingOrderDetail = orderDetailList[i];
            var curRealUnit = pendingOrderDetail.get("realUnit");
            if (curRealUnit != 0){
              pendingOrderDetail.set("realUnit", 0);
              pendingOrderDetail.save();
            }
          }
        },
        error: function (error) {
          console.log("Error: " + error.code + " " + error.message);
        }
      });
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

AV.Cloud.afterSave('DetailPrice', function(request) {
  var answer = request.object.get('answer');
  console.log(answer);
  if(answer){
    var query = new AV.Query('Answer');
    query.get(answer.id, {
      success: function(answer){
        var relation = answer.relation('deatilPrice');
        relation.add(request.object);
        answer.save();
        console.log("向answer增加DetailPrice成功")
      },
      error: function(error){
        console.log('Error happened when find answer, after save DetailNeeds:', error);
      }
    })
  }
  else{
    console.log('当前DetailNeeds没有设置Answer')
  }
});

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
            console.log("订货数量更新成功");
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

        AV.Cloud.run('incrementOrderSum4SC', {object: orderDetail}, {
          success: function (orderSum) {
            orderDetail.set("lastCount", orderDetailProductCount);
            orderDetail.set("lastRealUnit", orderDetail.get("realUnit"));
            response.success();
          },
          error: function (err) {
            //即便订货总量更新失败，仍然让订单明细保存成功
            //但这里不修改lastCount和lastRealUnit，仍保留值0，那么如果orderDetail会发生修改，则还有一次将总量修正的机会
            response.success();
          }
        });
      }
    });
    //console.log("订单明细保存成功");
  }
});

AV.Cloud.afterUpdate('OrderDetail', function(request){
  var orderDetail = request.object;
  if (orderDetail) {
    AV.Cloud.run('incrementOrderSum4SC', {object: orderDetail}, {
      success: function (orderSum) {
        //if(orderSum != null) {//即在incrementOrderSum4SC中发生了更新
          console.log("订货数量更新成功");
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
              console.log(orderDetail.get("realPrice"));
              orderDetail.save(null, {
                success: function (orderDetail) {
                  console.log("orderDetail保存成功,",orderDetail.get("realPrice"));
                },
                error: function (orderDetail, error) {

                }
              });
            }
          });
        //}
        console.log("订单明细保存成功");

      },
      error: function (err) {
        //处理调用失败
      }
    });
  }
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
      order.set("enabled", (enabled == 'True' || enabled == 'true'));
      if(enabled)
        order.set("canceled", (canceled == 'True' || canceled == 'true'));
      else//如果订单被删除（enabled为false），那么订单必须设置为取消（canceled为true）
        order.set("canceled", true);

      var curCanceled = order.get("canceled");
      //如果之前是正常状态，现在设置为取消，则需要将订单明细全部取消
      //反之，如果之前已取消，现在设置为正常，则需要将订单明细全部恢复
      if((!alreadyCanceled && curCanceled) || (alreadyCanceled && !curCanceled)){
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

AV.Cloud.define('EditUser', function(request, response) {
  var name = request.params.ListName;
  var key = request.params.ListKey;
  var id = request.params.UserID;
  var RoleID = request.params.RoleID;
  var User = AV.Object.extend("User"); 	
  var query = new AV.Query(User);
  query.get(id, {
    success: function(user) {
      for (var i = 0; i < name.length; i++) {
        if(name[i]=='role'){
          var CustomRole = AV.Object.extend("CustomRole");
          var MyRole=new CustomRole();
          MyRole.id=RoleID;
          user.set('role',MyRole);
          user.set('power',key[i]);
          continue;
        }
        user.set(name[i], key[i]);
      }
      user.save(null, {
        success: function(user) {
          // 成功保存之后，执行其他逻辑.
          response.success("更新成功！");
        },
        error: function(user, error) {
          response.error("更新失败！"+error.message);
        }
      });
    },
    error: function(user, error) {
      console.log('error');
      response.error("更新失败"+error.message);
    }

  });
});

AV.Cloud.define('EnabledUser', function(request, response) {
  var id = request.params.UserID;
  var query = new AV.Query(User);
  query.get(id, {
    success: function(user) {
      user.set('enabled',false);
      user.save(null, {
        success: function(user) {
          // 成功保存之后，执行其他逻辑.
          response.success("删除成功！");
        },
        error: function(user, error) {
          response.error("删除失败！");
        }
      });
    },
    error: function(user, error) {
      console.log('error');
      response.error("删除失败");
    }
  });
});

AV.Cloud.define('RefreshOrderDetailStatInOneDay', function(request, response){
  var ds = request.params.dateStart;
  var de = request.params.dateEnd;
  var dateStart = moment(ds);
  var dateEnd = moment(de);

  var query = new AV.Query(OrderTable);
  query.equalTo("canceled", false);
  query.equalTo("enabled", true);
  query.greaterThanOrEqualTo("date", dateStart.toDate());
  query.lessThanOrEqualTo("date", dateEnd.toDate());
  query.limit(1000);
  query.find({
    success: function(results) {
      var orderCount = results.length;
      var orderProcessedCount = 0;
      for(var i = 0; i < results.length; i++){
        var order = results[i];
        var orderDetailRelation = order.relation("orderDetail");
        orderDetailRelation.query().find({
          success: function(orderDetailList){
            for(var i = i; i < orderDetailList.length; i++){
              var orderDetail = orderDetailList[i];
              var product
              var orderSum = new Object();
            }
          },
          error: function(error){

          }
        });
      }
    },
    error: function(error){
      console.log('error');
    }
  });
});

module.exports = AV.Cloud;
