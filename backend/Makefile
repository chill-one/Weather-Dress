SHELL := /bin/sh

VENV ?= .venv
PY   := $(VENV)/bin/python
PIP  := $(VENV)/bin/pip
ENV  ?= dev
FRONTEND_ORIGIN ?= http://localhost:3000

# create the venv if missing
$(VENV)/bin/python:
	python3 -m venv $(VENV)

venv: $(VENV)/bin/python

install: venv
	$(PIP) install -U pip uv
	# try uv (fast); fall back to pip if uv isn't present
	$(VENV)/bin/uv pip install -e ".[dev,ml]" || $(PIP) install -e ".[dev,ml]"

run:
	ENV=$(ENV) FRONTEND_ORIGIN=$(FRONTEND_ORIGIN) \
	$(PY) -m uvicorn app.main:app --reload

test:
	$(PY) -m pytest -q

fmt:
	$(VENV)/bin/black app tests
	$(VENV)/bin/ruff check --fix app tests

lint:
	$(VENV)/bin/ruff check app tests
	$(VENV)/bin/mypy app

clean:
	rm -rf $(VENV) .pytest_cache .ruff_cache .mypy_cache dist build
