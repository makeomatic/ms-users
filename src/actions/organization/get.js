const { ActionTransport } = require('@microfleet/core');
const { getOrganizationMetadataAndMembers, checkOrganizationExists } = require('../../utils/organization');

/**
 * @api {amqp} <prefix>.get Get organization
 * @apiVersion 1.0.0
 * @apiName get
 * @apiGroup Organizations
 *
 * @apiParam (Payload) {String} organizationId - organization id.
 *
 * @apiSuccess (Response) {Object} data - response data.
 * @apiSuccess (Response) {String} data.id - organization id.
 * @apiSuccess (Response) {String} data.type - response type.
 * @apiSuccess (Response) {String} data.attributes.id - organization id.
 * @apiSuccess (Response) {String} data.attributes.name - organization name.
 * @apiSuccess (Response) {Boolean} data.attributes.active - organization state.
 * @apiSuccess (Response) {Object[]} data.attributes.members - organization members.
 * @apiSuccess (Response) {String} data.attributes.members.username - member email.
 * @apiSuccess (Response) {String} data.attributes.members.firstName - member first name.
 * @apiSuccess (Response) {String} data.attributes.members.lastName - member last name.
 * @apiSuccess (Response) {Date} data.attributes.members.invited - member invite date.
 * @apiSuccess (Response) {Date} data.attributes.members.accepted - member accept invite date.
 * @apiSuccess (Response) {String[]} data.attributes.members.permissions - member permission list.
 * @apiSuccess (Response) {Object} data.attributes.metadata - organization metadata
 */
async function getOrganization({ params }) {
  const { organizationId } = params;
  const organization = await getOrganizationMetadataAndMembers.call(this, organizationId);
  return {
    data: {
      id: organizationId,
      type: 'organization',
      attributes: organization,
    },
  };
}

getOrganization.allowed = checkOrganizationExists;
getOrganization.transports = [ActionTransport.amqp, ActionTransport.internal];
module.exports = getOrganization;
