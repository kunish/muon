/**
 * Shared utility for triggering file downloads in the browser.
 * Consolidates the duplicated `document.createElement('a')` pattern
 * used across FileMessage, ChatDocsList, and ChatFileList.
 */

import { downloadMedia } from '@matrix/index'

/**
 * Download a media file from a Matrix `mxc://` URL and trigger a browser download.
 *
 * @param url - The Matrix media URL (mxc://)
 * @param filename - The file name to save as
 */
export async function downloadMediaFile(url: string, filename: string): Promise<void> {
  const blob = await downloadMedia(url)
  triggerBlobDownload(blob, filename)
}

/**
 * Trigger a download for an in-memory Blob.
 *
 * @param blob - The Blob to download
 * @param filename - The file name to save as
 */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  const a = document.createElement('a')
  const blobUrl = URL.createObjectURL(blob)
  a.href = blobUrl
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
}
