/* eslint-disable */
require('dotenv').config();

const rp = require('request-promise').defaults({
  url: `https://graph.facebook.com/v15.0/${process.env.FACEBOOK_CLIENT_ID}/accounts/test-users`,
  json: true,
  qs: {
    access_token: process.env.FACEBOOK_APP_TOKEN,
  },
});

async function fetchUsers(url = '') {
  const { data, paging } = await rp.get(url);
  for (const user of data) {
    await rp.delete(`https://graph.facebook.com/v13.0/${user.id}`);
    process.stdout.write('.');
  }

  if (paging.next) {
    return fetchUsers(paging.next);
  }

  return null;
}

(async () => {
  await fetchUsers();
})();
