/**
 * 统一的错误文案提取：mutation 抛出的 ApiError 继承 Error，
 * 取 message；其余未知类型回退到调用方给的兜底文案。
 */
export function errorMessage(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback;
}
