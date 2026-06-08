from fastapi import FastAPI, Depends, BackgroundTasks, HTTPException, Header, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.date import DateTrigger
import os
import datetime
import json
import pandas as pd
import io

from database import get_db, Job, Connection, ExecutionLog, Project
from extractor import run_extraction_job, test_connection as run_test_connection
from schemas import ProjectBase, ConnectionBase, JobBase

app = FastAPI(title="CARONTE API", version="3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

scheduler = BackgroundScheduler()

def get_project_id(x_project_id: str = Header(None)):
    if not x_project_id:
        raise HTTPException(status_code=400, detail="X-Project-ID header is missing")
    return x_project_id

def schedule_job(job: Job):
    job_id_str = f"job_{job.id}"
    if scheduler.get_job(job_id_str):
        scheduler.remove_job(job_id_str)
    
    if job.is_active and job.cron:
        try:
            # Prova a fare parsing come JSON
            try:
                cron_data = json.loads(job.cron)
                if cron_data.get("type") == "date":
                    run_date = datetime.datetime.fromisoformat(cron_data.get("run_date"))
                    trigger = DateTrigger(run_date=run_date)
                elif cron_data.get("type") == "cron":
                    trigger = CronTrigger(**cron_data.get("kwargs", {}))
                else:
                    raise ValueError("Tipo di trigger JSON non supportato")
            except json.JSONDecodeError:
                # Fallback per i vecchi cron text (retrocompatibilità)
                trigger = CronTrigger.from_crontab(job.cron)
                
            scheduler.add_job(run_extraction_job, trigger, id=job_id_str, args=[job.id])
        except Exception as e:
            print(f"Errore nello schedulare job {job.id}: {e}")

@app.on_event("startup")
def startup_event():
    db = next(get_db())
    jobs = db.query(Job).filter(Job.is_active == True, Job.cron != None).all()
    for job in jobs:
        schedule_job(job)
    scheduler.start()
    db.close()

@app.on_event("shutdown")
def shutdown_event():
    scheduler.shutdown()

# --- PROJECTS ---
@app.get("/api/v1/projects")
def get_projects(db: Session = Depends(get_db)):
    return db.query(Project).all()

@app.post("/api/v1/projects")
def create_project(proj: ProjectBase, db: Session = Depends(get_db)):
    db_proj = Project(**proj.dict())
    db.add(db_proj)
    db.commit()
    db.refresh(db_proj)
    return db_proj

# --- CONNECTIONS ---
@app.get("/api/v1/connections")
def get_connections(db: Session = Depends(get_db), project_id: str = Depends(get_project_id)):
    return db.query(Connection).filter(Connection.project_id == project_id).all()

@app.post("/api/v1/connections")
def create_connection(conn: ConnectionBase, db: Session = Depends(get_db), project_id: str = Depends(get_project_id)):
    db_conn = Connection(**conn.dict(), project_id=project_id)
    db.add(db_conn)
    db.commit()
    db.refresh(db_conn)
    return db_conn

@app.post("/api/v1/connections/test")
def test_connection_endpoint(conn: ConnectionBase):
    try:
        temp_conn = Connection(**conn.dict())
        run_test_connection(temp_conn)
        return {"status": "ok", "message": "Connessione riuscita con successo!"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.put("/api/v1/connections/{conn_id}")
def update_connection(conn_id: int, conn_data: ConnectionBase, db: Session = Depends(get_db), project_id: str = Depends(get_project_id)):
    conn = db.query(Connection).filter(Connection.id == conn_id, Connection.project_id == project_id).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Connessione non trovata")
    
    for key, value in conn_data.dict().items():
        setattr(conn, key, value)
        
    db.commit()
    db.refresh(conn)
    return conn

@app.delete("/api/v1/connections/{conn_id}")
def delete_connection(conn_id: int, db: Session = Depends(get_db), project_id: str = Depends(get_project_id)):
    conn = db.query(Connection).filter(Connection.id == conn_id, Connection.project_id == project_id).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Connessione non trovata")
    
    # Check dependencies
    if db.query(Job).filter((Job.source_connection_id == conn_id) | (Job.destination_connection_id == conn_id)).first():
        raise HTTPException(status_code=400, detail="Impossibile eliminare: la connessione è in uso in uno o più job.")
        
    db.delete(conn)
    db.commit()
    return {"message": "Connessione eliminata"}

# --- JOBS ---
@app.get("/api/v1/jobs")
def get_jobs(db: Session = Depends(get_db), project_id: str = Depends(get_project_id)):
    return db.query(Job).filter(Job.project_id == project_id).all()

@app.post("/api/v1/jobs")
def create_job(job_data: JobBase, db: Session = Depends(get_db), project_id: str = Depends(get_project_id)):
    db_job = Job(**job_data.dict(), project_id=project_id)
    db.add(db_job)
    db.commit()
    db.refresh(db_job)
    schedule_job(db_job)
    return db_job

@app.put("/api/v1/jobs/{job_id}")
def update_job(job_id: int, job_data: JobBase, db: Session = Depends(get_db), project_id: str = Depends(get_project_id)):
    job = db.query(Job).filter(Job.id == job_id, Job.project_id == project_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job non trovato")
        
    for key, value in job_data.dict().items():
        setattr(job, key, value)
        
    db.commit()
    db.refresh(job)
    schedule_job(job) # Reschedule con i nuovi parametri
    return job

@app.delete("/api/v1/jobs/{job_id}")
def delete_job(job_id: int, db: Session = Depends(get_db), project_id: str = Depends(get_project_id)):
    job = db.query(Job).filter(Job.id == job_id, Job.project_id == project_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job non trovato")
    
    job_id_str = f"job_{job.id}"
    if scheduler.get_job(job_id_str):
        scheduler.remove_job(job_id_str)
        
    db.delete(job)
    db.commit()
    return {"message": "Job eliminato"}

@app.post("/api/v1/jobs/{job_id}/run")
def trigger_job(job_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db), project_id: str = Depends(get_project_id)):
    job = db.query(Job).filter(Job.id == job_id, Job.project_id == project_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job non trovato")
    
    if job.source_connection_id is None or job.destination_connection_id is None:
        raise HTTPException(status_code=400, detail="Impossibile avviare il job: manca la connessione sorgente o destinazione.")
        
    background_tasks.add_task(run_extraction_job, job_id)
    return {"message": f"Job {job_id} avviato in background."}

@app.post("/api/v1/jobs/upload")
async def upload_jobs_excel(file: UploadFile = File(...), db: Session = Depends(get_db), project_id: str = Depends(get_project_id)):
    if not file.filename.endswith('.xlsx'):
        raise HTTPException(status_code=400, detail="Il file deve essere in formato .xlsx")
        
    try:
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        
        expected_cols = ["Tabella", "Sorgente", "Destinazione"]
        for col in expected_cols:
            if col not in df.columns:
                raise ValueError(f"Colonna mancante nel template: {col}")
                
        # Creiamo un dizionario delle connessioni esistenti per questo progetto per lookup veloce
        all_conns = db.query(Connection).filter(Connection.project_id == project_id).all()
        conn_map = {c.name.strip().lower(): c.id for c in all_conns}
        
        created_count = 0
        for index, row in df.iterrows():
            tabella = str(row["Tabella"]).strip()
            sorgente_name = str(row["Sorgente"]).strip()
            destinazione_name = str(row["Destinazione"]).strip()
            
            chunk_val = 50000
            if "Chunk" in df.columns and pd.notna(row.get("Chunk")):
                try:
                    chunk_val = int(row["Chunk"])
                except:
                    pass
            
            if not tabella or tabella.lower() == 'nan':
                continue # Salta righe vuote
                
            source_id = conn_map.get(sorgente_name.lower())
            dest_id = conn_map.get(destinazione_name.lower())
            
            # Genera nome job
            job_name = f"{sorgente_name}_{tabella}"
            
            db_job = Job(
                project_id=project_id,
                name=job_name,
                source_connection_id=source_id,
                destination_connection_id=dest_id,
                tabella_sorgente=tabella,
                tipo="Full",
                col_watermark=None,
                query_base=f"SELECT * FROM {tabella}",
                chunk_size=chunk_val,
                cron=None,
                is_active=False
            )
            db.add(db_job)
            created_count += 1
            
        db.commit()
        return {"message": f"Creati con successo {created_count} Jobs massivamente."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# --- LOGS ---
@app.get("/api/v1/logs")
def get_logs(db: Session = Depends(get_db), project_id: str = Depends(get_project_id)):
    # Logs are related to jobs, so we join Job to filter by project_id
    logs = db.query(ExecutionLog).join(Job).filter(Job.project_id == project_id).order_by(ExecutionLog.data_inizio.desc()).limit(100).all()
    return logs

@app.post("/api/v1/logs/{log_id}/cancel")
def cancel_log(log_id: int, db: Session = Depends(get_db), project_id: str = Depends(get_project_id)):
    # Verifichiamo che il log esista e appartenga al progetto
    log = db.query(ExecutionLog).join(Job).filter(ExecutionLog.id == log_id, Job.project_id == project_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Log non trovato")
        
    if log.esito != "IN_PROGRESS":
        raise HTTPException(status_code=400, detail="Puoi cancellare solo job in esecuzione (IN_PROGRESS)")
        
    log.esito = "CANCELLED"
    log.data_fine = datetime.datetime.utcnow()
    log.messaggio_errore = "Cancellato forzatamente dall'utente"
    db.commit()
    return {"message": "Job cancellato correttamente"}

# --- DASHBOARD ---
@app.get("/api/v1/dashboard/stats")
def get_dashboard_stats(db: Session = Depends(get_db), project_id: str = Depends(get_project_id)):
    total_conns = db.query(Connection).filter(Connection.project_id == project_id).count()
    total_jobs = db.query(Job).filter(Job.project_id == project_id).count()
    active_jobs = db.query(Job).filter(Job.project_id == project_id, Job.is_active == True).count()
    
    # Esecuzioni ultime 24 ore
    ieri = datetime.datetime.utcnow() - datetime.timedelta(days=1)
    logs_ultime_24h = db.query(ExecutionLog).join(Job).filter(
        Job.project_id == project_id,
        ExecutionLog.data_inizio >= ieri
    ).all()
    
    successi = sum(1 for log in logs_ultime_24h if log.esito == 'SUCCESS')
    fallimenti = sum(1 for log in logs_ultime_24h if log.esito == 'ERROR')
    
    return {
        "total_connections": total_conns,
        "total_jobs": total_jobs,
        "active_jobs": active_jobs,
        "last_24h_runs": len(logs_ultime_24h),
        "success_runs": successi,
        "error_runs": fallimenti
    }

static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(static_dir):
    app.mount("/assets", StaticFiles(directory=os.path.join(static_dir, "assets")), name="assets")
    
    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        # Non intercettare le chiamate API
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not Found")
            
        # Serve i file reali se esistono (es. favicon, vite.svg)
        file_path = os.path.join(static_dir, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
            
        # Fallback alla SPA (React Router)
        index_path = os.path.join(static_dir, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
            
        raise HTTPException(status_code=404, detail="Not Found")
else:
    @app.get("/")
    def read_root():
        return {"message": "Caronte API is running. Frontend build non trovata in /static."}
