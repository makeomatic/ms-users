const vm = require('vm');
const cheerio = require('cheerio');

/**
 * Wrap for all `puppeter` actions needed to test Facebook Login process
 */
class WebExecuter {
  /**
   * Executes provided HTML and returns resulting Window Context.
   * @param body
   * @returns {Context}
   */
  static getJavascriptContext(body) {
    const $ = cheerio.load(body);
    const vmScript = new vm.Script($('.no-js > body > script').html());
    const context = vm.createContext({ window: { close: () => {} } });
    vmScript.runInContext(context);
    return context;
  }

  static extractPostMessageResponse(body) {
    const data = this.getJavascriptContext(body);
    return data.$ms_users_inj_post_message;
  }
}

module.exports = WebExecuter;
