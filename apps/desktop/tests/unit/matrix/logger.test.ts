import type { Logger } from 'matrix-js-sdk/lib/logger'
import { describe, expect, it, vi } from 'vitest'
import { createFilteredMatrixLogger, isIgnoredMatrixSdkWarning } from '@/matrix/logger'

function createLoggerMock(): Logger & {
  debug: ReturnType<typeof vi.fn>
  error: ReturnType<typeof vi.fn>
  info: ReturnType<typeof vi.fn>
  trace: ReturnType<typeof vi.fn>
  warn: ReturnType<typeof vi.fn>
} {
  const logger = {
    debug: vi.fn(),
    error: vi.fn(),
    getChild: vi.fn(),
    info: vi.fn(),
    trace: vi.fn(),
    warn: vi.fn(),
  }
  logger.getChild.mockReturnValue(logger)
  return logger as unknown as Logger & {
    debug: ReturnType<typeof vi.fn>
    error: ReturnType<typeof vi.fn>
    info: ReturnType<typeof vi.fn>
    trace: ReturnType<typeof vi.fn>
    warn: ReturnType<typeof vi.fn>
  }
}

describe('matrix logger', () => {
  it('recognizes the Matrix SDK default push-rule warnings that are safe to suppress', () => {
    expect(
      isIgnoredMatrixSdkWarning(['Adding default global override push rule .org.matrix.msc3786.rule.room.server_acl']),
    ).toBe(true)
    expect(
      isIgnoredMatrixSdkWarning(['Adding default global underride push rule .org.matrix.msc3914.rule.room.call']),
    ).toBe(true)
    expect(
      isIgnoredMatrixSdkWarning(['Missing default global override push rule .org.matrix.msc3786.rule.room.server_acl']),
    ).toBe(false)
  })

  it('filters only the known push-rule warning noise from Matrix SDK logs', () => {
    const baseLogger = createLoggerMock()
    const logger = createFilteredMatrixLogger(baseLogger)

    logger.warn('Adding default global override push rule .org.matrix.msc3786.rule.room.server_acl')
    logger.warn('Adding default global underride push rule .org.matrix.msc3914.rule.room.call')
    logger.warn('Getting push rules failed', new Error('network'))

    expect(baseLogger.warn).toHaveBeenCalledOnce()
    expect(baseLogger.warn).toHaveBeenCalledWith('Getting push rules failed', expect.any(Error))
  })
})
