class Urls {
  static instance(version = Urls.DEFAULT_API_VERSION) {
    let { self } = this;

    if (!self) {
      self = this.self = new Urls(version);
    }

    return self;
  }

  static setVersion(version) {
    return this.instance().setVersion(version);
  }

  static get auth() {
    return Urls.instance().auth;
  }

  static get token() {
    return Urls.instance().token;
  }

  constructor(apiVersion) {
    this.apiVersion = apiVersion;
  }

  setVersion(version) {
    this.apiVersion = version;
    return this;
  }

  get auth() {
    return `https://www.facebook.com/${this.apiVersion}/dialog/oauth`;
  }

  get token() {
    return `https://graph.facebook.com/${this.apiVersion}/oauth/access_token`;
  }

  get permissions() {
    return `https://graph.facebook.com/${this.apiVersion}/me/permissions`;
  }

  get profile() {
    return `https://graph.facebook.com/${this.apiVersion}/me`;
  }
}

Urls.DEFAULT_API_VERSION = 'v4.0';
Urls.self = null;

module.exports = Urls;
