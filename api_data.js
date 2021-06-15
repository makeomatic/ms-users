define({ "api": [
  {
    "type": "amqp",
    "url": "<prefix>.auth-bypass",
    "title": "Authentication through 3rd party api",
    "version": "1.0.0",
    "description": "<p>Verifies 3rd party auth, creates &quot;shadow&quot; microfleet user if not exist, login and issues JWT token if everything is in order</p>",
    "parameter": {
      "fields": {
        "Payload": [
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "schema",
            "description": "<ul> <li>bypass auth schema</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "userKey",
            "description": "<ul> <li>user id, token or orther identificator required 3rd party auth api</li> </ul>"
          }
        ]
      }
    },
    "filename": "../src/actions/auth-bypass.js",
    "group": "/home/runner/ms-users/src/actions/auth-bypass.js",
    "groupTitle": "/home/runner/ms-users/src/actions/auth-bypass.js",
    "name": "AmqpPrefixAuthBypass"
  },
  {
    "type": "amqp",
    "url": "<prefix>.list",
    "title": "Retrieve Organizations list",
    "version": "1.0.0",
    "name": "ListOrganizations",
    "group": "Organizations",
    "description": "<p>This method allows to list organizations. They can be sorted &amp; filtered by any metadata field.</p>",
    "parameter": {
      "fields": {
        "Payload": [
          {
            "group": "Payload",
            "type": "Number",
            "optional": true,
            "field": "offset",
            "defaultValue": "0",
            "description": "<ul> <li>cursor for pagination</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "Number",
            "optional": true,
            "field": "limit",
            "defaultValue": "10",
            "description": "<ul> <li>profiles per page</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "allowedValues": [
              "\"ASC\"",
              "\"DESC\""
            ],
            "optional": true,
            "field": "order",
            "defaultValue": "ASC",
            "description": "<ul> <li>sort order</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": true,
            "field": "criteria",
            "description": "<ul> <li>if supplied, sort will be performed based on this field</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "Object",
            "optional": true,
            "field": "filter",
            "description": "<p>to use, consult https://github.com/makeomatic/redis-filtered-sort, can already be stringified</p>"
          }
        ]
      }
    },
    "success": {
      "fields": {
        "Response": [
          {
            "group": "Response",
            "type": "Object[]",
            "optional": false,
            "field": "data",
            "description": "<ul> <li>response data.</li> </ul>"
          },
          {
            "group": "Response",
            "type": "String",
            "optional": false,
            "field": "data.id",
            "description": "<ul> <li>organization id.</li> </ul>"
          },
          {
            "group": "Response",
            "type": "String",
            "optional": false,
            "field": "data.type",
            "description": "<ul> <li>response type.</li> </ul>"
          },
          {
            "group": "Response",
            "type": "String",
            "optional": false,
            "field": "data.attributes.id",
            "description": "<ul> <li>organization id.</li> </ul>"
          },
          {
            "group": "Response",
            "type": "String",
            "optional": false,
            "field": "data.attributes.name",
            "description": "<ul> <li>organization name.</li> </ul>"
          },
          {
            "group": "Response",
            "type": "Boolean",
            "optional": false,
            "field": "data.attributes.active",
            "description": "<ul> <li>organization state.</li> </ul>"
          },
          {
            "group": "Response",
            "type": "Object",
            "optional": false,
            "field": "data.attributes.metadata",
            "description": "<ul> <li>organization metadata</li> </ul>"
          },
          {
            "group": "Response",
            "type": "Object",
            "optional": false,
            "field": "meta",
            "description": "<ul> <li>response meta.</li> </ul>"
          },
          {
            "group": "Response",
            "type": "Number",
            "optional": false,
            "field": "meta.cursor",
            "description": "<ul> <li>cursor.</li> </ul>"
          },
          {
            "group": "Response",
            "type": "Number",
            "optional": false,
            "field": "meta.page",
            "description": "<ul> <li>page.</li> </ul>"
          },
          {
            "group": "Response",
            "type": "Number",
            "optional": false,
            "field": "meta.pages",
            "description": "<ul> <li>pages.</li> </ul>"
          },
          {
            "group": "Response",
            "type": "Number",
            "optional": false,
            "field": "meta.total",
            "description": "<ul> <li>total.</li> </ul>"
          }
        ]
      }
    },
    "filename": "../src/actions/organization/list.js",
    "groupTitle": "Organizations"
  },
  {
    "type": "amqp",
    "url": "<prefix>.create",
    "title": "Create organization",
    "version": "1.0.0",
    "name": "create",
    "group": "Organizations",
    "description": "<p>This should be used to create organization.</p>",
    "parameter": {
      "fields": {
        "Payload": [
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "name",
            "description": "<ul> <li>unique organization name.</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "Boolean",
            "optional": false,
            "field": "active",
            "defaultValue": "false",
            "description": "<ul> <li>organization state.</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "Object",
            "optional": false,
            "field": "metadata",
            "description": "<ul> <li>organization metadata</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "Object[]",
            "optional": false,
            "field": "members",
            "description": "<ul> <li>organization members.</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "members.username",
            "description": "<ul> <li>member email.</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "members.firstName",
            "description": "<ul> <li>member first name.</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "members.lastName",
            "description": "<ul> <li>member last name.</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String[]",
            "optional": false,
            "field": "members.permissions",
            "description": "<ul> <li>member permission list.</li> </ul>"
          }
        ]
      }
    },
    "success": {
      "fields": {
        "Response": [
          {
            "group": "Response",
            "type": "Object",
            "optional": false,
            "field": "data",
            "description": "<ul> <li>response data.</li> </ul>"
          },
          {
            "group": "Response",
            "type": "Object",
            "optional": false,
            "field": "meta",
            "description": "<ul> <li>response meta.</li> </ul>"
          },
          {
            "group": "Response",
            "type": "String",
            "optional": false,
            "field": "data.id",
            "description": "<ul> <li>organization id.</li> </ul>"
          },
          {
            "group": "Response",
            "type": "String",
            "optional": false,
            "field": "data.type",
            "description": "<ul> <li>response type.</li> </ul>"
          },
          {
            "group": "Response",
            "type": "String",
            "optional": false,
            "field": "data.attributes.id",
            "description": "<ul> <li>organization id.</li> </ul>"
          },
          {
            "group": "Response",
            "type": "String",
            "optional": false,
            "field": "data.attributes.name",
            "description": "<ul> <li>organization name.</li> </ul>"
          },
          {
            "group": "Response",
            "type": "Boolean",
            "optional": false,
            "field": "data.attributes.active",
            "description": "<ul> <li>organization state.</li> </ul>"
          },
          {
            "group": "Response",
            "type": "Object[]",
            "optional": false,
            "field": "data.attributes.members",
            "description": "<ul> <li>organization members.</li> </ul>"
          },
          {
            "group": "Response",
            "type": "String",
            "optional": false,
            "field": "data.attributes.members.username",
            "description": "<ul> <li>member email.</li> </ul>"
          },
          {
            "group": "Response",
            "type": "String",
            "optional": false,
            "field": "data.attributes.members.firstName",
            "description": "<ul> <li>member first name.</li> </ul>"
          },
          {
            "group": "Response",
            "type": "String",
            "optional": false,
            "field": "data.attributes.members.lastName",
            "description": "<ul> <li>member last name.</li> </ul>"
          },
          {
            "group": "Response",
            "type": "Date",
            "optional": false,
            "field": "data.attributes.members.invited",
            "description": "<ul> <li>member invite date.</li> </ul>"
          },
          {
            "group": "Response",
            "type": "Date",
            "optional": false,
            "field": "data.attributes.members.accepted",
            "description": "<ul> <li>member accept invite date.</li> </ul>"
          },
          {
            "group": "Response",
            "type": "String[]",
            "optional": false,
            "field": "data.attributes.members.permissions",
            "description": "<ul> <li>member permission list.</li> </ul>"
          },
          {
            "group": "Response",
            "type": "Object",
            "optional": false,
            "field": "data.attributes.metadata",
            "description": "<ul> <li>organization metadata</li> </ul>"
          },
          {
            "group": "Response",
            "type": "String",
            "optional": false,
            "field": "meta.invites",
            "description": "<ul> <li>organization invites list.</li> </ul>"
          }
        ]
      }
    },
    "filename": "../src/actions/organization/create.js",
    "groupTitle": "Organizations"
  },
  {
    "type": "amqp",
    "url": "<prefix>.delete",
    "title": "Delete organization",
    "version": "1.0.0",
    "name": "delete",
    "group": "Organizations",
    "description": "<p>This should be used to delete organization.</p>",
    "parameter": {
      "fields": {
        "Payload": [
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "organizationId",
            "description": "<ul> <li>organization id.</li> </ul>"
          }
        ]
      }
    },
    "filename": "../src/actions/organization/delete.js",
    "groupTitle": "Organizations"
  },
  {
    "type": "amqp",
    "url": "<prefix>.get",
    "title": "Get organization",
    "version": "1.0.0",
    "name": "get",
    "group": "Organizations",
    "parameter": {
      "fields": {
        "Payload": [
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "organizationId",
            "description": "<ul> <li>organization id.</li> </ul>"
          }
        ]
      }
    },
    "success": {
      "fields": {
        "Response": [
          {
            "group": "Response",
            "type": "Object",
            "optional": false,
            "field": "data",
            "description": "<ul> <li>response data.</li> </ul>"
          },
          {
            "group": "Response",
            "type": "String",
            "optional": false,
            "field": "data.id",
            "description": "<ul> <li>organization id.</li> </ul>"
          },
          {
            "group": "Response",
            "type": "String",
            "optional": false,
            "field": "data.type",
            "description": "<ul> <li>response type.</li> </ul>"
          },
          {
            "group": "Response",
            "type": "String",
            "optional": false,
            "field": "data.attributes.id",
            "description": "<ul> <li>organization id.</li> </ul>"
          },
          {
            "group": "Response",
            "type": "String",
            "optional": false,
            "field": "data.attributes.name",
            "description": "<ul> <li>organization name.</li> </ul>"
          },
          {
            "group": "Response",
            "type": "Boolean",
            "optional": false,
            "field": "data.attributes.active",
            "description": "<ul> <li>organization state.</li> </ul>"
          },
          {
            "group": "Response",
            "type": "Object[]",
            "optional": false,
            "field": "data.attributes.members",
            "description": "<ul> <li>organization members.</li> </ul>"
          },
          {
            "group": "Response",
            "type": "String",
            "optional": false,
            "field": "data.attributes.members.username",
            "description": "<ul> <li>member email.</li> </ul>"
          },
          {
            "group": "Response",
            "type": "String",
            "optional": false,
            "field": "data.attributes.members.firstName",
            "description": "<ul> <li>member first name.</li> </ul>"
          },
          {
            "group": "Response",
            "type": "String",
            "optional": false,
            "field": "data.attributes.members.lastName",
            "description": "<ul> <li>member last name.</li> </ul>"
          },
          {
            "group": "Response",
            "type": "Date",
            "optional": false,
            "field": "data.attributes.members.invited",
            "description": "<ul> <li>member invite date.</li> </ul>"
          },
          {
            "group": "Response",
            "type": "Date",
            "optional": false,
            "field": "data.attributes.members.accepted",
            "description": "<ul> <li>member accept invite date.</li> </ul>"
          },
          {
            "group": "Response",
            "type": "String[]",
            "optional": false,
            "field": "data.attributes.members.permissions",
            "description": "<ul> <li>member permission list.</li> </ul>"
          },
          {
            "group": "Response",
            "type": "Object",
            "optional": false,
            "field": "data.attributes.metadata",
            "description": "<ul> <li>organization metadata</li> </ul>"
          }
        ]
      }
    },
    "filename": "../src/actions/organization/get.js",
    "groupTitle": "Organizations"
  },
  {
    "type": "amqp",
    "url": "<prefix>.getMetadata",
    "title": "Get organization metadata",
    "version": "1.0.0",
    "name": "getMetadata",
    "group": "Organizations",
    "parameter": {
      "fields": {
        "Payload": [
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "organizationId",
            "description": "<ul> <li>organization id.</li> </ul>"
          }
        ]
      }
    },
    "success": {
      "fields": {
        "Response": [
          {
            "group": "Response",
            "type": "Object",
            "optional": false,
            "field": "data",
            "description": "<ul> <li>response data.</li> </ul>"
          },
          {
            "group": "Response",
            "type": "Object",
            "optional": false,
            "field": "data.id",
            "description": "<ul> <li>organization id</li> </ul>"
          },
          {
            "group": "Response",
            "type": "String",
            "optional": false,
            "field": "data.type",
            "description": "<ul> <li>response type.</li> </ul>"
          },
          {
            "group": "Response",
            "type": "Object",
            "optional": false,
            "field": "data.attributes.metadata",
            "description": "<ul> <li>organization metadata</li> </ul>"
          }
        ]
      }
    },
    "filename": "../src/actions/organization/getMetadata.js",
    "groupTitle": "Organizations"
  },
  {
    "type": "amqp",
    "url": "<prefix>.invites.accept",
    "title": "Accept invitation",
    "version": "1.0.0",
    "name": "invites.accept",
    "group": "Organizations",
    "description": "<p>This should be used to accept invitation.</p>",
    "parameter": {
      "fields": {
        "Payload": [
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "organizationId",
            "description": "<ul> <li>organization id.</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "username",
            "description": "<ul> <li>member email.</li> </ul>"
          }
        ]
      }
    },
    "filename": "../src/actions/organization/invites/accept.js",
    "groupTitle": "Organizations"
  },
  {
    "type": "amqp",
    "url": "<prefix>.invites.list",
    "title": "Invitations list",
    "version": "1.0.0",
    "name": "invites.list",
    "group": "Organizations",
    "description": "<p>Invitations list</p>",
    "parameter": {
      "fields": {
        "Payload": [
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "organizationId",
            "description": "<ul> <li>organization id.</li> </ul>"
          }
        ]
      }
    },
    "filename": "../src/actions/organization/invites/list.js",
    "groupTitle": "Organizations"
  },
  {
    "type": "amqp",
    "url": "<prefix>.invites.revoke",
    "title": "Revoke invitation",
    "version": "1.0.0",
    "name": "invites.revoke",
    "group": "Organizations",
    "description": "<p>In a normal flow - revoke organization invite by email. Can potentially be used by other Customers in the same organization</p>",
    "parameter": {
      "fields": {
        "Payload": [
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "organizationId",
            "description": "<ul> <li>organization id.</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "member",
            "description": "<ul> <li>member.</li> </ul>"
          }
        ]
      }
    },
    "filename": "../src/actions/organization/invites/revoke.js",
    "groupTitle": "Organizations"
  },
  {
    "type": "amqp",
    "url": "<prefix>.invites.send",
    "title": "Send invitation",
    "version": "1.0.0",
    "name": "invites.send",
    "group": "Organizations",
    "description": "<p>In a normal flow - sends out an email to a Customer to accept invitation to the organization. Can potentially be used by other Customers in the same organization</p>",
    "parameter": {
      "fields": {
        "Payload": [
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "organizationId",
            "description": "<ul> <li>organization id.</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "Object",
            "optional": false,
            "field": "member",
            "description": "<ul> <li>member data.</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "member.email",
            "description": "<ul> <li>member email.</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "member.firstName",
            "description": "<ul> <li>member first name.</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "member.lastName",
            "description": "<ul> <li>member last name.</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String[]",
            "optional": false,
            "field": "member.permissions",
            "description": "<ul> <li>member permission list.</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "senderId",
            "description": "<ul> <li>invitation sender id.</li> </ul>"
          }
        ]
      }
    },
    "filename": "../src/actions/organization/invites/send.js",
    "groupTitle": "Organizations"
  },
  {
    "type": "amqp",
    "url": "<prefix>.members.add",
    "title": "Add organization member",
    "version": "1.0.0",
    "name": "members.add",
    "group": "Organizations",
    "description": "<p>This should be used to add member and send invitation.</p>",
    "parameter": {
      "fields": {
        "Payload": [
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "organizationId",
            "description": "<ul> <li>organization id.</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "Object",
            "optional": false,
            "field": "member",
            "description": "<ul> <li>member.</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "member.email",
            "description": "<ul> <li>member email.</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "member.firstName",
            "description": "<ul> <li>member first name.</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "member.lastName",
            "description": "<ul> <li>member last name.</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String[]",
            "optional": false,
            "field": "member.permissions",
            "description": "<ul> <li>member permission list.</li> </ul>"
          }
        ]
      }
    },
    "filename": "../src/actions/organization/members/add.js",
    "groupTitle": "Organizations"
  },
  {
    "type": "amqp",
    "url": "<prefix>.members.Get",
    "title": "Get organization member",
    "version": "1.0.0",
    "name": "members.get",
    "group": "Organizations",
    "description": "<p>This should be used to get member.</p>",
    "parameter": {
      "fields": {
        "Payload": [
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "organizationId",
            "description": "<ul> <li>organization id.</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "username",
            "description": "<ul> <li>member email.</li> </ul>"
          }
        ]
      }
    },
    "filename": "../src/actions/organization/members/get.js",
    "groupTitle": "Organizations"
  },
  {
    "type": "amqp",
    "url": "<prefix>.members.list",
    "title": "Get organization members",
    "version": "1.0.0",
    "name": "members.list",
    "group": "Organizations",
    "description": "<p>This should be used to get organization members list.</p>",
    "parameter": {
      "fields": {
        "Payload": [
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "organizationId",
            "description": "<ul> <li>organization id.</li> </ul>"
          }
        ]
      }
    },
    "success": {
      "fields": {
        "Response": [
          {
            "group": "Response",
            "type": "Object",
            "optional": false,
            "field": "data",
            "description": "<ul> <li>response data.</li> </ul>"
          },
          {
            "group": "Response",
            "type": "Object",
            "optional": false,
            "field": "data.id",
            "description": "<ul> <li>organization id.</li> </ul>"
          },
          {
            "group": "Response",
            "type": "Object",
            "optional": false,
            "field": "data.type",
            "description": "<ul> <li>response type.</li> </ul>"
          },
          {
            "group": "Response",
            "type": "Object[]",
            "optional": false,
            "field": "data.attributes",
            "description": "<ul> <li>organization members.</li> </ul>"
          },
          {
            "group": "Response",
            "type": "String",
            "optional": false,
            "field": "data.attributes.id",
            "description": "<ul> <li>organization member id.</li> </ul>"
          },
          {
            "group": "Response",
            "type": "String",
            "optional": false,
            "field": "data.attributes.type",
            "description": "<ul> <li>entity type.</li> </ul>"
          },
          {
            "group": "Response",
            "type": "Object[]",
            "optional": false,
            "field": "data.attributes.attributes",
            "description": "<ul> <li>organization member.</li> </ul>"
          },
          {
            "group": "Response",
            "type": "String",
            "optional": false,
            "field": "data.attributes.attributes.username",
            "description": "<ul> <li>member email.</li> </ul>"
          },
          {
            "group": "Response",
            "type": "String",
            "optional": false,
            "field": "data.attributes.attributes.firstName",
            "description": "<ul> <li>member first name.</li> </ul>"
          },
          {
            "group": "Response",
            "type": "String",
            "optional": false,
            "field": "data.attributes.attributes.lastName",
            "description": "<ul> <li>member last name.</li> </ul>"
          },
          {
            "group": "Response",
            "type": "Date",
            "optional": false,
            "field": "data.attributes.attributes.invited",
            "description": "<ul> <li>member invite date.</li> </ul>"
          },
          {
            "group": "Response",
            "type": "Date",
            "optional": false,
            "field": "data.attributes.attributes.accepted",
            "description": "<ul> <li>member accept invite date.</li> </ul>"
          },
          {
            "group": "Response",
            "type": "String[]",
            "optional": false,
            "field": "data.attributes.attributes.permissions",
            "description": "<ul> <li>member permission list.</li> </ul>"
          }
        ]
      }
    },
    "filename": "../src/actions/organization/members/list.js",
    "groupTitle": "Organizations"
  },
  {
    "type": "amqp",
    "url": "<prefix>.members.permission",
    "title": "Sets permission levels for a given user",
    "version": "1.0.0",
    "name": "members.permission",
    "group": "Organizations",
    "description": "<p>Sets permission levels for a given user.</p>",
    "parameter": {
      "fields": {
        "Payload": [
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "organizationId",
            "description": "<ul> <li>organization id.</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "username",
            "description": "<ul> <li>organization member email.</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "Object",
            "optional": false,
            "field": "permission",
            "description": "<ul> <li>metadata operations, supports <code>$set string[]</code>, <code>$remove string[]</code></li> </ul>"
          }
        ]
      }
    },
    "filename": "../src/actions/organization/members/permission.js",
    "groupTitle": "Organizations"
  },
  {
    "type": "amqp",
    "url": "<prefix>.members.remove",
    "title": "Remove organization member",
    "version": "1.0.0",
    "name": "members.remove",
    "group": "Organizations",
    "description": "<p>This should be used to remove member.</p>",
    "parameter": {
      "fields": {
        "Payload": [
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "organizationId",
            "description": "<ul> <li>organization id.</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "username",
            "description": "<ul> <li>member email.</li> </ul>"
          }
        ]
      }
    },
    "filename": "../src/actions/organization/members/remove.js",
    "groupTitle": "Organizations"
  },
  {
    "type": "amqp",
    "url": "<prefix>.members.update",
    "title": "Update organization member",
    "version": "1.0.0",
    "name": "members.update",
    "group": "Organizations",
    "description": "<p>This should be used to update member.</p>",
    "parameter": {
      "fields": {
        "Payload": [
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "organizationId",
            "description": "<ul> <li>organization id.</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "username",
            "description": "<ul> <li>member email.</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "Object[]",
            "optional": true,
            "field": "data",
            "description": "<ul> <li>supports <code>$set key:value</code>, <code>$remove keys[]</code></li> </ul>"
          }
        ]
      }
    },
    "filename": "../src/actions/organization/members/update.js",
    "groupTitle": "Organizations"
  },
  {
    "type": "amqp",
    "url": "<prefix>.state",
    "title": "Update organization state",
    "version": "1.0.0",
    "name": "state",
    "group": "Organizations",
    "description": "<p>This should be used to update organization state.</p>",
    "parameter": {
      "fields": {
        "Payload": [
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "organizationId",
            "description": "<ul> <li>organization id.</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "Boolean",
            "optional": false,
            "field": "active",
            "defaultValue": "false",
            "description": "<ul> <li>organization state.</li> </ul>"
          }
        ]
      }
    },
    "success": {
      "fields": {
        "Response": [
          {
            "group": "Response",
            "type": "Object",
            "optional": false,
            "field": "data",
            "description": "<ul> <li>response data.</li> </ul>"
          },
          {
            "group": "Response",
            "type": "String",
            "optional": false,
            "field": "data.id",
            "description": "<ul> <li>organization id.</li> </ul>"
          },
          {
            "group": "Response",
            "type": "String",
            "optional": false,
            "field": "data.type",
            "description": "<ul> <li>response type.</li> </ul>"
          },
          {
            "group": "Response",
            "type": "Boolean",
            "optional": false,
            "field": "data.attributes.active",
            "description": "<ul> <li>organization state.</li> </ul>"
          }
        ]
      }
    },
    "filename": "../src/actions/organization/state.js",
    "groupTitle": "Organizations"
  },
  {
    "type": "amqp",
    "url": "<prefix>.updateMetadata",
    "title": "Update metadata organization",
    "version": "1.0.0",
    "name": "updateMetadata",
    "group": "Organizations",
    "description": "<p>This should be used to update organization metadata.</p>",
    "parameter": {
      "fields": {
        "Payload": [
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "organizationId",
            "description": "<ul> <li>organization id.</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "Object",
            "optional": false,
            "field": "metadata",
            "description": "<ul> <li>metadata operations, supports <code>$set key:value</code>, <code>$remove keys[]</code>, <code>$incr key:diff</code></li> </ul>"
          }
        ]
      }
    },
    "success": {
      "fields": {
        "Response": [
          {
            "group": "Response",
            "type": "Object",
            "optional": false,
            "field": "data",
            "description": "<ul> <li>response data.</li> </ul>"
          },
          {
            "group": "Response",
            "type": "Object",
            "optional": false,
            "field": "data.id",
            "description": "<ul> <li>organization id</li> </ul>"
          },
          {
            "group": "Response",
            "type": "String",
            "optional": false,
            "field": "data.type",
            "description": "<ul> <li>response type.</li> </ul>"
          },
          {
            "group": "Response",
            "type": "Object",
            "optional": false,
            "field": "data.attributes",
            "description": "<ul> <li>organization metadata</li> </ul>"
          }
        ]
      }
    },
    "filename": "../src/actions/organization/updateMetadata.js",
    "groupTitle": "Organizations"
  },
  {
    "type": "amqp",
    "url": "<prefix>.token.create",
    "title": "Create Token",
    "version": "1.0.0",
    "name": "CreateToken",
    "group": "Tokens",
    "description": "<p>This method allows to create an access token, which can be used instead of username+password exchanged for JWT. This is usable directly in .verify, but requires special flag passed to indicate type of token being used</p>",
    "parameter": {
      "fields": {
        "Payload": [
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "username",
            "description": "<ul> <li>id of the user</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "name",
            "description": "<ul> <li>used to identify token</li> </ul>"
          }
        ]
      }
    },
    "filename": "../src/actions/token/create.js",
    "groupTitle": "Tokens"
  },
  {
    "type": "amqp",
    "url": "<prefix>.token.erase",
    "title": "Erase Token",
    "version": "1.0.0",
    "name": "EraseToken",
    "group": "Tokens",
    "description": "<p>This method invalidates tokens from future use. Token is uuidv4() generated earlier and username is who it belongs to</p>",
    "parameter": {
      "fields": {
        "Payload": [
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "token",
            "description": "<ul> <li>token to be invalidated</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "username",
            "description": "<ul> <li>token owner</li> </ul>"
          }
        ]
      }
    },
    "filename": "../src/actions/token/erase.js",
    "groupTitle": "Tokens"
  },
  {
    "type": "amqp",
    "url": "<prefix>.token.list",
    "title": "List Tokens",
    "version": "1.0.0",
    "name": "ListTokens",
    "group": "Tokens",
    "description": "<p>This method lists issued tokens to the passed user It only returns description of the token and the day it was last issued and accessed, not the token itself</p>",
    "parameter": {
      "fields": {
        "Payload": [
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "username",
            "description": "<ul> <li>id of the user</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "Number",
            "optional": true,
            "field": "page",
            "defaultValue": "0",
            "description": "<ul> <li>number of page to return, defaults to 0</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "Number",
            "optional": true,
            "field": "pageSize",
            "defaultValue": "20",
            "description": "<ul> <li>page size</li> </ul>"
          }
        ]
      }
    },
    "filename": "../src/actions/token/list.js",
    "groupTitle": "Tokens"
  },
  {
    "type": "amqp",
    "url": "<prefix>.contacts.add",
    "title": "Add User Contact",
    "version": "1.0.0",
    "name": "Add",
    "group": "Users.Contact",
    "description": "<p>Interface to add user contacts</p>",
    "parameter": {
      "fields": {
        "Payload": [
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "username",
            "description": "<ul> <li></li> </ul>"
          }
        ]
      }
    },
    "filename": "../src/actions/contacts/add.js",
    "groupTitle": "Users.Contact"
  },
  {
    "type": "amqp",
    "url": "<prefix>.contacts.challenge",
    "title": "Request the \"challenge\" for the verification",
    "version": "1.0.0",
    "name": "Add",
    "group": "Users.Contact",
    "description": "<p>Interface request the &quot;challenge&quot; for the verification</p>",
    "parameter": {
      "fields": {
        "Payload": [
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "username",
            "description": "<ul> <li></li> </ul>"
          }
        ]
      }
    },
    "filename": "../src/actions/contacts/challenge.js",
    "groupTitle": "Users.Contact"
  },
  {
    "type": "amqp",
    "url": "<prefix>.contacts.list",
    "title": "User Contact list",
    "version": "1.0.0",
    "name": "Add",
    "group": "Users.Contact",
    "description": "<p>Interface to get user contacts list</p>",
    "parameter": {
      "fields": {
        "Payload": [
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "username",
            "description": "<ul> <li></li> </ul>"
          }
        ]
      }
    },
    "filename": "../src/actions/contacts/list.js",
    "groupTitle": "Users.Contact"
  },
  {
    "type": "amqp",
    "url": "<prefix>.contacts.remove",
    "title": "Remove User Contact",
    "version": "1.0.0",
    "name": "Add",
    "group": "Users.Contact",
    "description": "<p>Interface to remove user contacts</p>",
    "parameter": {
      "fields": {
        "Payload": [
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "username",
            "description": "<ul> <li></li> </ul>"
          }
        ]
      }
    },
    "filename": "../src/actions/contacts/remove.js",
    "groupTitle": "Users.Contact"
  },
  {
    "type": "amqp",
    "url": "<prefix>.contacts.verificate",
    "title": "",
    "version": "1.0.0",
    "name": "Add",
    "group": "Users.Contact",
    "description": "<p>Interface request to verificate</p>",
    "parameter": {
      "fields": {
        "Payload": [
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "username",
            "description": "<ul> <li></li> </ul>"
          }
        ]
      }
    },
    "filename": "../src/actions/contacts/verify.js",
    "groupTitle": "Users.Contact"
  },
  {
    "type": "amqp",
    "url": "<prefix>.activate",
    "title": "Activate User",
    "version": "1.0.0",
    "name": "ActivateUser",
    "group": "Users",
    "description": "<p>This method allows one to activate user by 3 means:</p> <ol> <li>When only <code>username</code> is provided, no verifications will be performed and user will be set to active. This case is used when admin activates a user.</li> <li>When only <code>token</code> is provided that means that token is encrypted and would be verified. This case is used when user completes verification challenge.</li> <li>This case is similar to the previous, but used both <code>username</code> and <code>token</code> for verification. Use this when the token isn't decrypted. Success response contains user object.</li> </ol>",
    "parameter": {
      "fields": {
        "Payload": [
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "username",
            "description": "<ul> <li>id of the user</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "token",
            "description": "<ul> <li>verification token</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": true,
            "field": "remoteip",
            "description": "<ul> <li>not used, but is reserved for security log in the future</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": true,
            "field": "audience",
            "description": "<ul> <li>additional metadata will be pushed there from custom hooks</li> </ul>"
          }
        ]
      }
    },
    "filename": "../src/actions/activate.js",
    "groupTitle": "Users"
  },
  {
    "type": "amqp",
    "url": "<prefix>.alias",
    "title": "Add alias to user",
    "version": "1.0.0",
    "name": "AddAlias",
    "group": "Users",
    "description": "<p>Adds alias to existing username. This alias must be unique across system, as well as obide strict restrictions - ascii chars only, include numbers and dot. It's used to obfuscate username in public interfaces</p>",
    "parameter": {
      "fields": {
        "Payload": [
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "username",
            "description": "<ul> <li>currently email of the user</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "size": "3..15",
            "optional": false,
            "field": "alias",
            "description": "<ul> <li>chosen alias</li> </ul>"
          }
        ]
      }
    },
    "filename": "../src/actions/alias.js",
    "groupTitle": "Users"
  },
  {
    "type": "amqp",
    "url": "<prefix>.attach",
    "title": "Attach",
    "version": "1.0.0",
    "name": "Attach",
    "group": "Users",
    "description": "<p>Allows to attach secret key and recovery code to user's account, generate and returns initial recovery code.</p>",
    "header": {
      "fields": {
        "Authorization": [
          {
            "group": "Authorization",
            "type": "String",
            "optional": false,
            "field": "Authorization",
            "description": "<p>JWT :accessToken</p>"
          },
          {
            "group": "Authorization",
            "type": "String",
            "optional": false,
            "field": "X-Auth-TOTP",
            "description": "<p>TOTP or recoveryCode</p>"
          }
        ]
      },
      "examples": [
        {
          "title": "Authorization-Example:",
          "content": "\"Authorization: JWT my.reallyniceandvalid.jsonwebtoken\"",
          "type": "json"
        },
        {
          "title": "X-Auth-TOTP-Example:",
          "content": "\"X-Auth-TOTP: 123456\"",
          "type": "json"
        }
      ]
    },
    "parameter": {
      "fields": {
        "Payload": [
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "username",
            "description": "<ul> <li>id of the user</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "secret",
            "description": "<ul> <li>crypto secure 32 characters hex key</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "Number",
            "optional": true,
            "field": "totp",
            "description": "<ul> <li>time-based one time password</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": true,
            "field": "remoteip",
            "description": "<ul> <li>security logging feature, not used</li> </ul>"
          }
        ]
      }
    },
    "filename": "../src/actions/mfa/attach.js",
    "groupTitle": "Users"
  },
  {
    "type": "amqp",
    "url": "<prefix>.ban",
    "title": "Lock or Unlock user",
    "version": "1.0.0",
    "name": "BanUser",
    "group": "Users",
    "description": "<p>Allows one to lock or unlock a given user, optionally supplying reason for why the user was banned.</p>",
    "parameter": {
      "fields": {
        "Payload": [
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "username",
            "description": "<ul> <li>currently email of the user</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "Boolean",
            "allowedValues": [
              "\"true\"",
              "\"false\""
            ],
            "optional": false,
            "field": "ban",
            "description": "<ul> <li>if <code>true</code>, then user is going to be banned, if <code>false</code> - unlocked</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": true,
            "field": "remoteip",
            "description": "<ul> <li>used for security log</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": true,
            "field": "reason",
            "description": "<ul> <li>reason for the user being banned</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": true,
            "field": "whom",
            "description": "<ul> <li>id of the person, who banned the user</li> </ul>"
          }
        ]
      }
    },
    "filename": "../src/actions/ban.js",
    "groupTitle": "Users"
  },
  {
    "type": "amqp",
    "url": "<prefix>.challenge",
    "title": "Creates user challenges",
    "version": "1.0.0",
    "name": "ChallengeUser",
    "group": "Users",
    "description": "<p>Must be used internally to create user challenges. Currently only email challenge is supported. Contains password reset challenge &amp; account activation challenge. The latter is called from the <code>registration</code> action automatically, when the account must complete the challenge</p>",
    "parameter": {
      "fields": {
        "Payload": [
          {
            "group": "Payload",
            "type": "String",
            "allowedValues": [
              "\"email\""
            ],
            "optional": false,
            "field": "type",
            "description": "<ul> <li>type of challenge, only &quot;email&quot; is supported now</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "username",
            "description": "<ul> <li>user's username</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": true,
            "field": "remoteip",
            "description": "<ul> <li>used for security log</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": true,
            "field": "metadata",
            "description": "<ul> <li>not used, but in the future this would be associated with user when challenge is required</li> </ul>"
          }
        ]
      }
    },
    "filename": "../src/actions/challenge.js",
    "groupTitle": "Users"
  },
  {
    "type": "amqp",
    "url": "<prefix>.detach",
    "title": "Detach",
    "version": "1.0.0",
    "name": "Detach",
    "group": "Users",
    "description": "<p>Allows to detach secret key and recovery code from user's account, basically disables MFA.</p>",
    "header": {
      "fields": {
        "Authorization": [
          {
            "group": "Authorization",
            "type": "String",
            "optional": false,
            "field": "Authorization",
            "description": "<p>JWT :accessToken</p>"
          },
          {
            "group": "Authorization",
            "type": "String",
            "optional": false,
            "field": "X-Auth-TOTP",
            "description": "<p>TOTP or recoveryCode</p>"
          }
        ]
      },
      "examples": [
        {
          "title": "Authorization-Example:",
          "content": "\"Authorization: JWT my.reallyniceandvalid.jsonwebtoken\"",
          "type": "json"
        },
        {
          "title": "X-Auth-TOTP-Example:",
          "content": "\"X-Auth-TOTP: 123456\"",
          "type": "json"
        }
      ]
    },
    "parameter": {
      "fields": {
        "Payload": [
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "username",
            "description": "<ul> <li>id of the user</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "Number",
            "optional": false,
            "field": "totp",
            "description": "<ul> <li>6 chars time-based one time password or 8 characters hex recovery code</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": true,
            "field": "remoteip",
            "description": "<ul> <li>security logging feature, not used</li> </ul>"
          }
        ]
      }
    },
    "filename": "../src/actions/mfa/detach.js",
    "groupTitle": "Users"
  },
  {
    "type": "amqp",
    "url": "<prefix>.disposable-password",
    "title": "Request disposable password",
    "version": "1.0.0",
    "name": "DisposablePassword",
    "group": "Users",
    "description": "<p>This method allowes to get disposable password.</p>",
    "parameter": {
      "fields": {
        "Parameter": [
          {
            "group": "Parameter",
            "type": "Unknown",
            "optional": false,
            "field": "challengeType",
            "defaultValue": "phone",
            "description": "<p>undefined</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "id",
            "description": "<p>User identificator</p>"
          }
        ]
      }
    },
    "filename": "../src/actions/disposable-password.js",
    "groupTitle": "Users"
  },
  {
    "type": "amqp",
    "url": "<prefix>.generate-key",
    "title": "Generates secret key",
    "version": "1.0.0",
    "name": "GenerateKey",
    "group": "Users",
    "description": "<p>Generates secret key for MFA.</p>",
    "header": {
      "fields": {
        "Authorization": [
          {
            "group": "Authorization",
            "type": "String",
            "optional": false,
            "field": "Authorization",
            "description": "<p>JWT :accessToken</p>"
          }
        ]
      },
      "examples": [
        {
          "title": "Authorization-Example:",
          "content": "\"Authorization: JWT my.reallyniceandvalid.jsonwebtoken\"",
          "type": "json"
        }
      ]
    },
    "filename": "../src/actions/mfa/generate-key.js",
    "groupTitle": "Users"
  },
  {
    "type": "amqp",
    "url": "<prefix>.invite-list",
    "title": "Retrieve list of sent invitations",
    "version": "1.0.0",
    "name": "InviteList",
    "group": "Users",
    "description": "<p>This method allows to retrieve sent invitations</p>",
    "parameter": {
      "fields": {
        "Payload": [
          {
            "group": "Payload",
            "type": "Number",
            "optional": true,
            "field": "offset",
            "defaultValue": "0",
            "description": "<ul> <li>cursor for pagination</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "Number",
            "optional": true,
            "field": "limit",
            "defaultValue": "10",
            "description": "<ul> <li>profiles per page</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "allowedValues": [
              "\"ASC\"",
              "\"DESC\""
            ],
            "optional": true,
            "field": "order",
            "defaultValue": "ASC",
            "description": "<ul> <li>sort order</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": true,
            "field": "criteria",
            "description": "<ul> <li>if supplied, sort will be performed based on this field</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "Object",
            "optional": true,
            "field": "filter",
            "description": "<p>to use, consult https://github.com/makeomatic/redis-filtered-sort, can already be stringified</p>"
          }
        ]
      }
    },
    "filename": "../src/actions/invite-list.js",
    "groupTitle": "Users"
  },
  {
    "type": "amqp",
    "url": "<prefix>.list",
    "title": "Retrieve Registered Users",
    "version": "1.0.0",
    "name": "ListUsers",
    "group": "Users",
    "description": "<p>This method allows to list user that are registered and activated in the system. They can be sorted &amp; filtered by any metadata field. Furthermore, it retrieves metadata based on the supplied audience and returns array of users similar to <code>info</code> endpoint</p>",
    "parameter": {
      "fields": {
        "Payload": [
          {
            "group": "Payload",
            "type": "Number",
            "optional": true,
            "field": "offset",
            "defaultValue": "0",
            "description": "<ul> <li>cursor for pagination</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "Number",
            "optional": true,
            "field": "limit",
            "defaultValue": "10",
            "description": "<ul> <li>profiles per page</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "allowedValues": [
              "\"ASC\"",
              "\"DESC\""
            ],
            "optional": true,
            "field": "order",
            "defaultValue": "ASC",
            "description": "<ul> <li>sort order</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": true,
            "field": "criteria",
            "description": "<ul> <li>if supplied, sort will be performed based on this field</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "audience",
            "description": "<ul> <li>which namespace of metadata should be used for filtering &amp; retrieving</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "Mixed",
            "optional": true,
            "field": "public",
            "defaultValue": "false",
            "description": "<ul> <li>when <code>true</code> returns only publicly marked users, if set to string - then uses referral index</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "Object",
            "optional": true,
            "field": "filter",
            "description": "<p>to use, consult https://github.com/makeomatic/redis-filtered-sort, can already be stringified</p>"
          },
          {
            "group": "Payload",
            "type": "Boolean",
            "optional": true,
            "field": "userIdsOnly",
            "defaultValue": "false",
            "description": "<p>if set to true - will only return userIds</p>"
          }
        ]
      }
    },
    "filename": "../src/actions/list.js",
    "groupTitle": "Users"
  },
  {
    "type": "amqp",
    "url": "<prefix>.login",
    "title": "User Authentication",
    "version": "1.0.0",
    "name": "LoginUser",
    "group": "Users",
    "description": "<p>Provides various strategies for user authentication. Returns signed JWT token that could be used for state resolution and authorization, as well as user object</p>",
    "parameter": {
      "fields": {
        "Payload": [
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "username",
            "description": "<ul> <li>currently only email</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "password",
            "description": "<ul> <li>plain text password, will be compared to store hash</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "audience",
            "description": "<ul> <li>metadata to be returned, as well embedded into JWT token</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": true,
            "field": "remoteip",
            "description": "<ul> <li>security logging feature, not used</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": true,
            "field": "isDisposablePassword",
            "defaultValue": "false",
            "description": "<ul> <li>use disposable password for verification</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": true,
            "field": "isSSO",
            "defaultValue": "false",
            "description": "<ul> <li>verification was already performed by single sign on (ie, facebook)</li> </ul>"
          }
        ]
      }
    },
    "filename": "../src/actions/login.js",
    "groupTitle": "Users"
  },
  {
    "type": "amqp",
    "url": "<prefix>.logout",
    "title": "Logout",
    "version": "1.0.0",
    "name": "LogoutUser",
    "group": "Users",
    "description": "<p>Invalidates JWT token, must be verified based on audience.</p>",
    "parameter": {
      "fields": {
        "Payload": [
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "jwt",
            "description": "<ul> <li>signed JWT token</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "audience",
            "description": "<ul> <li>verifies that JWT is for this audience</li> </ul>"
          }
        ]
      }
    },
    "filename": "../src/actions/logout.js",
    "groupTitle": "Users"
  },
  {
    "type": "http.get|amqp",
    "url": "<prefix>/_/me",
    "title": "Return decoded data from JWT",
    "version": "1.0.0",
    "name": "Me",
    "group": "Users",
    "permission": [
      {
        "name": "user"
      }
    ],
    "description": "<p>Verifies JWT and returns user's default metadata</p>",
    "header": {
      "fields": {
        "Authorization": [
          {
            "group": "Authorization",
            "type": "String",
            "optional": false,
            "field": "Authorization",
            "description": "<p>JWT :accessToken</p>"
          }
        ]
      },
      "examples": [
        {
          "title": "Authorization-Example:",
          "content": "\"Authorization: JWT my.reallyniceandvalid.jsonwebtoken\"",
          "type": "json"
        }
      ]
    },
    "filename": "../src/actions/_/me.js",
    "groupTitle": "Users"
  },
  {
    "type": "amqp",
    "url": "<prefix>.oauth.detach",
    "title": "Detach SSO provider from profile",
    "version": "1.0.0",
    "name": "OauthDetach",
    "group": "Users",
    "description": "<p>Detach a given SSO account from user profile</p>",
    "parameter": {
      "fields": {
        "Payload": [
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "provider",
            "description": ""
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "username",
            "description": "<ul> <li>user's username</li> </ul>"
          }
        ]
      }
    },
    "filename": "../src/actions/oauth/detach.js",
    "groupTitle": "Users"
  },
  {
    "type": "amqp",
    "url": "<prefix>.oauth.upgrade",
    "title": "Upgardes existing SSO token to service-verified token",
    "version": "1.0.0",
    "name": "OauthUpgrade",
    "group": "Users",
    "description": "<p>Upgrades existing SSO token of a supportted provider to service-verified token erroring out if account associated with this token is already linked to an account in the system</p>",
    "parameter": {
      "fields": {
        "Payload": [
          {
            "group": "Payload",
            "type": "String",
            "allowedValues": [
              "\"facebook\""
            ],
            "optional": false,
            "field": "provider",
            "description": ""
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "token",
            "description": "<ul> <li>sso token</li> </ul>"
          }
        ]
      }
    },
    "filename": "../src/actions/oauth/upgrade.js",
    "groupTitle": "Users"
  },
  {
    "type": "amqp",
    "url": "<prefix>.requestPassword",
    "title": "Reset Password",
    "version": "1.0.0",
    "name": "PasswordReset",
    "group": "Users",
    "description": "<p>Allows one either to request new password instantly, or generate a challenge. In the first case would send new password to email instantly and will change it in the system. Use-case is discouraged, because it can be used to DOS account (throttling not implemented). Second case sends reset token to email and it can be used in <code>updatePassword</code> endpoint alongside new password to generate it</p>",
    "parameter": {
      "fields": {
        "Parameter": [
          {
            "group": "Parameter",
            "type": "String",
            "size": "3..50",
            "optional": false,
            "field": "username",
            "description": "<p>User <code>id</code> or <code>alias</code></p>"
          },
          {
            "group": "Parameter",
            "type": "Ipv4",
            "optional": true,
            "field": "remoteip",
            "description": "<p>IP address of the requester</p>"
          },
          {
            "group": "Parameter",
            "type": "Boolean",
            "optional": true,
            "field": "generateNewPassword",
            "defaultValue": "false",
            "description": "<p>Send password immediately</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "allowedValues": [
              "\"email\"",
              "\"phone\""
            ],
            "optional": true,
            "field": "challengeType",
            "defaultValue": "email",
            "description": "<p>Challenge type</p>"
          }
        ]
      }
    },
    "filename": "../src/actions/requestPassword.js",
    "groupTitle": "Users"
  },
  {
    "type": "amqp",
    "url": "<prefix>.referral",
    "title": "Store referral",
    "version": "1.0.0",
    "name": "Referral",
    "group": "Users",
    "description": "<p>Stores referral for a specific identifier for use in the future with registration</p>",
    "parameter": {
      "fields": {
        "Payload": [
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "id",
            "description": "<ul> <li>hash of the browser, for instance</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "referral",
            "description": "<ul> <li>who claims the referral after registration</li> </ul>"
          }
        ]
      }
    },
    "filename": "../src/actions/referral.js",
    "groupTitle": "Users"
  },
  {
    "type": "amqp",
    "url": "<prefix>.regenerate-codes",
    "title": "Regenerate recovery codes",
    "version": "1.0.0",
    "name": "RegenerateCodes",
    "group": "Users",
    "description": "<p>Allows regenerate recovery codes.</p>",
    "header": {
      "fields": {
        "Authorization": [
          {
            "group": "Authorization",
            "type": "String",
            "optional": false,
            "field": "Authorization",
            "description": "<p>JWT :accessToken</p>"
          },
          {
            "group": "Authorization",
            "type": "String",
            "optional": false,
            "field": "X-Auth-TOTP",
            "description": "<p>TOTP or recoveryCode</p>"
          }
        ]
      },
      "examples": [
        {
          "title": "Authorization-Example:",
          "content": "\"Authorization: JWT my.reallyniceandvalid.jsonwebtoken\"",
          "type": "json"
        },
        {
          "title": "X-Auth-TOTP-Example:",
          "content": "\"X-Auth-TOTP: 123456\"",
          "type": "json"
        }
      ]
    },
    "parameter": {
      "fields": {
        "Payload": [
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "username",
            "description": "<ul> <li>id of the user</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "Number",
            "optional": true,
            "field": "totp",
            "description": "<ul> <li>time-based one time password or recoveryCode</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": true,
            "field": "remoteip",
            "description": "<ul> <li>security logging feature, not used</li> </ul>"
          }
        ]
      }
    },
    "filename": "../src/actions/mfa/regenerate-codes.js",
    "groupTitle": "Users"
  },
  {
    "type": "amqp",
    "url": "<prefix>.regenerate-token",
    "title": "Regenerate expired token",
    "version": "1.0.0",
    "name": "RegenerateToken",
    "group": "Users",
    "description": "<p>This method allowes to regenerate expired token. It takes <code>uid</code> or <code>id</code> and <code>action</code> as token identificator. Currently only phone challenge supported.</p>",
    "parameter": {
      "fields": {
        "Parameter": [
          {
            "group": "Parameter",
            "type": "String",
            "optional": true,
            "field": "uid",
            "description": "<p>Token unique identificator</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "allowedValues": [
              "\"activate\"",
              "\"invite\"",
              "\"reset\""
            ],
            "optional": true,
            "field": "action",
            "description": "<p>User action</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": true,
            "field": "id",
            "description": "<p>User identificator</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "allowedValues": [
              "\"email\"",
              "\"phone\""
            ],
            "optional": true,
            "field": "challengeType",
            "defaultValue": "email",
            "description": "<p>Challenge type</p>"
          }
        ]
      }
    },
    "filename": "../src/actions/regenerate-token.js",
    "groupTitle": "Users"
  },
  {
    "type": "amqp",
    "url": "<prefix>.register",
    "title": "Create User",
    "version": "1.0.0",
    "name": "RegisterUser",
    "group": "Users",
    "description": "<p>Provides ability to register users, with optional throttling, captcha checks &amp; email verification. Based on provided arguments either returns &quot;OK&quot; indicating that user needs to complete challenge or JWT token &amp; user object</p>",
    "parameter": {
      "fields": {
        "Payload": [
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "username",
            "description": "<ul> <li>currently only email is supported</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "audience",
            "description": "<ul> <li>will be used to write metadata to</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "size": "3..15",
            "optional": true,
            "field": "alias",
            "description": "<ul> <li>alias for username, user will be marked as public. Can only be used when <code>activate</code> is <code>true</code></li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": true,
            "field": "password",
            "description": "<ul> <li>will be hashed and stored if provided, otherwise generated and sent via email</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "Object",
            "optional": true,
            "field": "captcha",
            "description": "<ul> <li>google recaptcha container</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": true,
            "field": "captcha.response",
            "description": "<ul> <li>token passed from client to verify at google</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": true,
            "field": "captcha.remoteip",
            "description": "<ul> <li>ip for security check at google</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": true,
            "field": "captcha.secret",
            "description": "<ul> <li>shared secret between us and google</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "Object",
            "optional": true,
            "field": "metadata",
            "description": "<ul> <li>metadata to be saved into <code>audience</code> upon completing registration</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "Boolean",
            "optional": true,
            "field": "activate",
            "defaultValue": "true",
            "description": "<ul> <li>whether to activate the user instantly or not</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": true,
            "field": "ipaddress",
            "description": "<ul> <li>used for security logging</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "Boolean",
            "optional": true,
            "field": "skipChallenge",
            "defaultValue": "false",
            "description": "<ul> <li>if <code>activate</code> is <code>false</code> disables sending challenge</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "Boolean",
            "optional": true,
            "field": "skipPassword",
            "defaultValue": "false",
            "description": "<ul> <li>disable setting password</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": true,
            "field": "challengeType",
            "defaultValue": "email",
            "description": "<ul> <li>challenge type</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": true,
            "field": "referral",
            "description": "<ul> <li>pass id/fingerprint of the client to see if it was stored before and associate with this account</li> </ul>"
          }
        ]
      }
    },
    "filename": "../src/actions/register.js",
    "groupTitle": "Users"
  },
  {
    "type": "amqp",
    "url": "<prefix>.remove",
    "title": "Remove User",
    "version": "1.0.0",
    "name": "RemoveUser",
    "group": "Users",
    "description": "<p>Removes user from system. Be careful as this operation is not revertible.</p>",
    "parameter": {
      "fields": {
        "Payload": [
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "username",
            "description": "<ul> <li>user's email or id</li> </ul>"
          }
        ]
      }
    },
    "filename": "../src/actions/remove.js",
    "groupTitle": "Users"
  },
  {
    "type": "amqp",
    "url": "<prefix>.updateMetadata",
    "title": "Update Metadata",
    "version": "1.0.0",
    "name": "UpdateMetadata",
    "group": "Users",
    "description": "<p>Interface to update metadata with various features like <code>replace</code>, <code>increment</code>, <code>remove</code> or <code>script</code> for custom actions. Supports batch updates for multiple audiences</p>",
    "parameter": {
      "fields": {
        "Payload": [
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "username",
            "description": "<ul> <li>currently only email is supported</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String[]",
            "optional": false,
            "field": "audience",
            "description": "<ul> <li>audience(s) to be updated, must match length of metadata key. If string, metadata must be object</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "Object[]",
            "optional": true,
            "field": "metadata",
            "description": "<ul> <li>operations to be performed on corresponding audience, supports <code>$set key:value</code>, <code>$remove keys[]</code>, <code>$incr key:diff</code></li> </ul>"
          },
          {
            "group": "Payload",
            "type": "Object",
            "optional": true,
            "field": "script",
            "description": "<ul> <li>if present will be called with passed metadata keys &amp; username, provides direct scripting access. Be careful with granting access to this function.</li> </ul>"
          }
        ]
      }
    },
    "filename": "../src/actions/updateMetadata.js",
    "groupTitle": "Users"
  },
  {
    "type": "amqp",
    "url": "<prefix>.updatePassword",
    "title": "Update Password",
    "version": "1.0.0",
    "name": "UpdatePassword",
    "group": "Users",
    "description": "<p>Allows one to update password via current password + username combo or via verification token. Optionally allows to invalidate all issued JWT token for a given user. Valid input includes combos of <code>username</code>, <code>currentPassword</code> OR <code>resetToken</code>.</p>",
    "parameter": {
      "fields": {
        "Payload": [
          {
            "group": "Payload",
            "type": "String",
            "optional": true,
            "field": "username",
            "description": "<ul> <li>currently only email is supported</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": true,
            "field": "currentPassword",
            "description": "<ul> <li>current password</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": true,
            "field": "resetToken",
            "description": "<ul> <li>must be present if <code>username</code> or <code>currentPassword</code> is not</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "newPassword",
            "description": "<ul> <li>password will be changed to this</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "Boolean",
            "optional": true,
            "field": "invalidateTokens",
            "defaultValue": "false",
            "description": "<ul> <li>if set to <code>true</code> will invalidate issued tokens</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": true,
            "field": "remoteip",
            "description": "<ul> <li>will be used for rate limiting if supplied</li> </ul>"
          }
        ]
      }
    },
    "filename": "../src/actions/updatePassword.js",
    "groupTitle": "Users"
  },
  {
    "type": "amqp",
    "url": "<prefix>.verify",
    "title": "Verify TOTP",
    "version": "1.0.0",
    "name": "Verify",
    "group": "Users",
    "description": "<p>Allows to verify if TOTP provided by the user is valid.</p>",
    "header": {
      "fields": {
        "Authorization": [
          {
            "group": "Authorization",
            "type": "String",
            "optional": false,
            "field": "Authorization",
            "description": "<p>JWT :accessToken</p>"
          }
        ]
      },
      "examples": [
        {
          "title": "Authorization-Example:",
          "content": "\"Authorization: JWT my.reallyniceandvalid.jsonwebtoken\"",
          "type": "json"
        }
      ]
    },
    "parameter": {
      "fields": {
        "Payload": [
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "username",
            "description": "<ul> <li>id of the user</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "Number",
            "optional": false,
            "field": "totp",
            "description": "<ul> <li>6 chars time-based one time password or 8 characters hex recovery code</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": true,
            "field": "remoteip",
            "description": "<ul> <li>security logging feature, not used</li> </ul>"
          }
        ]
      }
    },
    "filename": "../src/actions/mfa/verify.js",
    "groupTitle": "Users"
  },
  {
    "type": "amqp",
    "url": "<prefix>.getInternalData",
    "title": "Retrieve Internal Data",
    "version": "1.0.0",
    "name": "getInternalData",
    "group": "Users",
    "description": "<p>Could be used to retrieve optionally filtered internal data, including password hashes, aliases, time user was registered and so on. This should be used by internal microservices. Direct access to this method must not be granted to the users</p>",
    "parameter": {
      "fields": {
        "Payload": [
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "username",
            "description": "<ul> <li>user's username</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String[]",
            "optional": true,
            "field": "fields",
            "description": "<ul> <li>return only these fields of user's internal data</li> </ul>"
          }
        ]
      }
    },
    "filename": "../src/actions/getInternalData.js",
    "groupTitle": "Users"
  },
  {
    "type": "amqp",
    "url": "<prefix>.getMetadata",
    "title": "Retrieve Public Data",
    "version": "1.0.0",
    "name": "getMetadata",
    "group": "Users",
    "description": "<p>This should be used to retrieve user's publicly available data. It contains 2 modes: data that is available when the user requests data about him or herself and when someone else tries to get data about a given user on the system. For instance, if you want to view someone's public profile</p>",
    "parameter": {
      "fields": {
        "Payload": [
          {
            "group": "Payload",
            "type": "String[]",
            "optional": false,
            "field": "username",
            "description": "<ul> <li>user's username, can be <code>alias</code> or real <code>username</code>. If it's a real username - then all the data is returned. Can be either String of Array of Strings</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String[]",
            "optional": false,
            "field": "audience",
            "description": "<ul> <li>which namespace of metadata should be used, can be string or array of strings</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "Object",
            "optional": false,
            "field": "fields",
            "description": "<ul> <li>must contain an object of <code>[audience]: String[]</code> mapping</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String[]",
            "optional": false,
            "field": "fields.",
            "description": "<ul> <li> <ul> <li>fields to return from a passed audience</li> </ul> </li> </ul>"
          }
        ]
      }
    },
    "filename": "../src/actions/getMetadata.js",
    "groupTitle": "Users"
  },
  {
    "type": "amqp",
    "url": "<prefix>.invite",
    "title": "Generate User Invitation",
    "version": "1.0.0",
    "name": "inviteuser",
    "group": "Users",
    "description": "<p>Send an email with special registration link, which embeds a token. When supplied during registration process it will allow user to not verify him or herself, as well as add extra metadata to their profile when registration is complete. Can only be used once and could have an expiration date.</p>",
    "parameter": {
      "fields": {
        "Payload": [
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "email",
            "description": "<ul> <li>used to send the invitation</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "Object",
            "optional": true,
            "field": "ctx",
            "description": "<ul> <li>context to be passed into email</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "Number",
            "optional": true,
            "field": "throttle",
            "description": "<ul> <li>if set, rejects to send another invite to the same email during that time</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "Number",
            "optional": true,
            "field": "ttl",
            "description": "<ul> <li>if set, invitation will expire in that time</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "Object",
            "optional": true,
            "field": "nodemailer",
            "description": "<ul> <li>if set, would be passed to nodemailer options</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "Object",
            "optional": true,
            "field": "metadata",
            "description": "<ul> <li>metadata to be added to the user upon registration</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "Object",
            "optional": true,
            "field": "metadata.",
            "description": "<p>*] - <code>*</code> is a namespace for which metadata would be added</p>"
          }
        ]
      }
    },
    "filename": "../src/actions/invite.js",
    "groupTitle": "Users"
  },
  {
    "type": "amqp",
    "url": "<prefix>.invite-remove",
    "title": "Generate User Invitation",
    "version": "1.0.0",
    "name": "removeinvite",
    "group": "Users",
    "description": "<p>Removes existing invitation by it's id. Make sure that only admin can access this route</p>",
    "parameter": {
      "fields": {
        "Payload": [
          {
            "group": "Payload",
            "type": "Object",
            "optional": false,
            "field": "id",
            "description": "<ul> <li>id of the invitation</li> </ul>"
          }
        ]
      }
    },
    "filename": "../src/actions/invite-remove.js",
    "groupTitle": "Users"
  },
  {
    "type": "amqp",
    "url": "<prefix>.verify",
    "title": "JWT verification",
    "version": "1.0.0",
    "name": "verifyJWT",
    "group": "Users",
    "description": "<p>Verifies passed JWT and returns deserialized user object. Must be used for session management</p>",
    "parameter": {
      "fields": {
        "Payload": [
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "token",
            "description": "<ul> <li>signed JWT token</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "String[]",
            "optional": false,
            "field": "audience",
            "description": "<ul> <li>which namespaces of metadata to return</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "Boolean",
            "optional": true,
            "field": "peek",
            "defaultValue": "false",
            "description": "<ul> <li>whether to update last access or not</li> </ul>"
          },
          {
            "group": "Payload",
            "type": "Boolean",
            "optional": true,
            "field": "accessToken",
            "defaultValue": "false",
            "description": "<ul> <li>uses internal token verification if set to true</li> </ul>"
          }
        ]
      }
    },
    "filename": "../src/actions/verify.js",
    "groupTitle": "Users"
  },
  {
    "type": "amqp",
    "url": "<prefix>.isReferral",
    "title": "Checks if username is a referral",
    "version": "1.0.0",
    "name": "verifyReferral",
    "group": "Users",
    "description": "<p>Verifies if <username> is a referral of <referralCode>. If username is a referral - returns true id, otherwise false</p>",
    "parameter": {
      "fields": {
        "Payload": [
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "username",
            "description": ""
          },
          {
            "group": "Payload",
            "type": "String",
            "optional": false,
            "field": "referralCode",
            "description": ""
          }
        ]
      }
    },
    "filename": "../src/actions/isReferral.js",
    "groupTitle": "Users"
  }
] });
