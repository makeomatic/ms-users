const request = require('request-promise');
const assert = require('assert');
/**
 * Class wraps Facebook Graph API requests
 */
class GraphAPI {
  /**
   * Just to be sure that correct user passed
   * @param user
   */
  static checkUser(user) {
    assert(user, 'No user provided');
    assert(user.id, 'User must have `id`');
  }

  /**
   * Creates test user with passed `props`
   * @param props
   * @returns {*}
   */
  static async createTestUser(props = {}) {
    const newUser = await this.graphApi({
      uri: `/${process.env.FACEBOOK_CLIENT_ID}/accounts/test-users`,
      method: 'POST',
      body: {
        installed: false,
        ...props,
      },
    });

    // In some cases Facebook API returns test user without email:
    // {
    //   "id": "111779840675519",
    //   "login_url": "https://developers.facebook.com/checkpoint/test...",
    //   "email": "",
    //   "password": "153058002"
    // }
    // Delete current and try to create new one.
    const { email } = newUser;
    if (typeof email !== 'string' && email.length === 0) {
      await GraphAPI.deleteTestUser(newUser);
      return GraphAPI.createTestUser(props);
    }

    return newUser;
  }

  /**
   * Deletes test user
   * @param facebook user
   * @returns {Promise<*>}
   */
  static deleteTestUser(user) {
    this.checkUser(user);

    return this.graphApi({
      uri: `${user.id}`,
      method: 'DELETE',
    });
  }

  /**
   * Removes all Application permissions.
   * This only the way to De Authorize Application from user.
   * @param facebook user
   * @returns {Promise<*>}
   */
  static deAuthApplication(user) {
    this.checkUser(user);

    return this.graphApi({
      uri: `/${user.id}/permissions`,
      method: 'DELETE',
    });
  }

  /**
   * Delete any Application permission from user.
   * @param facebook user
   * @param permission
   * @returns {Promise<*>}
   */
  static deletePermission(user, permission) {
    this.checkUser(user);
    assert(permission, 'No `permission` provided');

    return this.graphApi({
      uri: `/${user.id}/permissions/${permission}`,
      method: 'DELETE',
    });
  }
}

GraphAPI.graphApi = request.defaults({
  baseUrl: 'https://graph.facebook.com/v4.0',
  headers: {
    Authorization: `OAuth ${process.env.FACEBOOK_APP_TOKEN}`,
  },
  json: true,
  timeout: 40000,
});

module.exports = GraphAPI;
