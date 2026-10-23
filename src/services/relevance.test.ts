import { expect, it } from 'vitest'
import { isModernTechnologyQuery, rankCollectionImages, sourcesForQuery } from './relevance'
import type { ImageResult } from '../types'

const image = (id: string, title: string, description = ''): ImageResult => ({
  id, title, description, url: 'https://example.org/full.jpg',
  thumbnailUrl: 'https://example.org/thumb.jpg', sourceUrl: 'https://example.org',
  creator: 'Example', license: 'CC BY', licenseUrl: null, width: 1200, height: 800, provider: 'Test',
})

it('detects mobile operating-system terms without narrowing generic art searches', () => {
  expect(isModernTechnologyQuery('Samsung OneUI')).toBe(true)
  expect(isModernTechnologyQuery('Android screenshots')).toBe(true)
  expect(isModernTechnologyQuery('nature')).toBe(false)
  expect(isModernTechnologyQuery('Victorian paintings')).toBe(false)
  expect(isModernTechnologyQuery('galaxy nebula')).toBe(false)
  expect(isModernTechnologyQuery('architectural windows')).toBe(false)
  expect(isModernTechnologyQuery('Windows 11 desktop')).toBe(true)
  expect(sourcesForQuery('Samsung OneUI', ['openverse', 'commons', 'nasa', 'met'])).toEqual(['openverse', 'commons'])
  expect(sourcesForQuery('nature', ['openverse', 'commons', 'nasa', 'met'])).toEqual(['openverse', 'commons', 'nasa', 'met'])
})

it('filters unrelated logos, fonts, and museum items for Samsung OneUI', () => {
  const source = [
    image('emblem', 'Wikipedia emblem', 'A logo used by the Wikipedia project'),
    image('blue', 'Blue S font example', 'A letter sample'),
    image('settings', 'Samsung One UI settings screenshot'),
    image('nature', 'Spring flowers', 'Collection photo'),
    image('update', 'One UI 7 screen', 'Samsung Galaxy Android update'),
    image('partial', 'Samsung Galaxy smartphone', 'Product photography'),
  ]
  expect(rankCollectionImages('Samsung OneUI', source).map(item => item.id)).toEqual(['settings', 'update'])
  expect(rankCollectionImages('nature', source)).toEqual(source)
})

it('keeps stable order among equally relevant screenshots', () => {
  const source = [image('first', 'OneUI settings'), image('second', 'One UI home screen')]
  expect(rankCollectionImages('one ui', source).map(item => item.id)).toEqual(['first', 'second'])
})
