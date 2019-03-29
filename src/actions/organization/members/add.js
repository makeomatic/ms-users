const { ActionTransport } = require('@microfleet/core');
const { checkOrganizationExists } = require('../../../utils/organization');
const addOrganizationMembers = require('../../../utils/organization/addOrganizationMembers');

/**
 * @api {amqp} <prefix>.members.add Add organization member
 * @apiVersion 1.0.0
 * @apiName members.add
 * @apiGroup Organizations
 *
 * @apiDescription This should be used to add member and send invitation.
 *
 * @apiParam (Payload) {String} organizationId - organization id.
 * @apiParam (Payload) {Object} member - member.
 * @apiParam (Payload) {String} member.email - member email.
 * @apiParam (Payload) {String} member.firstName - member first name.
 * @apiParam (Payload) {String} member.lastName - member last name.
 * @apiParam (Payload) {String[]} member.permissions - member permission list.
 */
async function addOrganizationMember({ params }) {
  const { config } = this;
  const { organizationId, member } = params;
  const { audience } = config.organizations;

  return addOrganizationMembers.call(this, {
    organizationId,
    audience,
    members: [member],
  });
}

addOrganizationMember.allowed = checkOrganizationExists;
addOrganizationMember.transports = [ActionTransport.amqp, ActionTransport.internal];
module.exports = addOrganizationMember;
