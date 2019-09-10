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
 * @apiParam (Payload) {String} organizationId - organization id.
 *
 * @apiSuccess (Response) {Object} data - response data.
 * @apiSuccess (Response) {Object} data.id - organization id.
 * @apiSuccess (Response) {Object} data.type - response type.
 * @apiSuccess (Response) {Object[]} data.attributes - organization members.
 * @apiSuccess (Response) {String} data.attributes.id - organization member id.
 * @apiSuccess (Response) {String} data.attributes.type - entity type.
 * @apiSuccess (Response) {Object[]} data.attributes.attributes - organization member.
 * @apiSuccess (Response) {String} data.attributes.attributes.username - member email.
 * @apiSuccess (Response) {String} data.attributes.attributes.firstName - member first name.
 * @apiSuccess (Response) {String} data.attributes.attributes.lastName - member last name.
 * @apiSuccess (Response) {Date} data.attributes.attributes.invited - member invite date.
 * @apiSuccess (Response) {Date} data.attributes.attributes.accepted - member accept invite date.
 * @apiSuccess (Response) {String[]} data.attributes.attributes.permissions - member permission list.
 */
async function organizationMembersList({ params }) {
  const { organizationId } = params;

  const members = await getOrganizationMembers.call(this, organizationId);
  return {
    data: {
      id: organizationId,
      type: 'organizationMembers',
      attributes: members.map((member) => ({
        id: member.id,
        type: 'organizationMember',
        attributes: member,
      })),
    },
  };
}

organizationMembersList.allowed = checkOrganizationExists;
organizationMembersList.transports = [ActionTransport.amqp, ActionTransport.internal];
module.exports = organizationMembersList;
