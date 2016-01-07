#!/bin/bash

docker login -e $DOCKER_EMAIL -p $DOCKER_PWD -u $DOCKER_USER || exit 1
BUILD_ENV=${ENVS:-production development}

make ENVS="$BUILD_ENV" build
make ENVS="$BUILD_ENV" push
