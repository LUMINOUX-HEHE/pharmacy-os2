SHELL := /bin/sh

.PHONY: dev build migrate seed test logs lint

dev:
	docker compose up --build

build:
	npm run build

migrate:
	npm --workspace @pharmacy-os/api run migrate

seed:
	npm --workspace @pharmacy-os/api run seed

test:
	npm test

lint:
	npm run lint

logs:
	docker compose logs -f api
