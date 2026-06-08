import os
from sqlalchemy import create_engine, Column, Integer, String, Boolean, ForeignKey, DateTime, Text
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
import datetime

# Assicuriamoci che la cartella data esista per supportare i volumi Docker
os.makedirs("data", exist_ok=True)
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data/caronte_state.db")

engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class Project(Base):
    __tablename__ = "projects"
    
    id = Column(String, primary_key=True, index=True) # es. 'logistix'
    name = Column(String)
    description = Column(String, nullable=True)

    connections = relationship("Connection", back_populates="project", cascade="all, delete-orphan")
    jobs = relationship("Job", back_populates="project", cascade="all, delete-orphan")

class Connection(Base):
    __tablename__ = "connections"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(String, ForeignKey("projects.id"))
    name = Column(String, index=True)
    tipo = Column(String) # oracle, ftp, sftp, azure
    host = Column(String)
    port = Column(Integer, nullable=True)
    service_sid_path = Column(String, nullable=True) # SID per Oracle, o basePath per FTP/SFTP
    user = Column(String, nullable=True)
    pwd = Column(String, nullable=True)
    
    project = relationship("Project", back_populates="connections")

    # Modificato per distinguere tra source e destination
    source_jobs = relationship("Job", foreign_keys="[Job.source_connection_id]", back_populates="source_connection")
    destination_jobs = relationship("Job", foreign_keys="[Job.destination_connection_id]", back_populates="destination_connection")

class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(String, ForeignKey("projects.id"))
    name = Column(String)
    
    source_connection_id = Column(Integer, ForeignKey("connections.id"))
    destination_connection_id = Column(Integer, ForeignKey("connections.id"))
    
    tabella_sorgente = Column(String)
    tipo = Column(String) # Full/Delta
    col_watermark = Column(String, nullable=True)
    query_base = Column(Text)
    chunk_size = Column(Integer, default=50000)
    cron = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    
    project = relationship("Project", back_populates="jobs")
    source_connection = relationship("Connection", foreign_keys=[source_connection_id], back_populates="source_jobs")
    destination_connection = relationship("Connection", foreign_keys=[destination_connection_id], back_populates="destination_jobs")
    
    watermarks = relationship("Watermark", back_populates="job", cascade="all, delete-orphan")
    logs = relationship("ExecutionLog", back_populates="job", cascade="all, delete-orphan")

class Watermark(Base):
    __tablename__ = "watermarks"

    job_id = Column(Integer, ForeignKey("jobs.id"), primary_key=True)
    ultimo_valore_estratto = Column(String)
    
    job = relationship("Job", back_populates="watermarks")

class ExecutionLog(Base):
    __tablename__ = "execution_logs"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id"))
    data_inizio = Column(DateTime, default=datetime.datetime.utcnow)
    data_fine = Column(DateTime, nullable=True)
    righe_estratte = Column(Integer, default=0)
    esito = Column(String) # SUCCESS/ERROR
    messaggio_errore = Column(Text, nullable=True)
    
    job = relationship("Job", back_populates="logs")

# Create tables
Base.metadata.create_all(bind=engine)

# Inizializza progetti di base se non esistono
def init_db():
    db = SessionLocal()
    if db.query(Project).count() == 0:
        db.add(Project(id="logistix", name="WMS Logistix", description="Progetto Logistix"))
        db.add(Project(id="exadata", name="Exadata", description="Progetto Exadata"))
        db.commit()
    db.close()

init_db()

# Dependency per FastAPI
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
