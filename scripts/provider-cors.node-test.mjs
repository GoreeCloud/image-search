import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { corsPermission, PROVIDER_CORS_TARGETS, probeProviderCors, validatedOrigin } from './provider-cors.mjs'

describe('synthetic provider CORS readiness checks', () => {
  it('uses eight keyless official HTTPS API endpoints with small synthetic pages', () => {
    assert.equal(PROVIDER_CORS_TARGETS.length, 8)
    for (const target of PROVIDER_CORS_TARGETS) {
      assert.equal(new URL(target.url).protocol, 'https:')
      assert.equal(target.params.q ?? target.params.query ?? target.params.gsrsearch, 'mountain')
      assert.equal(JSON.stringify(target).toLowerCase().includes('apikey'), false)
    }
  })

  it('accepts only an HTTPS origin or local development HTTP origin', () => {
    assert.equal(validatedOrigin('http://localhost:1420'), 'http://localhost:1420')
    assert.equal(validatedOrigin('https://example.org'), 'https://example.org')
    for (const origin of ['http://example.org', 'https://example.org/path', 'https://person@example.org', 'javascript:alert(1)']) {
      assert.throws(() => validatedOrigin(origin))
    }
  })

  it('requires wildcard or an exact origin and does not accept comma-separated origins', () => {
    assert.equal(corsPermission('*', 'http://localhost:1420'), 'allowed')
    assert.equal(corsPermission('http://localhost:1420', 'http://localhost:1420'), 'allowed')
    for (const header of [null, 'null', 'https://elsewhere.example', 'http://localhost:1420, *']) {
      assert.equal(corsPermission(header, 'http://localhost:1420'), 'blocked')
    }
  })

  it('sends no credentials, reads only response headers and reports a missing ACAO', async () => {
    let options
    const request = async (_url, init) => {
      options = init
      return new Response('{"data":[]}', { status: 200 })
    }
    const result = await probeProviderCors(PROVIDER_CORS_TARGETS[4], 'http://localhost:1420', { request })
    assert.equal(result.verdict, 'blocked')
    assert.equal(result.httpStatus, 200)
    assert.equal(result.allowOrigin, null)
    assert.equal(options.credentials, 'omit')
    assert.equal(options.redirect, 'error')
    assert.equal(options.headers.Origin, 'http://localhost:1420')
  })

  it('differentiates explicit CORS permission, HTTP errors and network failures', async () => {
    const target = PROVIDER_CORS_TARGETS[0]
    const origin = 'https://example.org'
    const allowed = await probeProviderCors(target, origin, {
      request: async () => new Response('', { status: 200, headers: { 'access-control-allow-origin': '*' } }),
    })
    assert.equal(allowed.verdict, 'allowed')
    const unavailable = await probeProviderCors(target, origin, { request: async () => new Response('', { status: 503 }) })
    assert.equal(unavailable.verdict, 'http-error')
    const failed = await probeProviderCors(target, origin, { request: async () => { throw new TypeError('offline') } })
    assert.equal(failed.verdict, 'network-error')
  })
})
