# ACL

## Current state

At this point it's imperative to have some sort of identity-aware-proxy (IAP) in front of this
microservice to manage permissions - because most of the actions that currently exist have no concept
of verifying the access levels of a requesting service. Users must create their own auth layers and
that is associated with high effort levels

## Goal

To be able to granularly control access levels of any internal or external request from any service or
and end client.

## EP-1

Create IAM (identity management) service which performs several functions:

### ID <-> role / permissions management

Provides basic set of permissions to configure other users/services:

* `iam:permissions:admin` - can do everything
* `iam:permissions:read` - allows one to list existing permissions
* `iam:permissions:create` - allows one to create a new permission
* `iam:permissions:delete` - allows one to remove an existing permission
* `iam:permissions:users:admin` - allows one to list/read/add/remove/update users
* `iam:permissions:users:read` - allows one to read permissions for a given user
* `iam:permissions:users:add` - allows to add new user, excluding `iam:**:admin`
* `iam:permissions:users:update` - remove some permissions from the user, excluding editing `iam:**:admin`
* `iam:permissions:users:delete` - remove user completely, excluding users with `iam:**:admin`
* `iam:roles:admin` - be able to create/update/remove roles, NOTE: maybe we need more granular approach

### IAP (identity-aware-proxy)

Sample implementation:

* https://cloud.google.com/iap/docs/signed-headers-howto

Provides `man-in-the-middle` layer, which verifies JWT tokens, expands that token
to a set of roles/attributes and populates headers:

* `x-mf-iap-jwt-assertion`
* `x-mf-authenticated-user-id`
* `x-mf-authenticated-user-email`

Once the header is verified, these claims are added to headers and request is passed further on.
In case of http/socket.io it works as a reverse-proxy, in case of AMQP it resubmits requests from
one exchange to another.

NOTE: additional thought is required on how to properly separate trusted from untrusted environments
Naive thoughts include:

* multiple RabbitMQ accounts for services:
  * read-only of privileged resources for consumption, publish to IAP
  * IAP account: republish requests to privileged exchanges

### Service self-configuration

Services that live in the "trusted" environment supply their configuration
to existing KV storage (ie consul), in the format of `route: [perm1,perm2,perm3]>`
Each of these permissions will be automatically prefixed with a service name
