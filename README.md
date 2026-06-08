# Caronte

![Caronte](https://img.shields.io/badge/Caronte-Data_Ingestion-teal?style=for-the-badge)

Caronte è un hub/gateway centralizzato ad alte prestazioni sviluppato per l'automazione della **data ingestion massiva**. È progettato per orchestrare l'estrazione parallela di dati da sistemi transazionali (es. Oracle) e il trasferimento verso Data Warehouse, Cloud Storage (es. Azure Blob) o server SFTP.

## 🚀 Caratteristiche Principali

- **Architettura Multi-Thread:** Esecuzione parallela dei job di estrazione per saturare la banda senza bloccare il server.
- **Chunked Processing:** Supporto all'estrazione "a blocchi" (es. 50k righe per volta) per un footprint RAM minuscolo, supportando tabelle da milioni di record.
- **Modalità Full e Delta:** Capacità di estrarre intere tabelle oppure solo gli incrementi grazie al sistema di Watermark automatico.
- **Supporto Destinazioni Multiple:** Scrittura nativa in formato Parquet ottimizzato, CSV e push automatizzato verso SFTP, Azure Blob Storage o database SQL secondari.
- **Dashboard React Premium:** Una console visiva ad alta reattività con vista raggruppata "a soffietto", motore di ricerca integrato e design system moderno con supporto Dark Mode.
- **Bulk Upload via Excel:** Permette di configurare e lanciare istantaneamente decine o centinaia di Job caricando un banale template Excel.
- **Schedulatore Integrato (Cron):** Motore di esecuzione integrato (APScheduler) per schedulare estrazioni giornaliere, settimanali, mensili o in precisi orari ("una tantum").

## 🛠️ Stack Tecnologico

- **Backend:** Python 3.10, FastAPI, SQLAlchemy, Pandas, PyArrow, APScheduler.
- **Frontend:** React 19, Vite, TailwindCSS 4, Zustand, AG Grid.
- **Infrastruttura:** Docker, Docker Compose, SQLite (configurazione).

## 📦 Installazione e Avvio Rapido

L'intero ambiente è "dockerizzato". Per avviare il gateway, l'interfaccia React e i servizi mock di test (SFTP e Mailpit), basta eseguire:

```bash
# Esegue la build del frontend e avvia i container
docker-compose up --build -d
```

Una volta avviato, i servizi saranno disponibili ai seguenti indirizzi:
- **Dashboard Web:** [http://localhost:8000/](http://localhost:8000/)
- **Documentazione API (Swagger):** [http://localhost:8000/docs](http://localhost:8000/docs)
- **Mailpit (Mock Server Email):** [http://localhost:8025/](http://localhost:8025/)
- **Server SFTP (Test):** `localhost:2222` (User: `caronte_test`, Pass: `password`)

## 🏗️ Struttura del Progetto

```
Caronte/
├── backend/               # Applicativo FastAPI, estrattori e modelli DB
│   ├── data/              # Database SQLite (escluso da Git)
│   ├── main.py            # API REST e orchestrazione
│   ├── extractor.py       # Motore di I/O (Pandas, Parquet, SFTP, Azure)
│   ├── scheduler.py       # Motore APScheduler per i job cron
│   └── database.py        # Modelli SQLAlchemy
├── frontend/              # Interfaccia Utente React/Vite
│   ├── src/features/      # Moduli (Jobs, Connections, Logs)
│   ├── src/store/         # Zustand Store per la gestione stato
│   └── index.css          # Tailwind & Temi (Light/Dark)
├── docker-compose.yml     # Orchestrazione dei container
└── Dockerfile             # Multi-stage build per servire React via FastAPI
```

## 📊 Gestione dei Job (Bulk Upload)

Per caricare decine di job simultaneamente, nella sezione **Jobs**, scarica il Template Excel e compila queste 4 colonne:
1. `Tabella` (es. `CLIENTI`)
2. `Sorgente` (Nome esatto della connessione sorgente, es. `Oracle ERP`)
3. `Destinazione` (Nome esatto della connessione destinazione, es. `Azure Datalake`)
4. `Chunk` (Opzionale: es. `50000`, ottimizza il consumo di RAM in fase di export)

Caricando l'Excel, il sistema auto-completerà le risoluzioni ID e creerà le pipeline in background pronte per essere schedulate.

---
*Progetto sviluppato da [Luigi Scrimitore](https://github.com/LuigiScrimitore).*
