FROM python:3.11-slim

LABEL org.opencontainers.image.title="k9x_continuum" \
      org.opencontainers.image.description="K9-AIF Enterprise Continuum Catalog" \
      org.opencontainers.image.vendor="k9x.ai" \
      org.opencontainers.image.url="https://k9x.ai"

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
COPY webui/   ./webui/

EXPOSE 8085

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8085"]
