SHELL := /bin/bash
NODE_VERSIONS := 5.0.0 4.12 0.10

test: $(NODE_VERSIONS)

$(NODE_VERSIONS):
	docker run --link=rabbitmq -v ${PWD}:/usr/src/app -w /usr/src/app --rm -e TEST_ENV=docker node:$@ npm test

.PHONY: test