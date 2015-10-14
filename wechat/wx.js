/**
 * Created by tsaolipeng on 15/10/14.
 */
wx.config({
    debug: true, // 开启调试模式,调用的所有api的返回值会在客户端alert出来，若要查看传入的参数，可以在pc端打开，参数信息会通过log打出，仅在pc端时才会打印。
    appId: wxappId, // 必填，公众号的唯一标识
    timestamp: wxtimestamp, // 必填，生成签名的时间戳
    nonceStr: wxnonceStr, // 必填，生成签名的随机串
    signature: wxsignature,// 必填，签名，见附录1
    jsApiList: [
        'onMenuShareTimeline',
        'onMenuShareAppMessage'
        //'onMenuShareQQ',
        //'onMenuShareWeibo'
    ]
});

wx.ready(function () {
    wx.error(function (res) {

        // config信息验证失败会执行error函数，如签名过期导致验证失败，具体错误信息可以打开config的debug模式查看，也可以在返回的res参数中查看，对于SPA可以在这里更新签名。
        alert(res);
    });
    wx.onMenuShareTimeline({
        title: wxbt, // 分享标题
        desc: wxms, // 分享描述
        link: wxlink, // 分享链接
        imgUrl: wxtp, // 分享图标
        success: function () {
            // 用户确认分享后执行的回调函数
            try {
                updateShare();
            } catch (e) { }
            alert('分享成功');
        },
        cancel: function () {
            // 用户取消分享后执行的回调函数
            alert('取消分享');
        }
    });
    wx.onMenuShareAppMessage({
        title: wxbt, // 分享标题
        desc: wxms, // 分享描述
        link: wxlink, // 分享链接
        imgUrl: wxtp, // 分享图标
        type: '', // 分享类型,music、video或link，不填默认为link
        dataUrl: '', // 如果type是music或video，则要提供数据链接，默认为空
        success: function () {
            // 用户确认分享后执行的回调函数
            try {
                updateShare();
            } catch (e) { }
            alert('分享成功');
        },
        cancel: function () {
            // 用户取消分享后执行的回调函数
            alert('取消分享');
        },
        fail: function (res) {
            alert(res);
        }
    });

});