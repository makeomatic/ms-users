const { ActionTransport } = require('@microfleet/core');
const { getOrganizationId } = require('../../../utils/organization');
const { ErrorOrganizationNotFound } = require('../../../constants');
const addOrganizationMembers = require('../../../utils/organization/addOrganizationMembers');

/**
 * @api {amqp} <prefix>.members.add Add organization member
 * @apiVersion 1.0.0
 * @apiName members.add
 * @apiGroup Organizations
 *
 * @apiDescription This should be used to add member and send invitation.
 *
 * @apiParam (Payload) {String} name - organization name.
 * @apiParam (Payload) {Object} member - member.
 * @apiParam (Payload) {String} member.email - member email.
 * @apiParam (Payload) {String} member.firstName - member first name.
 * @apiParam (Payload) {String} member.lastName - member last name.
 * @apiParam (Payload) {String[]} member.permissions - member permission list.
 */
async function addOrganizationMember({ params }) {
  const service = this;
  const { config } = service;
  const { name: organizationName, member } = params;
  const { audience } = config.organizations;

  const organizationId = await getOrganizationId.call(service, organizationName);
  if (!organizationId) {
    throw ErrorOrganizationNotFound;
  }

  return addOrganizationMembers.call(service, {
    organizationId,
    organizationName,
    audience,
    members: [member],
  });
}

addOrganizationMember.transports = [ActionTransport.amqp, ActionTransport.internal];
module.exports = addOrganizationMember;
