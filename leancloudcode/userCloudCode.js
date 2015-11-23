/**
 * Created by tsaolipeng on 15/11/18.
 */
var AV = require('leanengine');
var _ = require('underscore');

var User = AV.Object.extend("User");
var SortingCenter = AV.Object.extend("SortingCenter");
var DistributionCenter = AV.Object.extend("DistributionCenter");
var CustomRole = AV.Object.extend("CustomRole");

AV.Cloud.define('EditUser', function(request, response) {
  var name = request.params.ListName;
  var key = request.params.ListKey;
  var id = request.params.UserID;
  var RoleID = request.params.RoleID;
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

AV.Cloud.define('AddOpe', function(request, response) {
		var CheckSCList = request.params.CheckSCList;
		var CheckDCList = request.params.CheckDCList;
		var power = request.params.power;
		var id = request.params.UserID;
		var roleID = request.params.roleID;
		var query = new AV.Query(User);
		query.get(id, {
			success: function(user) {
				var UserRelationSC = user.relation("operableSCs");
				var UserRelationDC = user.relation("operableDCs");
				for (var i = 0; i < CheckSCList.length; i++) {
					var obj = CheckSCList[i];
					var newSC = new SortingCenter();
					newSC.id = obj;
					UserRelationSC.add(newSC);
				}
				for (var i = 0; i < CheckDCList.length; i++) {
					var obj = CheckDCList[i];
					var newDC = new DistributionCenter();
					newDC.id = obj;
					UserRelationDC.add(newDC);
				}
				var NewRole = new CustomRole();
				NewRole.id = roleID;
				user.set("isOperator", true);
				user.set("role", NewRole);
				user.set("power", power);
				user.save(null, {
					success: function(user) {
						// 成功保存之后，执行其他逻辑.
						response.success("新增成功！");
					},
					error: function(user, error) {
						response.error("新增失败！" + error.message);
					}
				});
			},
			error: function(user, error) {
				console.log('error');
				response.error("更新失败" + error.message);
			}
		});
});
AV.Cloud.define('EditOpe', function(request, response) {
		var CheckSCList = request.params.CheckSCList;
		var CheckDCList = request.params.CheckDCList;
		var SClist = request.params.SClist;
		var DClist = request.params.DClist;
		var power = request.params.power;
		var id = request.params.UserID;
		var roleID = request.params.roleID;
		var query = new AV.Query(User);
		query.get(id, {
			success: function(user) {
				var UserRelationSC = user.relation("operableSCs");
				var UserRelationDC = user.relation("operableDCs");
				for (var i = 0; i < SClist.length; i++) {
					var obj = SClist[i];
					var newSC = new SortingCenter();
					newSC.id = obj;
					UserRelationSC.remove(newSC);
				}
				for (var i = 0; i < DClist.length; i++) {
					var obj = DClist[i];
					var newDC = new DistributionCenter();
					newDC.id = obj;
					UserRelationDC.remove(newDC);
				}

				var NewRole = new CustomRole();
				NewRole.id = roleID;
				user.set("role", NewRole);
				user.set("power", power);
				user.save(null, {
					success: function(user) {
						//response.success("--");
						// 成功保存之后，再增加relation.
						for (var i = 0; i < CheckSCList.length; i++) {
							var obj = CheckSCList[i];
							var newSC = new SortingCenter();
							newSC.id = obj;
							UserRelationSC.add(newSC);
						}
						for (var i = 0; i < CheckDCList.length; i++) {
							var obj = CheckDCList[i];
							var newDC = new DistributionCenter();
							newDC.id = obj;
							UserRelationDC.add(newDC);
						}
						//再次保存user
						user.save(null, {
							success: function(user) {
								response.success("编辑成功！");
							},
							error: function(user, error) {
								response.error("编辑失败！" + error.message);
							}
						});
					},
					error: function(user, error) {
						response.error("编辑失败！" + error.message);
					}
				});
			},
			error: function(user, error) {
				console.log('error');
				response.error("编辑失败" + error.message);
			}
		});
});
AV.Cloud.define('deletOpe', function(request, response) {
		var id = request.params.UserID;
		var SClist = request.params.SClistid;
		var DClist = request.params.DClistid;
		var query = new AV.Query(User);
		query.get(id, {
			success: function(user) {
				user.set('isOperator', false);
				var UserRelationSC = user.relation('operableSCs');
				var UserRelationDC = user.relation('operableDCs');
				for (var i = 0; i < SClist.length; i++) {
					var obj1 = SClist[i];
					var newSC = new SortingCenter();
					newSC.id = obj1;
					UserRelationSC.remove(newSC);
				}
				for (var j = 0; j < DClist.length; j++) {
					var obj = DClist[j];
					var newDC = new DistributionCenter();
					newDC.id = obj;
					UserRelationDC.remove(newDC);
				}
				user.save(null, {
					success: function(user) {
						response.success("删除操作员成功！");
					},
					error: function(user, error) {
						response.error("删除失败！" + error.message);
					}
				});
			},
			error: function(user, error) {
				console.log('error');
				response.error("删除失败" + error.message);
			}
		});	
});

module.exports = AV.Cloud;
