# Documento di Progetto: CARONTE (Data Ingestion Gateway)
**Versione:** 2.0 (Architettura Disaccoppiata API-First)  
**Contesto:** Progetto Logistico 2.0 (Migrazione Oracle → Databricks)  
**Ambiente Target:** Windows Server (On-Premise) / Linux (Opzionale)  

---

## 1. Executive Summary
**Caronte** è un motore di estrazione dati custom, API-centrico e stand-alone. Il suo scopo è estrarre dati da database Oracle distribuiti (WMS Logistix e Exadata), convertirli in volo in formato Parquet e inviarli alla Landing Zone su Azure Blob Storage. L'applicativo adotta un'architettura disaccoppiata: un backend robusto in Python (FastAPI) che espone le API di orchestrazione, e un frontend Single Page Application (SPA) in React che rispetta rigorosamente le linee guida UI/UX aziendali ("Levity Standard").

## 2. Architettura di Sistema
Caronte è diviso in tre layer principali:
1.  **Core Engine & Orchestration (Backend Python):** Motore di estrazione pura. Interroga i DB via JDBC, unisce il parametro `SITO_ID`, converte i `DataFrame` in Parquet e fa l'upload. Gestisce la schedulazione autonoma tramite `APScheduler`.
2.  **API & State (Backend Python):** Database `SQLite` per configurazioni, watermark e log. Le funzionalità sono esposte tramite REST API via `FastAPI`. 
3.  **Frontend (React SPA):** Interfaccia utente costruita secondo il "Levity Standard" che comunica esclusivamente tramite le API REST del backend.

## 3. Stack Tecnologico
**Backend (Python 3.10+):**
* **Framework API:** `fastapi`, `uvicorn`.
* **Database & ORM:** `sqlite3`, `sqlalchemy`.
* **Dati & Connettori:** `oracledb` (Thin mode), `pandas`, `pyarrow`, `azure-storage-blob`.
* **Schedulazione:** `apscheduler`.

**Frontend (Levity Standard):**
* **Core:** `React 19` (build con `Vite`).
* **Styling:** `Tailwind CSS v4`, `clsx`, `tailwind-merge`.
* **Stato & Fetching:** `Zustand` (con persist), Fetch API nativa (`window.fetch`) con interceptor globale.
* **Componenti UI:** `lucide-react` (icone), `ag-grid-react` (tabelle log e configurazioni).

## 4. Modello Dati (SQLite - `caronte_state.db`)
* `connections`: ID, Nome, Tipo (Logistix/Exadata), Host, Port, Service/SID, User, Pwd, `SITO_ID`.
* `jobs`: ID, Tabella Sorgente, Destination Blob, Tipo (Full/Delta), Col Watermark, Query Base, Schedulazione (Cron).
* `watermarks`: Job_ID, Connection_ID, Ultimo_Valore_Estratto.
* `execution_logs`: Log_ID, Job_ID, Data Inizio, Data Fine, Righe Estratte, Esito, Messaggio Errore.

## 5. Frontend & UI/UX (Linee Guida Levity)
Il frontend deve aderire al documento `levity_standardization_guidelines.md`.
* **Tema:** Dark mode nativa (`bg-[#09090b]`, sidebar `bg-[#18181b]`), accenti in colore Teal (`teal-500`).
* **Struttura Cartelle:** Domain-driven (`/components`, `/features`, `/store`, `/hooks`).
* **View Principali:** 1. `DashboardFeature`: Metriche di estrazione e alert.
  2. `ConnectionsFeature`: CRUD dei nodi Oracle.
  3. `JobsFeature`: CRUD dei job di estrazione e pulsante "Run Now" (Trigger API).
  4. `LogsFeature`: Tabella (ag-grid) con i log di sistema.
* **Integrazione API:** Override di `window.fetch` in `App.jsx` per centralizzare le chiamate verso FastAPI.

## 6. Strategia di Deployment (Windows Server / Singolo Servizio)
Per semplificare il rilascio su server aziendali Windows senza container:
1.  **Build Frontend:** Esecuzione di `npm run build` nella cartella frontend. I file statici generati verranno spostati in una cartella `backend/static`.
2.  **Serving Integrato:** `FastAPI` (oltre a servire le route `/api/*`) verrà configurato per servire i file statici di React sulla route `/`.
3.  **Servizio Windows:** Tramite **NSSM**, verrà creato un singolo servizio Windows (`Caronte_Gateway`) che lancia `uvicorn main:app`. Questo garantisce l'avvio automatico e la resilienza senza richiedere IIS o Nginx.