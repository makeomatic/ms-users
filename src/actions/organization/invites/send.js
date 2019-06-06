const { ActionTransport } = require('@microfleet/core');
const sendInviteMail = require('../../../utils/organization/sendInviteMail');
const getInternalData = require('../../../utils/organization/getInternalData');
const redisKey = require('../../../utils/key');
const { checkOrganizationExists } = require('../../../utils/organization');
const { ORGANIZATIONS_MEMBERS, ErrorUserNotMember, ORGANIZATIONS_NAME_FIELD } = require('../../../constants');

/**
 * @api {amqp} <prefix>.invites.send Send invitation
 * @apiVersion 1.0.0
 * @apiName invites.send
 * @apiGroup Organizations
 *
 * @apiDescription In a normal flow - sends out an email to a Customer to accept invitation to the organization.
 * Can potentially be used by other Customers in the same organization
 *
 * @apiParam (Payload) {String} organizationId - organization id.
 * @apiParam (Payload) {Object} member - member data.
 * @apiParam (Payload) {String} member.email - member email.
 * @apiParam (Payload) {String} member.firstName - member first name.
 * @apiParam (Payload) {String} member.lastName - member last name.
 * @apiParam (Payload) {String[]} member.permissions - member permission list.
 */
async function sendOrganizationInvite({ params }) {
  const service = this;
  const { member, organizationId } = params;

  const memberKey = redisKey(organizationId, ORGANIZATIONS_MEMBERS, member.email);
  const userInOrganization = await service.redis.hget(memberKey, 'username');
  if (!userInOrganization) {
    throw ErrorUserNotMember;
  }
  const organization = await getInternalData.call(this, organizationId, false);

  return sendInviteMail.call(this, {
    email: member.email,
    ctx: { firstName: member.firstName, lastName: member.lastName, organization: organization[ORGANIZATIONS_NAME_FIELD] },
  });
}

sendOrganizationInvite.allowed = checkOrganizationExists;
sendOrganizationInvite.transports = [ActionTransport.amqp, ActionTransport.internal];
module.exports = sendOrganizationInvite;
