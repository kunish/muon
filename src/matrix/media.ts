import { getClient } from './client'

export async function uploadMedia(file: File | Blob): Promise<string> {
  const response = await getClient().uploadContent(file, {
    type: file.type,
  })
  return response.content_uri
}

export function mxcToHttp(mxcUrl: string): string {
  const client = getClient()
  return client.mxcUrlToHttp(mxcUrl) || ''
}

export async function downloadMedia(mxcUrl: string): Promise<Blob> {
  const httpUrl = mxcToHttp(mxcUrl)
  const response = await fetch(httpUrl)
  return response.blob()
}

export function getThumbnailUrl(mxcUrl: string, width: number, height: number): string {
  const client = getClient()
  return client.mxcUrlToHttp(mxcUrl, width, height, 'crop') || ''
}
