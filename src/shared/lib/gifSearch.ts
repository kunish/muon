import { fetch as tauriFetch } from '@tauri-apps/plugin-http'

export interface GifResult {
  id: string
  title: string
  previewUrl: string
  url: string
  width: number
  height: number
}

const TENOR_BASE = 'https://tenor.googleapis.com/v2'
const TENOR_KEY = import.meta.env.VITE_TENOR_API_KEY || 'AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ'

function buildUrl(endpoint: string, params: Record<string, string>): string {
  const url = new URL(`${TENOR_BASE}/${endpoint}`)
  url.searchParams.set('key', TENOR_KEY)
  url.searchParams.set('client_key', 'muon_chat')
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  return url.toString()
}

function mapResults(data: any): GifResult[] {
  return (data.results ?? []).map((item: any) => {
    const gif = item.media_formats?.gif ?? item.media_formats?.mediumgif
    const preview = item.media_formats?.tinygif ?? item.media_formats?.nanogif ?? gif
    return {
      id: item.id,
      title: item.title || '',
      previewUrl: preview?.url ?? '',
      url: gif?.url ?? '',
      width: gif?.dims?.[0] ?? 320,
      height: gif?.dims?.[1] ?? 240,
    }
  })
}

export async function searchGifs(query: string, limit = 20): Promise<GifResult[]> {
  const url = buildUrl('search', { q: query, limit: String(limit), media_filter: 'gif,tinygif' })
  const res = await tauriFetch(url)
  if (!res.ok)
    throw new Error(`Tenor search failed: ${res.status}`)
  const data = await res.json()
  return mapResults(data)
}

export async function getTrendingGifs(limit = 20): Promise<GifResult[]> {
  const url = buildUrl('featured', { limit: String(limit), media_filter: 'gif,tinygif' })
  const res = await tauriFetch(url)
  if (!res.ok)
    throw new Error(`Tenor trending failed: ${res.status}`)
  const data = await res.json()
  return mapResults(data)
}
