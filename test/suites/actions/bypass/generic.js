const { strict: assert } = require('assert')
const { startService, clearRedis } = require('../../../config')

describe('/bypass/generic', function bypassGeneric() {
  const genericUser = { username: 'FooBar', audience: '*.localhost', userId: '12341234' }
  const account = genericUser.username
  const schema = 'generic'
  const action = 'auth-bypass'

  let userId
  let username

  const providerKaizen = 'kaizen'
  const providerSome = 'some'


  // const providerConfig = provider => ({
  //   jwt: {
  //     stateless: {
  //       enabled: true,
  //       fields: ['username', 'extra'],
  //     },
  //   },
  //   // bypass: {
  //   //   [schema]: {
  //   //     enabled: true,
  //   //     provider: provider,
  //   //   },
  //   // }
  //   bypassGeneric: {
  //     [provider]: {
  //       enabled: true,
  //       provider: provider,
  //     },
  //   }
  // })

  describe.only('kaizen provider', function kaizenProvider() {
    // const provider = 'kaizen'

    before('start', async () => {
      await startService.call(this, {
        jwt: {
          stateless: {
            enabled: true,
            fields: ['username', 'extra'],
          },
        },
        bypassGeneric: {
          [providerKaizen]: {
            enabled: true,
            provider: providerKaizen,
          },
          [providerSome]: {
            enabled: true,
            provider: providerSome,
          },
        }
      })
    })

    after(clearRedis.bind(this))

    it('register kaizen provider user', async () => {
      const repsonse = await this.users.dispatch(action, {
        params: {
          schema: `${schema}/${providerKaizen}:${account}`,
          userKey: genericUser.userId,
        }
      })

      assert(repsonse.jwt)
      assert(repsonse.user.metadata)

      const { metadata } = repsonse.user

      assert(metadata[genericUser.audience])
      assert(metadata[genericUser.audience].id)
      assert.equal(metadata[genericUser.audience].name, genericUser.username)
      assert.equal(metadata[genericUser.audience].username, `g/${providerKaizen}-${genericUser.userId}`)

      userId = metadata[genericUser.audience].id
      username = metadata[genericUser.audience].username
    })

    it('should login already registred kaizen provider user', async () => {
      const repsonse = await this.users.dispatch(action, {
        params: {
          schema: `${schema}/${providerKaizen}:${account}`,
          userKey: genericUser.userId,
        }
      })

      assert(repsonse.jwt)
      assert(repsonse.user.metadata[genericUser.audience])
      assert(repsonse.user.metadata[genericUser.audience].id)
      assert.equal(repsonse.user.metadata[genericUser.audience].id, userId)
      assert.equal(repsonse.user.metadata[genericUser.audience].username, username)
    })

    it('register some provider user', async () => {
      const repsonse = await this.users.dispatch(action, {
        params: {
          schema: `${schema}/${providerSome}:${account}`,
          userKey: genericUser.userId,
        }
      })

      assert(repsonse.jwt)
      assert(repsonse.user.metadata)

      const { metadata } = repsonse.user

      assert(metadata[genericUser.audience])
      assert(metadata[genericUser.audience].id)
      assert.equal(metadata[genericUser.audience].name, genericUser.username)
      assert.equal(metadata[genericUser.audience].username, `g/${providerSome}-${genericUser.userId}`)

      userId = metadata[genericUser.audience].id
      username = metadata[genericUser.audience].username
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
