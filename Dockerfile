# ==========================================
# STAGE 1: Build del Frontend (Node.js)
# ==========================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copia i file di dipendenze e installa
COPY frontend/package*.json ./
RUN npm install

# Copia il resto del codice frontend ed esegui la build
COPY frontend/ ./
RUN npm run build

# ==========================================
# STAGE 2: Setup del Backend (Python) ed Esecuzione
# ==========================================
FROM python:3.10-slim

WORKDIR /app/backend

# L'oracledb in "Thin mode" non richiede l'Oracle Client nativo (C-libraries), 
# rendendo l'immagine molto più leggera e senza necessità di installare apt-get packages extra.

# Copia le dipendenze Python e installale
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia il codice del backend
COPY backend/ ./

# Copia la build del frontend generata nello STAGE 1 all'interno della cartella /static del backend
COPY --from=frontend-builder /app/frontend/dist ./static

# Esponi la porta su cui gira FastAPI
EXPOSE 8000

# Comando di avvio del Single Service (FastAPI)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
