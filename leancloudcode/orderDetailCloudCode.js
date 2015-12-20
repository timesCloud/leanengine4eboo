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

AV.Cloud.beforeSave('OrderDetail', function(request, response){
    var orderDetail = request.object;
    if (orderDetail) {
        var product = orderDetail.get("orderDetailProductName");
        product.fetch({
            success: function (pd) {
                if(pd.get('onsell')){//商品是上架状态
                    var unitPerPackage = pd.get("unitPerPackage");
                    var unitPrice = pd.get("unitPrice");
                    var orderDetailProductCount = orderDetail.get("orderDetailProductCount");
                    var realUnit = unitPerPackage * orderDetailProductCount;
                    var realPrice = unitPrice * realUnit;
                    orderDetail.set("realUnit", realUnit);
                    orderDetail.set("realPrice", parseFloat(realPrice.toFixed(2)));

                    orderDetail.set("productName", pd.get("productName"));
                    orderDetail.set("productPrice", pd.get("productPrice"));
                    orderDetail.set("packageString", pd.get("packageString"));
                    orderDetail.set("unitPerPackage", pd.get("unitPerPackage"));
                    orderDetail.set("unitString", pd.get("unitString"));
                    orderDetail.set("unitPrice", pd.get("unitPrice"));
                    orderDetail.set("orderSC", pd.get("sortingCenter"));
                    orderDetail.set("isIndividualPackage", pd.get("isIndividualPackage"));

                    var curOrderTime = orderDetail.get("orderTime");
                    if (!curOrderTime){
                        orderDetail.set("orderTime", orderDetail.createdAt);
                    }

                    response.success();
                }else{//商品是下架状态
                    console.log(pd.get('productName') + "已下架");
                    response.error(pd.get('productName') + "已下架");
                }
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
    var unitPerPackage = orderDetail.get("unitPerPackage");
    var unitPrice = orderDetail.get("unitPrice");
    var orderDetailProductCount = orderDetail.get("orderDetailProductCount");
    var realUnit = unitPerPackage * orderDetailProductCount;
    orderDetail.set("realUnit", realUnit);
    var realPrice = unitPrice * realUnit;
    orderDetail.set("realPrice", parseFloat(realPrice.toFixed(2)));
    orderDetail.save(null, {
        success: function (orderDetail) {
            //console.log("orderDetail保存成功,",orderDetail.get("realPrice"));
        },
        error: function (orderDetail, error) {

        }
    });
});

module.exports = AV.Cloud;
