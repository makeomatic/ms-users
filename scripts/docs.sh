#!/bin/bash

set -ex

# prepare docs
current_branch=`git rev-parse --abbrev-ref HEAD`
branch_name="docs/$SEMAPHORE_JOB_ID"
git checkout -b $branch_name
pnpm exec -- apidoc -i ./src/actions -v --debug -o ./docs
git config user.email "semaphore@makeomatic.co"
git config user.name "semaphore"
touch ./docs/.nojekyll
git add -f ./docs
git status
git commit -m "chore(docs-$SEMAPHORE_JOB_ID): updated remote public documentation"
url=`node -e "console.log(require('./package.json').repository.url)"`
origin=`echo $url | awk -F '//' '{print $1"//"ENVIRON["GITHUB_TOKEN"]"@"$2 }'`
git push $origin `git subtree split --prefix docs $branch_name`:gh-pages --force
git checkout $current_branch
