FROM python:3.11-slim

LABEL org.opencontainers.image.title="k9x_continuum" \
      org.opencontainers.image.description="K9-AIF Enterprise Continuum Catalog" \
      org.opencontainers.image.vendor="k9x.ai" \
      org.opencontainers.image.url="https://k9x.ai"

WORKDIR /app

# git: server-side verification fetches the submitted commit (Continuum 1.2.0)
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
COPY webui/   ./webui/

EXPOSE 8085

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8085"]
