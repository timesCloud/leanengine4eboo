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
