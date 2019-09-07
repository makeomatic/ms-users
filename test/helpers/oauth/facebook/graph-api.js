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
    }).promise();
  }

  /**
   * Deletes test user by id
   * @param userId
   * @returns {*}
   */
  static deleteTestUser(userId) {
    return this.graphApi({
      uri: `${userId}`,
      method: 'DELETE',
    }).promise();
  }

  /**
   * Removes all Application permissions.
   * This only the way to De Authorize Application from user.
   * @param userId
   * @returns {Promise<void>}
   */
  static async deAuthApplication(userId) {
    return this.graphApi({
      uri: `/${userId}/permissions`,
      method: 'DELETE',
    });
  }

  /**
   * Delete any Application permission from user.
   * @param userId
   * @param permission
   * @returns {Promise<void>}
   */
  static async deletePermission(userId, permission) {
    return this.graphApi({
      uri: `/${userId}/permissions/${permission}`,
      method: 'DELETE',
    });
  }
}

module.exports = GraphAPI;
