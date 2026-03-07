// 处理广告观看
const handleWatchAd = async () => {
  if (isWatching.value || !empId.value || !userId.value) return;
  
  isWatching.value = true;
  error.value = '';
  
  try {
    console.log('========== 开始处理广告观看 ==========');
    console.log('userId:', userId.value);
    console.log('empId:', empId.value);
    
    // 调用广告管理逻辑
    const result = await showRewardVideo();
    
    console.log('广告返回结果:', result);
    console.log('ecpm值:', result.ecpm);
    console.log('ecpm类型:', typeof result.ecpm);
    
    // 检查参数是否有效
    if (!userId.value || !empId.value) {
      console.error('缺少必要参数:', { userId: userId.value, empId: empId.value });
      error.value = '缺少必要参数，请重新登录';
      isWatching.value = false;
      return;
    }
    
    // 调用后端发放金币接口
    console.log('调用rewardGold:', { 
      userId: userId.value, 
      empId: empId.value, 
      ecpm: result.ecpm 
    });
    
    const rewardResponse = await rewardGold(userId.value, empId.value, result.ecpm);
    
    console.log('rewardGold响应:', rewardResponse);
    
    if (rewardResponse.success && rewardResponse.data) {
      const earned = rewardResponse.data.gold;
      // 更新本地状态
      currentMonthGold.value = rewardResponse.data.currentMonthGold;
      // 播放金币到账语音提示
      playCoinSound(earned);
      // 显示奖励动画
      showReward.value = earned;
      // 重新加载金币记录（会自动计算今日金币）
      await loadGoldRecords();
      // 3秒后隐藏奖励
      setTimeout(() => {
        showReward.value = null;
      }, 3000);
    } else {
      error.value = rewardResponse.message || '金币发放失败';
    }
  } catch (err) {
    console.error('广告观看失败:', err);
    error.value = '网络错误，请稍后重试';
  } finally {
    isWatching.value = false;
    console.log('========== 广告观看处理结束 ==========');
  }
};