/* eslint-disable no-bitwise */
const request = require('request-promise');
const assert = require('assert');

const baseOpts = {
  baseUrl: 'https://graph.facebook.com/v8.0',
  headers: {
    Authorization: `OAuth ${process.env.FACEBOOK_APP_TOKEN}`,
  },
  json: true,
  timeout: 40000,
};

/**
 * Class wraps Facebook Graph API requests
 */
class GraphAPI {
  /**
   * Just to be sure that correct user passed
   * @param {{ id: string, access_token?: string }} user
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
   * @param {{ id: string }} user
   * @param {string}
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

  /**
   * Associates user with facebook app and provides permissions
   * @param {{ id: string }} user
   * @param {string[]} permissions
   */
  static associateUser(user, permissions = []) {
    this.checkUser(user);
    assert(Array.isArray(permissions));
    return this.graphApi({
      uri: `/${process.env.FACEBOOK_CLIENT_ID}/accounts/test-users`,
      method: 'POST',
      body: {
        uid: user.id,
        owner_access_token: process.env.FACEBOOK_APP_TOKEN,
        installed: permissions.length > 0,
        permissions: permissions.length > 0 ? permissions.join(',') : undefined,
      },
    });
  }

  /**
   * Returns existing test user with correct permissions or creates a new one
   * @param {string[]} permissions
   * @param {string} [next] - url for fetching test user data
   * @returns {Promise<{ id: string, access_token: string | undefined, login_url: string, email?: string }>}
   */
  static async _getTestUserWithPermissions(permissions, next = `${baseOpts.baseUrl}/${process.env.FACEBOOK_CLIENT_ID}/accounts/test-users`) {
    const { data, paging } = await this.graphApi({
      baseUrl: '',
      uri: next,
      method: 'GET',
    });

    if (data.length === 0) {
      return this.createTestUser({
        installed: Array.isArray(permissions) && permissions.length > 0,
        permissions: Array.isArray(permissions) && permissions.length > 0 ? permissions.join(',') : undefined,
      });
    }

    if (!Array.isArray(permissions) || permissions.length === 0) {
      const users = data.filter((x) => !x.access_token);
      const user = users[users.length * Math.random() | 0];

      if (!user) {
        return this._getTestUserWithPermissions(permissions, paging.next);
      }

      return user;
    }

    const user = data[data.length * Math.random() | 0];
    await this.deAuthApplication(user);
    return this.associateUser(user, permissions);
  }

  /**
   * ensures that every test user has email
   * @param {string[]} permissions
   */
  static async getTestUserWithPermissions(permissions) {
    const user = await this._getTestUserWithPermissions(permissions);

    const hasPermission = Array.isArray(permissions) && permissions.length > 0;
    const needsEmail = hasPermission ? permissions.includes('email') : true;

    if (needsEmail && !user.email) {
      await this.deleteTestUser(user);
      return this.getTestUserWithPermissions(permissions);
    }

    return user;
  }
}

GraphAPI.graphApi = request.defaults(baseOpts);

module.exports = GraphAPI;
