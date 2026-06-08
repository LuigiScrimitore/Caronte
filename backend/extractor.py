import oracledb
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
from azure.storage.blob import BlobServiceClient
import ftplib
import paramiko
import datetime
import os
import io
import time
import smtplib
import uuid
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from database import SessionLocal, Connection, Job, Watermark, ExecutionLog

def load_pkey(key_str):
    classes = [paramiko.RSAKey, paramiko.Ed25519Key, paramiko.ECDSAKey]
    for cls in classes:
        try:
            return cls.from_private_key(io.StringIO(key_str))
        except Exception:
            continue
    raise ValueError("Formato chiave privata non supportato o invalido.")

def send_failure_email(job_name: str, project_id: str, error_message: str):
    smtp_server = os.getenv('SMTP_SERVER')
    smtp_port = os.getenv('SMTP_PORT')
    recipient = os.getenv('NOTIFICATION_EMAIL')
    
    if not smtp_server or not smtp_port or not recipient:
        print("Configurazione SMTP mancante. Email non inviata.")
        return
        
    try:
        msg = MIMEMultipart()
        msg['From'] = "caronte@alert.local"
        msg['To'] = recipient
        msg['Subject'] = f"❌ [CARONTE ALERT] Job Fallito: {job_name}"
        
        body = f"""
        Attenzione! Un job di estrazione ha fallito la sua esecuzione dopo tutti i tentativi di retry.
        
        Dettagli:
        - Progetto: {project_id}
        - Job Name: {job_name}
        - Orario Fallimento: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
        
        Errore Finale:
        {error_message}
        """
        
        msg.attach(MIMEText(body, 'plain'))
        
        server = smtplib.SMTP(smtp_server, int(smtp_port))
        
        smtp_user = os.getenv('SMTP_USER')
        smtp_pwd = os.getenv('SMTP_PASSWORD')
        if smtp_user and smtp_pwd:
            server.starttls()
            server.login(smtp_user, smtp_pwd)
            
        server.send_message(msg)
        server.quit()
        print(f"Email di allarme inviata a {recipient}")
    except Exception as e:
        print(f"Errore durante l'invio della mail di notifica: {e}")

def get_oracle_connection(conn_info: Connection):
    dsn = oracledb.makedsn(conn_info.host, conn_info.port, service_name=conn_info.service_sid_path)
    conn = oracledb.connect(user=conn_info.user, password=conn_info.pwd, dsn=dsn)
    return conn

def upload_to_azure(conn_info: Connection, local_path: str, blob_name: str):
    conn_str = conn_info.pwd or os.getenv('AZURE_STORAGE_CONNECTION_STRING')
    if not conn_str:
        print(f"Mock Upload Azure: {blob_name}")
        return True
    blob_service_client = BlobServiceClient.from_connection_string(conn_str)
    container_name = conn_info.service_sid_path or 'landing-zone'
    container_client = blob_service_client.get_container_client(container_name)
    if not container_client.exists():
        container_client.create_container()
    blob_client = container_client.get_blob_client(blob_name)
    with open(local_path, "rb") as f:
        blob_client.upload_blob(f, overwrite=True)
    return True

def upload_to_ftp(conn_info: Connection, local_path: str, file_name: str):
    ftp = ftplib.FTP()
    ftp.connect(conn_info.host, conn_info.port or 21)
    if conn_info.user:
        ftp.login(conn_info.user, conn_info.pwd)
    else:
        ftp.login()
    
    base_path = conn_info.service_sid_path or "/"
    if base_path != "/":
        ftp.cwd(base_path)
        
    with open(local_path, "rb") as f:
        ftp.storbinary(f"STOR {file_name}", f)
    ftp.quit()
    return True

def upload_to_sftp(conn_info: Connection, local_path: str, file_name: str):
    transport = paramiko.Transport((conn_info.host, conn_info.port or 22))
    if conn_info.pwd and "-----BEGIN" in conn_info.pwd:
        pkey = load_pkey(conn_info.pwd)
        transport.connect(username=conn_info.user, pkey=pkey)
    else:
        transport.connect(username=conn_info.user, password=conn_info.pwd)
        
    sftp = paramiko.SFTPClient.from_transport(transport)
    
    base_path = conn_info.service_sid_path or "."
    remote_path = f"{base_path}/{file_name}"
    
    sftp.put(local_path, remote_path)
    sftp.close()
    transport.close()
    return True

def test_connection(conn_info: Connection):
    try:
        if conn_info.tipo == 'oracle':
            with get_oracle_connection(conn_info):
                pass
            return True
        elif conn_info.tipo == 'ftp':
            ftp = ftplib.FTP()
            ftp.connect(conn_info.host, conn_info.port or 21)
            if conn_info.user:
                ftp.login(conn_info.user, conn_info.pwd)
            else:
                ftp.login()
            ftp.quit()
            return True
        elif conn_info.tipo == 'sftp':
            transport = paramiko.Transport((conn_info.host, conn_info.port or 22))
            if conn_info.pwd and "-----BEGIN" in conn_info.pwd:
                pkey = load_pkey(conn_info.pwd)
                transport.connect(username=conn_info.user, pkey=pkey)
            else:
                transport.connect(username=conn_info.user, password=conn_info.pwd)
            sftp = paramiko.SFTPClient.from_transport(transport)
            sftp.close()
            transport.close()
            return True
        elif conn_info.tipo == 'azure':
            conn_str = conn_info.pwd or os.getenv('AZURE_STORAGE_CONNECTION_STRING')
            blob_service_client = BlobServiceClient.from_connection_string(conn_str)
            blob_service_client.get_container_client(conn_info.service_sid_path or 'landing-zone')
            return True
        return False
    except Exception as e:
        raise ValueError(str(e))

