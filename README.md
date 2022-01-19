# Microservice for handling users over AMQP transport layer

[![npm version](https://badge.fury.io/js/ms-users.svg)](https://badge.fury.io/js/ms-users)
[![Build Status](https://semaphoreci.com/api/v1/projects/27a0c3e3-ba64-49e1-a1be-7655eae716b9/632945/shields_badge.svg)](https://semaphoreci.com/makeomatic/ms-users)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg?style=flat-square)](https://github.com/semantic-release/semantic-release)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
[![codecov.io](https://codecov.io/github/makeomatic/ms-users/coverage.svg?branch=master)](https://codecov.io/github/makeomatic/ms-users?branch=master)
[![Code Climate](https://codeclimate.com/github/makeomatic/ms-users/badges/gpa.svg)](https://codeclimate.com/github/makeomatic/ms-users)

## Installation

`npm i ms-users -S`

## Overview

Starts horizontally scalable nodejs worker communicating over amqp layer with redis cluster backend.
Supports a broad range of operations for working with users. Please refer to the configuration options for now,
that contains description of routes and their capabilities. Aims to provide a complete extendable solution to user's management.

## Configuration

TODO

## Endpoint description

Currently available on github pages

## Docker images

Built docker images are available: https://hub.docker.com/r/makeomatic/ms-users/

## Run Perf Tests
```shell
perf record -F 99 -e cycles:u -g -- node --perf-basic-prof-only-functions /app/node_modules/.bin/mfleet
# or
perf record -F 99 -e cycles:u -g -- node --perf-basic-prof /app/node_modules/.bin/mfleet

perf script --header > perfs.out
sed -i \
  -e "/( __libc_start| LazyCompile | v8::internal::| Builtin:| Stub:| LoadIC:|\[unknown\]| LoadPolymorphicIC:)/d" \
  -e 's/ LazyCompile:[*~]\?/ /' \
  perfs.out
perf report > perfs.txt
```
