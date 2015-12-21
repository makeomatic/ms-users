SHELL := /bin/bash
THIS_FILE := $(lastword $(MAKEFILE_LIST))
PKG_NAME := $(shell cat package.json | ./node_modules/.bin/json name)
PKG_VERSION := $(shell cat package.json | ./node_modules/.bin/json version)
NPM_PROXY := http://$(shell docker-machine ip dev):4873
DIST := makeomatic/$(PKG_NAME)
NODE_VERSIONS := 5.3.0
ENVS := .development .production
TASK_LIST := $(foreach env,$(ENVS),$(addsuffix $(env), $(NODE_VERSIONS)))
LINK := --link=rabbitmq --link=redis_1 --link=redis_2 --link=redis_3

run-test:
	docker run $(LINK) -v ${PWD}:/usr/src/app -w /usr/src/app --rm -e TEST_ENV=docker makeomatic/node-test:5.1.0 npm test;

%.test: DIR = /src
%.test: COMPOSE = docker-compose -f test/docker-compose.yml
%.test:
	$(COMPOSE) up -d; \
	docker run $(LINK) -v ${PWD}:$(DIR) -w $(DIR) --rm -e TEST_ENV=docker $(PKG_PREFIX_ENV) npm test; \
	EXIT_CODE=$$?; \
	$(COMPOSE) rm -f; \
	exit ${EXIT_CODE};

%.build: ARGS = --build-arg NODE_ENV=$(NODE_ENV) --build-arg NPM_PROXY=$(NPM_PROXY)
%.build:
	NODE_VERSION=$(NODE_VERSION) envsubst < "./Dockerfile" > $(DOCKERFILE)
	docker build $(ARGS) -t $(PKG_PREFIX_ENV) -f $(DOCKERFILE) .
	rm $(DOCKERFILE)

%.production.build:
	docker tag -f $(PKG_PREFIX_ENV) $(PKG_PREFIX)
	docker tag -f $(PKG_PREFIX_ENV) $(PKG_PREFIX)-$(PKG_VERSION)

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

.PHONY: all %.test %.build %.push