def run_extraction_job(job_id: int):
    db = SessionLocal()
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        db.close()
        return

    source_conn = job.source_connection
    dest_conn = job.destination_connection
    
    if not source_conn or not dest_conn:
        db.close()
        return

    exec_log = ExecutionLog(job_id=job.id, esito="IN_PROGRESS")
    db.add(exec_log)
    db.commit()
    db.refresh(exec_log)
    
    max_retries = 3
    retry_delay = 5 # secondi
    final_error = None
    
    temp_local_path = f"/tmp/caronte_exec_{uuid.uuid4().hex}.parquet"
    
    try:
        for attempt in range(max_retries):
            try:
                db.refresh(exec_log)
                if exec_log.esito == 'CANCELLED':
                    final_error = "CANCELLED"
                    break
                    
                watermark = db.query(Watermark).filter(Watermark.job_id == job.id).first()
                last_val = watermark.ultimo_valore_estratto if watermark else None
                
                query = job.query_base
                if job.tipo == 'Delta' and job.col_watermark and last_val:
                    if "WHERE" in query.upper():
                        query += f" AND {job.col_watermark} > '{last_val}'"
                    else:
                        query += f" WHERE {job.col_watermark} > '{last_val}'"
                
                writer = None
                righe_totali = 0
                max_estratto_chunk = None
                
                if os.path.exists(temp_local_path):
                    os.remove(temp_local_path)
                
                with get_oracle_connection(source_conn) as oracle_conn:
                    c_size = job.chunk_size if getattr(job, 'chunk_size', None) else 50000
                    for chunk_df in pd.read_sql(query, con=oracle_conn, chunksize=c_size):
                        db.refresh(exec_log)
                        if exec_log.esito == 'CANCELLED':
                            raise Exception("CANCELLED")
                            
                        chunk_righe = len(chunk_df)
                        if chunk_righe == 0:
                            continue
                            
                        righe_totali += chunk_righe
                        chunk_df['PROJECT_ID'] = job.project_id
                        
                        if job.tipo == 'Delta' and job.col_watermark:
                            c_max = str(chunk_df[job.col_watermark].max())
                            if max_estratto_chunk is None or c_max > max_estratto_chunk:
                                max_estratto_chunk = c_max
                                
                        table = pa.Table.from_pandas(chunk_df)
                        
                        if writer is None:
                            writer = pq.ParquetWriter(temp_local_path, table.schema)
                        writer.write_table(table)
                
                if writer is not None:
                    writer.close()
                    
                if righe_totali > 0 and os.path.exists(temp_local_path):
                    timestamp_str = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
                    file_name = f"{job.name}_{job.project_id}_{timestamp_str}.parquet"
                    
                    if dest_conn.tipo == 'ftp':
                        upload_to_ftp(dest_conn, temp_local_path, file_name)
                    elif dest_conn.tipo == 'sftp':
                        upload_to_sftp(dest_conn, temp_local_path, file_name)
                    elif dest_conn.tipo == 'azure':
                        upload_to_azure(dest_conn, temp_local_path, file_name)
                    else:
                        raise ValueError(f"Tipo destinazione non supportato: {dest_conn.tipo}")
                    
                    if job.tipo == 'Delta' and job.col_watermark and max_estratto_chunk is not None:
                        if watermark:
                            watermark.ultimo_valore_estratto = max_estratto_chunk
                        else:
                            new_wm = Watermark(job_id=job.id, ultimo_valore_estratto=max_estratto_chunk)
                            db.add(new_wm)
                
                # Controllo finale prima di segnare successo
                db.refresh(exec_log)
                if exec_log.esito == 'CANCELLED':
                    final_error = "CANCELLED"
                    break
                    
                exec_log.data_fine = datetime.datetime.utcnow()
                exec_log.righe_estratte = righe_totali
                exec_log.esito = "SUCCESS"
                db.commit()
                
                final_error = None
                break # Uscita dal ciclo retry se ha successo
                
            except Exception as e:
                if str(e) == "CANCELLED":
                    final_error = "CANCELLED"
                    break
                    
                final_error = str(e)
                print(f"Tentativo {attempt+1}/{max_retries} fallito per il job {job.name}: {final_error}")
                
                if 'writer' in locals() and writer is not None:
                    try:
                        writer.close()
                    except:
                        pass
                        
                if attempt < max_retries - 1:
                    # Sospensione interroggibile
                    for _ in range(retry_delay):
                        db.refresh(exec_log)
                        if exec_log.esito == 'CANCELLED':
                            final_error = "CANCELLED"
                            break
                        time.sleep(1)
                    if final_error == "CANCELLED":
                        break
    finally:
        # Pulizia feroce indipendente dall'esito
        if os.path.exists(temp_local_path):
            try:
                os.remove(temp_local_path)
            except:
                pass
                
    if final_error:
        if final_error != "CANCELLED":
            exec_log.data_fine = datetime.datetime.utcnow()
            exec_log.esito = "ERROR"
            exec_log.messaggio_errore = final_error
            db.commit()
            send_failure_email(job.name, job.project_id, final_error)
        
    db.close()
