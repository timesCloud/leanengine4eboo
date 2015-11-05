/**
 * 微信认证后的 app 信息
 * 如果有需要可以将这些信息放到数据库中读取方便以更增加
 * 注：测试时请替换您真实的appid和secret
 */
module.exports = function(){
	return [
			{//正式环境
				appid: 'wxe54b53d8fb59af50'
				,secret: '3f8b653d6ab47e00fcfd8d1db5a6e461'
			}
			//{//测试环境
			//	appid: 'wx944c6d85858042cb'
			//	,secret: '4199b325f9a8f473beb54de561c299f6'
			//}
		];
};
