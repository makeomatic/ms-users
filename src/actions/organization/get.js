const { ActionTransport } = require('@microfleet/core');
const { getOrganizationMetadataAndMembers, checkOrganizationExists } = require('../../utils/organization');

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
async function getOrganization() {
  const { organizationId } = this.locals;
  return getOrganizationMetadataAndMembers.call(this, organizationId);
}

getOrganization.allowed = checkOrganizationExists;
getOrganization.transports = [ActionTransport.amqp, ActionTransport.internal];
module.exports = getOrganization;
