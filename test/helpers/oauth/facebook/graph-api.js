const request = require('request-promise');

/**
 * Class wraps Facebook Graph API requests
 */
class GraphAPI {
  static graphApi = request.defaults({
    baseUrl: 'https://graph.facebook.com/v4.0',
    headers: {
      Authorization: `OAuth ${process.env.FACEBOOK_APP_TOKEN}`,
    },
    json: true,
  });

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
   * @returns {*}
   */
  static deleteTestUser(user) {
    if (user !== null && typeof user !== 'undefined') {
      return this.graphApi({
        uri: `${user.id}`,
        method: 'DELETE',
      });
    }
    return null;
  }

  /**
   * Removes all Application permissions.
   * This only the way to De Authorize Application from user.
   * @param facebook user
   * @returns {Promise<void>}
   */
  static deAuthApplication(user) {
    if (user !== null && typeof user !== 'undefined') {
      return this.graphApi({
        uri: `/${user.id}/permissions`,
        method: 'DELETE',
      });
    }
    return null;
  }

  /**
   * Delete any Application permission from user.
   * @param facebook user
   * @param permission
   * @returns {Promise<void>}
   */
  static deletePermission(user, permission) {
    if (user !== null && typeof user !== 'undefined') {
      return this.graphApi({
        uri: `/${user.id}/permissions/${permission}`,
        method: 'DELETE',
      });
    }
    return null;
  }
}

module.exports = GraphAPI;
