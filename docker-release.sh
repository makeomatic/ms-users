#!/bin/bash

set -e

docker login -p $DOCKER_PWD -u $DOCKER_LOGIN || exit 1
BUILD_ENV=${ENVS:-production}

make ENVS="$BUILD_ENV" build push

if [ x"$BRANCH_NAME" == x"master" ] && [ x"$SEMAPHORE" == x"true" ]; then
  npm run doc
  git config user.email "semaphore@makeomatic.co"
  git config user.name "semaphore"
  git commit -m "docs($SEMAPHORE_BUILD_NUMBER): updated remote public documentation"
  git push origin `git subtree split --prefix docs master`:gh-pages --force
fi
