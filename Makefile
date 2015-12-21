SHELL := /bin/bash
THIS_FILE := $(lastword $(MAKEFILE_LIST))
PKG_NAME := $(shell cat package.json | ./node_modules/.bin/json name)
PKG_VERSION := $(shell cat package.json | ./node_modules/.bin/json version)
NPM_PROXY := http://$(shell docker-machine ip dev):4873
DOCKER_USER := makeomatic
DIST := $(DOCKER_USER)/$(PKG_NAME)
NODE_VERSIONS := 5.3.0
ENVS := development production
TASK_LIST := $(foreach env,$(ENVS),$(addsuffix .$(env), $(NODE_VERSIONS)))
WORKDIR := /src
COMPOSE_FILE := test/docker-compose.yml

test: mocha

%.mocha: IMAGE=$(DOCKER_USER)/alpine-node:$(NODE_VERSION)
%.mocha: COMPOSE = DIR=$(WORKDIR) IMAGE=$(IMAGE) docker-compose -f $(COMPOSE_FILE)
%.production.mocha:
	$(COMPOSE) run -e SKIP_REBUILD=${SKIP_REBUILD} --rm tester npm test
%.mocha: ;

%.build: ARGS = --build-arg NODE_ENV=$(NODE_ENV) --build-arg NPM_PROXY=$(NPM_PROXY)
%.build:
	NODE_VERSION=$(NODE_VERSION) envsubst < "./Dockerfile" > $(DOCKERFILE)
	docker build $(ARGS) -t $(PKG_PREFIX_ENV) -f $(DOCKERFILE) .
	rm $(DOCKERFILE)

%.production.build:
	docker tag -f $(PKG_PREFIX_ENV) $(PKG_PREFIX)
	docker tag -f $(PKG_PREFIX_ENV) $(PKG_PREFIX)-$(PKG_VERSION)

%.development.pull:
	docker pull $(PKG_PREFIX_ENV)

%.pull:
	docker pull $(PKG_PREFIX)
	docker pull $(PKG_PREFIX)-$(PKG_VERSION)

%.push:
	docker push $(PKG_PREFIX_ENV)

%.production.push:
	docker push $(PKG_PREFIX)
	docker push $(PKG_PREFIX)-$(PKG_VERSION)

all: test build push

%: NODE_VERSION = $(basename $(basename $@))
%: NODE_ENV = $(subst .,,$(suffix $(basename $@)))
%: DOCKERFILE = "./Dockerfile.$(NODE_VERSION)"
%: PKG_PREFIX = $(DIST):$(NODE_VERSION)
%: PKG_PREFIX_ENV = $(PKG_PREFIX)-$(NODE_ENV)
%::
	@echo $@  # print target name
	$(MAKE) -f $(THIS_FILE) $(addsuffix .$@, $(TASK_LIST))

.PHONY: all %.mocha %.build %.push %.pull
