#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

yes yes | $DIR/redis-trib.rb create --replicas 0 \
  ${REDIS_1_PORT_6379_TCP_ADDR}:${REDIS_1_PORT_6379_TCP_PORT} \
  ${REDIS_2_PORT_6379_TCP_ADDR}:${REDIS_2_PORT_6379_TCP_PORT} \
  ${REDIS_3_PORT_6379_TCP_ADDR}:${REDIS_3_PORT_6379_TCP_PORT}

exit 0
