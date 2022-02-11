#!/bin/bash

set -ex

# prepare docs
current_branch=`git rev-parse --abbrev-ref HEAD`
branch_name="docs/$SEMAPHORE_JOB_ID"
git checkout -b $branch_name
cd ./schemas
apidoc -i ../src/actions -v --debug -o ../docs
cd ..
git config user.email "semaphore@makeomatic.co"
git config user.name "semaphore"
touch ./docs/.nojekyll
git add -f ./docs
git status
git commit -m "chore(docs-$SEMAPHORE_JOB_ID): updated remote public documentation"
git push origin `git subtree split --prefix docs $branch_name`:gh-pages --force
git checkout $current_branch
