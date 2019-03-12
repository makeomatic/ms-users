const { ActionTransport } = require('@microfleet/core');
const { getOrganizationId, getOrganizationMetadataAndMembers } = require('../../utils/organization');
const { ErrorOrganizationNotFound } = require('../../constants');

/**
 * @api {amqp} <prefix>.get Get organization
 * @apiVersion 1.0.0
 * @apiName get
 * @apiGroup Organizations
 *
 * @apiParam (Payload) {String} name - unique organization name.
 *
 * @apiSuccess (Response) {String} id - organization id.
 * @apiSuccess (Response) {String} name - organization name.
 * @apiSuccess (Response) {Boolean} active - organization state.
 * @apiSuccess (Response) {Object[]} members - organization members.
 * @apiSuccess (Response) {String} members.username - member email.
 * @apiSuccess (Response) {String} members.firstName - member first name.
 * @apiSuccess (Response) {String} members.lastName - member last name.
 * @apiSuccess (Response) {Date} members.invited - member invite date.
 * @apiSuccess (Response) {Date} members.accepted - member accept invite date.
 * @apiSuccess (Response) {String[]} members.permissions - member permission list.
 * @apiSuccess (Response) {Object} metadata - organization metadata
 */
async function getOrganization({ params }) {
  const service = this;
  const { name: organizationName } = params;

  const organizationId = await getOrganizationId.call(service, organizationName);
  if (!organizationId) {
    throw ErrorOrganizationNotFound;
  }

  return getOrganizationMetadataAndMembers.call(this, organizationId);
}

getOrganization.transports = [ActionTransport.amqp, ActionTransport.internal];
module.exports = getOrganization;
