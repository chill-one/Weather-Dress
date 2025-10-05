VENV=.venv
PY=$(VENV)/bin/python
PIP=$(VENV)/bin/pip

.PHONY: venv install dev run test fmt lint clean

venv:
	python3 -m venv $(VENV)

install: venv
	$(PIP) install -U uv
	$(VENV)/bin/uv pip install -e ".[dev,ml]"

dev: run
run:
	ENV=dev FRONTEND_ORIGIN=http://localhost:3000 uvicorn app.main:app --reload

test:
	$(VENV)/bin/pytest -q

fmt:
	$(VENV)/bin/black app tests
	$(VENV)/bin/ruff check --fix app tests

lint:
	$(VENV)/bin/ruff check app tests
	$(VENV)/bin/mypy app

clean:
	rm -rf $(VENV) .pytest_cache .ruff_cache .mypy_cache dist build
