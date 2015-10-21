var AV = require('leanengine');
var _ = require('underscore');
var moment = require('moment');
var OrderSum4SC = AV.Object.extend("OrderSum4SC");
var OrderTable = AV.Object.extend("OrderTable");
var OrderDetail = AV.Object.extend("OrderDetail");
var DistributionCenter = AV.Object.extend("DistributionCenter");
var DeliveryRoute = AV.Object.extend("DeliveryRoute");
var User = AV.Object.extend("User");

var wcSignature = require('./wechat/wcSignature.js');

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
});

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
        orderDetail.set("isIndividualPackage", pd.get("isIndividualPackage"));

        var curOrderTime = orderDetail.get("orderTime");
        if (!curOrderTime){
          orderDetail.set("orderTime", orderDetail.createdAt);
        }

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

AV.Cloud.define('GetWechatSignature', function(request, response){
  console.log('GetWechatSignature begin');
  wcSignature.exec(request.params, function(err, data) {
    if (err) {
      response.error(err.code || 500, err.message);
    } else {
      response.success(data);
    }
  });
});

module.exports = AV.Cloud;
