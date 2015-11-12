# Microservice for handling users over AMQP transport layer

## Overview

## Roadmap

1. Add extra features to registration:
 - [ ] limit registrations per ip per time span
 - [ ] reject known disposable email addresses
 - [ ] add text message validation
 - [ ] add ability to change username
2. Abstract storage options:
 - [ ] create abstract storage class
 - [ ] move interactions with redis to an abstract class
 - [ ] write docs about adding more storage options
3. Test coverage
4. Extra features for challenge:
 - [ ] be able to set metadata on request
 - [ ] record ip address for such a request
 - [ ] extra types of validation
5. Update Metadata:
 - [ ] Add/remove batch operations
 - [ ] support operations on multiple audiences
