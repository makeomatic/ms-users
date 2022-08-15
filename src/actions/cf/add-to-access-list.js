const { ActionTransport } = require('@microfleet/plugin-router');

async function addToAccessList({ params }) {
  const { cfAccessList } = this;
  const { remoteip: ip, comment } = params;
  const listId = await cfAccessList.findRuleListId(ip);
  const ipEntry = { ip, comment };

  return listId ? cfAccessList.touchIP(ipEntry, listId) : cfAccessList.addIP(ipEntry);
}

addToAccessList.transports = [ActionTransport.amqp, ActionTransport.internal];

module.exports = addToAccessList;
module.exports.validateResponse = false;
