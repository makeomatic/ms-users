const { helpers: { generateClass } } = require('common-errors');

// https://api.cloudflare.com/#getting-started-responses
const CloudflareAPIError = generateClass('CloudflareAPIError', {
  args: ['messages', 'errors'],
  generateMessage() {
    const errors = this.errors ? this.errors.map((e) => `[${e.code}] ${e.message}`) : '';
    const messages = this.messages ? ` Messages: ${this.messages.join(',')}` : '';
    const message = `${errors}${messages}`;
    return `CfApiError: ${message}`;
  },
});

module.exports = {
  CloudflareAPIError,
};
