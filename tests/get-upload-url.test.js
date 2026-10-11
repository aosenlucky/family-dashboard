import assert from 'node:assert/strict'
import test from 'node:test'

import handler, { buildObjectKey, resolveUploadFolder } from '../api/get-upload-url.js'

test('宝宝时光照片沿用现有 photos 前缀', () => {
  assert.equal(resolveUploadFolder('milestones'), 'photos/milestones')
  assert.equal(buildObjectKey('milestones', '宝宝 B超.jpg', 123), 'photos/milestones/123_B.jpg')
})

test('未知目录不会逃出 photos 前缀', () => {
  assert.equal(resolveUploadFolder('../../private'), 'photos')
  assert.equal(buildObjectKey('../../private', '旅行照.png', 456), 'photos/456_.png')
})

test('清洗后为空的文件名会使用安全兜底名', () => {
  assert.equal(buildObjectKey('photos', '宝宝照片', 789), 'photos/789_image')
})

test('签名接口为宝宝时光返回 photos 子目录中的对象地址', async () => {
  const previousEnv = {
    SYSTEM_PASSWORD: process.env.SYSTEM_PASSWORD,
    OBS_AK: process.env.OBS_AK,
    OBS_SK: process.env.OBS_SK,
    OBS_ENDPOINT: process.env.OBS_ENDPOINT,
    OBS_BUCKET_NAME: process.env.OBS_BUCKET_NAME
  }

  Object.assign(process.env, {
    SYSTEM_PASSWORD: 'test-password',
    OBS_AK: 'test-access-key',
    OBS_SK: 'test-secret-key',
    OBS_ENDPOINT: 'https://obs.cn-north-4.myhuaweicloud.com',
    OBS_BUCKET_NAME: 'test-bucket'
  })

  try {
    const response = await invokeHandler({
      method: 'GET',
      headers: { authorization: 'test-password' },
      query: { filename: '检查单.jpg', contentType: 'image/jpeg', folder: 'milestones' }
    })

    assert.equal(response.statusCode, 200)
    assert.match(response.payload.objectKey, /^photos\/milestones\/\d+_\.jpg$/)
    assert.equal(
      response.payload.finalUrl,
      `https://test-bucket.obs.cn-north-4.myhuaweicloud.com/${response.payload.objectKey}`
    )
    assert.match(response.payload.uploadUrl, /photos\/milestones/)
  } finally {
    for (const [name, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  }
})

async function invokeHandler(request) {
  const response = {
    statusCode: 200,
    payload: undefined,
    status(code) {
      this.statusCode = code
      return this
    },
    json(payload) {
      this.payload = payload
      return this
    }
  }

  await handler(request, response)
  return response
}
