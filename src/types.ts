export type ImageResult = {
  id: string
  title: string
  url: string
  thumbnailUrl: string
  sourceUrl: string
  description: string
  creator: string
  license: string
  licenseUrl: string | null
  width: number
  height: number
  provider: string
}

export type SearchPage = {
  items: ImageResult[]
  cursor: string | null
  /** Source keys that failed on this page. Partial results remain usable. */
  unavailableSources?: string[]
}
