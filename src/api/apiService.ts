// API服务层，封装后端接口调用

const API_BASE_URL = 'https://xevbnmgazudl.sealoshzh.site'; // 后端服务地址，根据实际部署情况修改
const USE_MOCK_DATA = false; // 生产模式下使用真实后端API

interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
}

interface EmployeeInfo {
  _id: string;
  employeeId: string;
  name: string;
  phone: string;
  area: string;
  status: number;
  __v: number;
}

interface UserInfo {
  userId: string;
  employeeId: string;
  currentMonthGold: number;
  lastMonthGold: number;
  _id: string;
  __v: number;
}

interface GoldReward {
  gold: number;
  currentMonthGold: number;
}

interface GoldLog {
  _id: string;
  userId: string;
  employeeId: string;
  ecpm: number;
  gold: number;
  createTime: string;
  __v: number;
}

/**
 * 员工登录校验接口
 * @param employeeId 员工号
 * @returns 员工信息或错误信息
 */
export async function checkEmployee(employeeId: string): Promise<ApiResponse<EmployeeInfo>> {
  // 开发模式下使用模拟数据
  if (USE_MOCK_DATA) {
    return new Promise((resolve) => {
      // 模拟网络延迟
      setTimeout(() => {
        // 模拟员工号验证逻辑
        if (employeeId === '8202') {
          // 测试员工，登录成功
          resolve({
            success: true,
            message: '登录成功',
            data: {
              _id: '699c87e89ad7757d16c8b9e1',
              employeeId: '8202',
              name: '测试员工',
              phone: '13800138000',
              area: '北京',
              status: 1,
              __v: 0
            }
          });
        } else if (employeeId === '1111') {
          // 测试员工，登录成功
          resolve({
            success: true,
            message: '登录成功',
            data: {
              _id: '699c87e89ad7757d16c8b9e2',
              employeeId: '1111',
              name: '测试员工1111',
              phone: '13800138001',
              area: '上海',
              status: 1,
              __v: 0
            }
          });
        } else {
          // 员工号不存在
          resolve({
            success: false,
            message: '员工号不存在或已禁用'
          });
        }
      }, 1000);
    });
  }

  // 生产模式下调用真实后端API
  try {
    // 快速检查后端服务是否可用
    const pingController = new AbortController();
    const pingTimeout = setTimeout(() => pingController.abort(), 2000); // 2秒超时
    
    try {
      const pingResponse = await fetch(`${API_BASE_URL}`, {
        method: 'GET',
        signal: pingController.signal,
      });
      clearTimeout(pingTimeout);
      
      if (!pingResponse.ok) {
        throw new Error('后端服务不可用');
      }
    } catch (pingError) {
      clearTimeout(pingTimeout);
      console.error('后端服务检查失败:', pingError);
      return {
        success: false,
        message: '后端服务未运行，请启动后端服务后重试',
      };
    }

    // 添加超时设置
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒超时

    const response = await fetch(`${API_BASE_URL}/api/employee/check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ employeeId }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // 检查响应状态
    if (!response.ok) {
      console.error('登录接口响应错误:', response.status, response.statusText);
      return {
        success: false,
        message: `服务器响应错误: ${response.statusText}`,
      };
    }

    // 尝试解析响应体
    try {
      const data = await response.json();
      return data;
    } catch (jsonError) {
      console.error('解析响应体失败:', jsonError);
      return {
        success: false,
        message: '服务器返回的数据格式错误',
      };
    }
  } catch (error) {
    console.error('员工登录校验失败:', error);
    return {
      success: false,
      message: '网络错误，请稍后重试',
    };
  }
}

/**
 * 获取金币信息接口
 * @param userId 用户ID
 * @param employeeId 员工号
 * @returns 用户金币信息
 */
export async function getUserInfo(userId: string, employeeId: string): Promise<ApiResponse<UserInfo>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/user/info?userId=${userId}&employeeId=${employeeId}`);
    return await response.json();
  } catch (error) {
    console.error('获取金币信息失败:', error);
    return {
      success: false,
      message: '网络错误，请稍后重试',
    };
  }
}

/**
 * 发放金币接口
 * @param userId 用户ID
 * @param employeeId 员工号
 * @param ecpm 广告ECPM值
 * @returns 发放的金币数量和当前月金币总数
 */
export async function rewardGold(userId: string, employeeId: string, ecpm: number): Promise<ApiResponse<GoldReward>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/gold/reward`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, employeeId, ecpm }),
    });
    return await response.json();
  } catch (error) {
    console.error('发放金币失败:', error);
    return {
      success: false,
      message: '网络错误，请稍后重试',
    };
  }
}

/**
 * 获取金币记录接口
 * @param userId 用户ID
 * @returns 金币发放记录列表
 */
export async function getGoldLogs(userId: string): Promise<ApiResponse<GoldLog[]>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/gold/log?userId=${userId}`);
    return await response.json();
  } catch (error) {
    console.error('获取金币记录失败:', error);
    return {
      success: false,
      message: '网络错误，请稍后重试',
    };
  }
}

/**
 * 添加员工接口（用于测试）
 * @param name 员工姓名
 * @param phone 员工电话
 * @param area 员工地区
 * @returns 新添加的员工信息
 */
export async function addEmployee(name: string, phone: string, area: string): Promise<ApiResponse<EmployeeInfo>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/employee/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, phone, area }),
    });
    return await response.json();
  } catch (error) {
    console.error('添加员工失败:', error);
    return {
      success: false,
      message: '网络错误，请稍后重试',
    };
  }
}
