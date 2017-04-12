#!/bin/bash

set -ex

# prepare docs
npm run doc
git config user.email "semaphore@makeomatic.co"
git config user.name "semaphore"
touch ./docs/.nojekyll
git add -f ./docs
git commit -m "docs($SEMAPHORE_BUILD_NUMBER): updated remote public documentation"
git push origin `git subtree split --prefix docs master`:gh-pages --force

# build docker
npm run docker-release
