PORT ?= 3000
IMAGE ?= casplo2gpx-web
CONTAINER ?= casplo2gpx-web

.PHONY: help install serve lint format test build check clean docker-build docker-run docker-test docker-shell docker-stop docker-clean

help:
	@printf "Target disponibili:\n"
	@printf "  make install       Installa dipendenze npm\n"
	@printf "  make serve         Avvia sviluppo locale su http://localhost:%s\n" "$(PORT)"
	@printf "  make lint          Esegue ESLint\n"
	@printf "  make format        Formatta JS, CSS e HTML\n"
	@printf "  make test          Esegue Jest\n"
	@printf "  make build         Genera dist/bundle.js\n"
	@printf "  make check         Esegue lint, test e build\n"
	@printf "  make clean         Rimuove dist\n"
	@printf "  make docker-build  Costruisce immagine Docker\n"
	@printf "  make docker-run    Avvia app Docker su http://localhost:%s\n" "$(PORT)"
	@printf "  make docker-test   Esegue test dentro Docker\n"
	@printf "  make docker-shell  Apre shell dentro Docker\n"
	@printf "  make docker-stop   Ferma il container nominato\n"
	@printf "  make docker-clean  Rimuove immagine Docker\n"

install:
	npm install --package-lock=false

serve:
	npx serve . -l $(PORT)

lint:
	npm run lint

format:
	npm run format

test:
	npm test

build:
	npm run build

check: lint test build

clean:
	rm -rf dist

docker-build:
	docker build -t $(IMAGE) .

docker-run:
	docker run --rm -it --name $(CONTAINER) -p $(PORT):3000 $(IMAGE)

docker-test:
	docker run --rm $(IMAGE) npm test

docker-shell:
	docker run --rm -it --entrypoint sh $(IMAGE)

docker-stop:
	-docker stop $(CONTAINER)

docker-clean:
	docker rmi $(IMAGE)
