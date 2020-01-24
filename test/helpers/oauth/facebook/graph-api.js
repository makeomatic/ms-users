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
  static createTestUser(props = {}) {
    return this.graphApi({
      uri: `/${process.env.FACEBOOK_CLIENT_ID}/accounts/test-users`,
      method: 'POST',
      body: {
        installed: false,
        ...props,
      },
    });
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
});

module.exports = GraphAPI;
