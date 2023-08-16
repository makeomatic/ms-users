const { strict: assert } = require('assert')
const { HttpStatusError } = require('common-errors')
const { startService, clearRedis } = require('../../../config')
const { ErrorOrganizationNotFound, USERS_JWT_STATELESS_REQUIRED } = require('../../../../src/constants')

describe('/bypass/generic', function bypassGeneric() {
  const genericUser = { username: 'FooBar', audience: '*.localhost', userId: '12341234' }
  const account = genericUser.username
  const schema = 'generic'
  const action = 'auth-bypass'
  const organizationId = '7014691412335263711'

  const kaizenProvider = 'kaizen'
  const someProvider = 'some'
  const disabledProvider = 'disabledProvider'

  const bypassGeneric = {
    [kaizenProvider]: {
      enabled: true,
      provider: kaizenProvider,
    },
    [someProvider]: {
      enabled: true,
      provider: someProvider,
    },
    [disabledProvider]: {
      enabled: false,
      provider: disabledProvider
    }
  }

  let userId
  let username

  before('start', async () => {
    await startService.call(this, {
      jwt: {
        stateless: {
          enabled: true,
          fields: ['username', 'extra', 'organizationId'],
        },
      },
      bypassGeneric
    })
  })

  after(clearRedis.bind(this))

  it('register kaizen provider user', async () => {
    const repsonse = await this.users.dispatch(action, {
      params: {
        schema: `${schema}/${kaizenProvider}:${account}`,
        userKey: genericUser.userId,
        organizationId
      }
    })

    assert(repsonse.jwt)
    assert(repsonse.user.metadata)

    const { metadata } = repsonse.user

    assert(metadata[genericUser.audience])
    assert(metadata[genericUser.audience].id)
    assert.equal(metadata[genericUser.audience].name, genericUser.username)
    assert.equal(metadata[genericUser.audience].username, `g/${kaizenProvider}-${genericUser.userId}`)

    userId = metadata[genericUser.audience].id
    username = metadata[genericUser.audience].username
  })

  it('should login already registred kaizen provider user', async () => {
    const repsonse = await this.users.dispatch(action, {
      params: {
        schema: `${schema}/${kaizenProvider}:${account}`,
        userKey: genericUser.userId,
        organizationId
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
        schema: `${schema}/${someProvider}:${account}`,
        userKey: genericUser.userId,
        organizationId
      }
    })

    assert(repsonse.jwt)
    assert(repsonse.user.metadata)

    const { metadata } = repsonse.user

    assert(metadata[genericUser.audience])
    assert(metadata[genericUser.audience].id)
    assert.equal(metadata[genericUser.audience].name, genericUser.username)
    assert.equal(metadata[genericUser.audience].username, `g/${someProvider}-${genericUser.userId}`)

    userId = metadata[genericUser.audience].id
    username = metadata[genericUser.audience].username
  })

  it('should not register user if organizationId not provided', async () => {
    const register = this.users.dispatch(action, {
      params: {
        schema: `${schema}/${someProvider}:${account}`,
        userKey: genericUser.userId,
      }
    })

    await assert.rejects(register, ErrorOrganizationNotFound)
  })

  it('should not register user if disabledProvider', async () => {
    const register = this.users.dispatch(action, {
      params: {
        schema: `${schema}/${disabledProvider}:${account}`,
        userKey: genericUser.userId,
        organizationId
      }
    })

    const expectedError = new HttpStatusError(412, `${schema}/${disabledProvider} auth disabled`)

    await assert.rejects(register, expectedError)
  })

})
