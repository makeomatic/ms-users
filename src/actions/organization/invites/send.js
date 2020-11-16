const { ActionTransport } = require('@microfleet/core');
const sendInviteMail = require('../../../utils/organization/send-invite-email');
const getInternalData = require('../../../utils/organization/get-internal-data');
const { checkOrganizationExists } = require('../../../utils/organization');
const {
  ORGANIZATIONS_NAME_FIELD,
  ORGANIZATIONS_ID_FIELD,
  USERS_ACTION_ORGANIZATION_INVITE,
} = require('../../../constants');
const getUserId = require('../../../utils/userData/get-user-id');

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
  const { member, organizationId } = params;
  const organization = await getInternalData.call(this, organizationId);
  let userExist = false;

  try {
    await getUserId.call(this, member.email);
    userExist = true;
  } catch (e) {
    this.log.info('invited user not exist');
  }

  return sendInviteMail.call(this, {
    email: member.email,
    ctx: {
      skipPassword: userExist,
      firstName: member.firstName,
      lastName: member.lastName,
      permissions: member.permissions,
      email: member.email,
      organizationId: organization[ORGANIZATIONS_ID_FIELD],
      organization: organization[ORGANIZATIONS_NAME_FIELD],
    },
  }, USERS_ACTION_ORGANIZATION_INVITE);
}

sendOrganizationInvite.allowed = checkOrganizationExists;
sendOrganizationInvite.transports = [ActionTransport.amqp, ActionTransport.internal];
module.exports = sendOrganizationInvite;
