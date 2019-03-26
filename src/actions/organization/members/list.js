const { ActionTransport } = require('@microfleet/core');
const { checkOrganizationExists } = require('../../../utils/organization');
const { getOrganizationMembers } = require('../../../utils/organization');

/**
 * @api {amqp} <prefix>.members.list Get organization members
 * @apiVersion 1.0.0
 * @apiName members.list
 * @apiGroup Organizations
 *
 * @apiDescription This should be used to get organization members list.
 *
 * @apiParam (Payload) {String} name - organization name.
 *
 * @apiSuccess (Response) {Object[]} members - organization members.
 * @apiSuccess (Response) {String} members.username - member email.
 * @apiSuccess (Response) {String} members.firstName - member first name.
 * @apiSuccess (Response) {String} members.lastName - member last name.
 * @apiSuccess (Response) {Date} members.invited - member invite date.
 * @apiSuccess (Response) {Date} members.accepted - member accept invite date.
 * @apiSuccess (Response) {String[]} members.permissions - member permission list.
 */
async function organizationMembersList({ locals }) {
  const { organizationId } = locals;

  const members = await getOrganizationMembers.call(this, organizationId);
  return { members };
}

organizationMembersList.allowed = checkOrganizationExists;
organizationMembersList.transports = [ActionTransport.amqp, ActionTransport.internal];
module.exports = organizationMembersList;
