const { strict: assert } = require('assert')
const { startService, clearRedis } = require('../../../config')

describe('/bypass/generic', function bypassGeneric() {
  const genericUser = { username: 'FooBar', audience: '*.localhost', userId: '12341234' }
  const account = genericUser.username
  const schema = 'generic'
  const action = 'auth-bypass'

  let userId
  let username

  const providerConfig = provider => ({
    jwt: {
      stateless: {
        enabled: true,
        fields: ['username', 'extra'],
      },
    },
    bypass: {
      [schema]: {
        enabled: true,
        provider: provider,
      },
    }
  })

  describe('kaizen provider', function kaizenProvider() {
    const provider = 'kaizen'

    before('start', async () => {
      await startService.call(this, providerConfig(provider))
    })

    after(clearRedis.bind(this))

    it('register user', async () => {
      const repsonse = await this.users.dispatch(action, {
        params: {
          schema: `${schema}:${account}`,
          userKey: genericUser.userId,
        }
      })

      assert(repsonse.jwt)
      assert(repsonse.user.metadata)

      const { metadata } = repsonse.user

      assert(metadata[genericUser.audience])
      assert(metadata[genericUser.audience].id)
      assert.equal(metadata[genericUser.audience].name, genericUser.username)
      assert.equal(metadata[genericUser.audience].username, `${schema}/${provider}-${genericUser.userId}`)

      userId = metadata[genericUser.audience].id
      username = metadata[genericUser.audience].username
    })

    it('should login already registred user', async () => {
      const repsonse = await this.users.dispatch(action, {
        params: {
          schema: `${schema}:${account}`,
          userKey: genericUser.userId,
        }
      })

      assert(repsonse.jwt)
      assert(repsonse.user.metadata[genericUser.audience])
      assert(repsonse.user.metadata[genericUser.audience].id)
      assert.equal(repsonse.user.metadata[genericUser.audience].id, userId)
      assert.equal(repsonse.user.metadata[genericUser.audience].username, username)
    })
  })

  describe('some provider', function someProvider() {
    const provider = 'some'

    before('start', async () => {
      await startService.call(this, providerConfig(provider))
    })

    after(clearRedis.bind(this))

    it('register user', async () => {
      const repsonse = await this.users.dispatch(action, {
        params: {
          schema: `${schema}:${account}`,
          userKey: genericUser.userId,
        }
      })

      assert(repsonse.jwt)
      assert(repsonse.user.metadata)

      const { metadata } = repsonse.user

      assert(metadata[genericUser.audience])
      assert(metadata[genericUser.audience].id)
      assert.equal(metadata[genericUser.audience].name, genericUser.username)
      assert.equal(metadata[genericUser.audience].username, `${schema}/${provider}-${genericUser.userId}`)

      userId = metadata[genericUser.audience].id
      username = metadata[genericUser.audience].username
    })

    it('should login already registred user', async () => {
      const repsonse = await this.users.dispatch(action, {
        params: {
          schema: `${schema}:${account}`,
          userKey: genericUser.userId,
        }
      })

      assert(repsonse.jwt)
      assert(repsonse.user.metadata[genericUser.audience])
      assert(repsonse.user.metadata[genericUser.audience].id)
      assert.equal(repsonse.user.metadata[genericUser.audience].id, userId)
      assert.equal(repsonse.user.metadata[genericUser.audience].username, username)
    })
  })


})
