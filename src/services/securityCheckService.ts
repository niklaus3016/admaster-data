// 安全检测服务
import { registerPlugin, Capacitor } from '@capacitor/core';

interface SecurityCheckPlugin {
  checkSecurity(): Promise<{
    isRooted: boolean;
    isBootloaderUnlocked: boolean;
    isXposedInstalled: boolean;
    isUsbDebugEnabled: boolean;
    isSecure: boolean;
  }>;
}

const SecurityCheck = registerPlugin<SecurityCheckPlugin>('SecurityCheck');

export interface SecurityCheckResult {
  isRooted: boolean;
  isBootloaderUnlocked: boolean;
  isXposedInstalled: boolean;
  isUsbDebugEnabled: boolean;
  isSecure: boolean;
}

let cachedResult: SecurityCheckResult | null = null;

/**
 * 检查是否为Native环境
 */
function checkIsNative(): boolean {
  return Capacitor.getPlatform() === 'android';
}

/**
 * 执行安全检测
 * @returns 安全检测结果
 */
export async function performSecurityCheck(): Promise<SecurityCheckResult> {
  // 如果已有缓存结果，直接返回
  if (cachedResult !== null) {
    console.log('🔒 使用缓存的安全检测结果:', cachedResult);
    return cachedResult;
  }

  try {
    console.log('🔒 开始安全检测...');

    // 检查是否为Native环境
    const isNativePlatform = checkIsNative();
    console.log('🔒 是否为Native环境:', isNativePlatform);

    if (!isNativePlatform) {
      // 非Native环境（如浏览器），返回默认安全状态
      console.log('🔒 非Native环境，默认返回安全状态');
      const result: SecurityCheckResult = {
        isRooted: false,
        isBootloaderUnlocked: false,
        isXposedInstalled: false,
        isUsbDebugEnabled: false,
        isSecure: true
      };
      cachedResult = result;
      return result;
    }

    // Native环境，调用安全检测插件
    const result = await SecurityCheck.checkSecurity();
    console.log('🔒 安全检测结果:', result);

    const checkResult: SecurityCheckResult = {
      isRooted: !!result.isRooted,
      isBootloaderUnlocked: !!result.isBootloaderUnlocked,
      isXposedInstalled: !!result.isXposedInstalled,
      isUsbDebugEnabled: !!result.isUsbDebugEnabled,
      isSecure: !!result.isSecure
    };

    cachedResult = checkResult;
    return checkResult;

  } catch (error) {
    console.error('🔒 安全检测失败:', error);

    // Native环境下检测失败，视为不安全
    if (checkIsNative()) {
      console.warn('🔒 Native环境下检测失败，视为不安全状态');
      const result: SecurityCheckResult = {
        isRooted: true,  // 假设可能存在风险
        isBootloaderUnlocked: true,
        isXposedInstalled: true,
        isUsbDebugEnabled: true,
        isSecure: false
      };
      cachedResult = result;
      return result;
    }

    // 非Native环境，返回安全状态
    const result: SecurityCheckResult = {
      isRooted: false,
      isBootloaderUnlocked: false,
      isXposedInstalled: false,
      isUsbDebugEnabled: false,
      isSecure: true
    };
    cachedResult = result;
    return result;
  }
}

/**
 * 检查设备是否安全
 * @returns 是否安全
 */
export async function isDeviceSecure(): Promise<boolean> {
  const result = await performSecurityCheck();
  return result.isSecure;
}

/**
 * 获取安全风险信息
 * @returns 风险信息数组
 */
export async function getSecurityRisks(): Promise<string[]> {
  const result = await performSecurityCheck();
  const risks: string[] = [];

  if (result.isRooted) {
    risks.push('设备已Root');
  }
  if (result.isBootloaderUnlocked) {
    risks.push('Bootloader已解锁');
  }
  if (result.isXposedInstalled) {
    risks.push('安装了Xposed框架');
  }
  if (result.isUsbDebugEnabled) {
    risks.push('USB调试已开启');
  }

  return risks;
}

/**
 * 清除安全检测缓存
 */
export function clearSecurityCache(): void {
  cachedResult = null;
  console.log('🔒 安全检测缓存已清除');
}