/**
 * Shared utility for triggering file downloads in the browser.
 * Consolidates the duplicated `document.createElement('a')` pattern
 * used across FileMessage, ChatDocsList, and ChatFileList.
 */

import type { DesktopEffect } from './effect'
import { downloadMedia } from '@matrix/index'
import { Effect } from 'effect'
import { fromPromise, fromSync, runDesktopEffect, runDesktopSync } from './effect'

/**
 * Download a media file from a Matrix `mxc://` URL and trigger a browser download.
 *
 * @param url - The Matrix media URL (mxc://)
 * @param filename - The file name to save as
 */
export function downloadMediaFileEffect(url: string, filename: string): DesktopEffect<void> {
  return Effect.gen(function* () {
    const blob = yield* fromPromise(() => downloadMedia(url))
    yield* triggerBlobDownloadEffect(blob, filename)
  })
}

export function downloadMediaFile(url: string, filename: string): Promise<void> {
  return runDesktopEffect(downloadMediaFileEffect(url, filename))
}

/**
 * Trigger a download for an in-memory Blob.
 *
 * @param blob - The Blob to download
 * @param filename - The file name to save as
 */
export function triggerBlobDownloadEffect(blob: Blob, filename: string): DesktopEffect<void> {
  return fromSync(() => {
    const a = document.createElement('a')
    const blobUrl = URL.createObjectURL(blob)
    a.href = blobUrl
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
  })
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  runDesktopSync(triggerBlobDownloadEffect(blob, filename))
}
