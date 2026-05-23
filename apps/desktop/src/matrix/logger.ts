import type { Logger } from 'matrix-js-sdk/lib/logger'
import { logger as matrixSdkLogger } from 'matrix-js-sdk/lib/logger'

type LogArgs = Parameters<Logger['warn']>

const IGNORED_MATRIX_SDK_WARNINGS = [
  /^Adding default global override push rule \.org\.matrix\.msc3786\.rule\.room\.server_acl$/,
  /^Adding default global underride push rule \.org\.matrix\.msc3914\.rule\.room\.call$/,
]

export function isIgnoredMatrixSdkWarning(args: unknown[]): boolean {
  const [message] = args

  if (args.length !== 1 || typeof message !== 'string') return false

  return IGNORED_MATRIX_SDK_WARNINGS.some((pattern) => pattern.test(message))
}

export function createFilteredMatrixLogger(baseLogger: Logger): Logger {
  return {
    debug: (...args: LogArgs) => baseLogger.debug(...args),
    error: (...args: LogArgs) => baseLogger.error(...args),
    getChild: (namespace: string) => createFilteredMatrixLogger(baseLogger.getChild(namespace)),
    info: (...args: LogArgs) => baseLogger.info(...args),
    trace: (...args: LogArgs) => baseLogger.trace(...args),
    warn: (...args: LogArgs) => {
      if (isIgnoredMatrixSdkWarning(args)) return

      baseLogger.warn(...args)
    },
  }
}

export const matrixClientLogger = createFilteredMatrixLogger(matrixSdkLogger)
