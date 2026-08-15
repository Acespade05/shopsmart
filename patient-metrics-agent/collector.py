"""
Patient-side metrics reporting agent (AI-SRE Reference Doc, Section 6).

Samples CPU, memory, disk, and process count every 10 seconds and stores
history in a local SQLite database. Exposes a small Flask API so the
Doctor VM can later poll this data remotely.

This runs on the Patient VM. It does NOT do any diagnosis or AI reasoning
itself — that's the Doctor VM's job, once built. This agent's only
responsibility is sampling and serving raw metrics.
"""

import sqlite3
import time
import threading
import psutil
from datetime import datetime, timezone
from flask import Flask, jsonify

DB_PATH = "/data/metrics.db"
SAMPLE_INTERVAL_SECONDS = 10

app = Flask(__name__)


def get_db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            cpu_percent REAL NOT NULL,
            memory_percent REAL NOT NULL,
            disk_percent REAL NOT NULL,
            process_count INTEGER NOT NULL,
            network_bytes_sent INTEGER NOT NULL,
            network_bytes_recv INTEGER NOT NULL
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics(timestamp)")
    conn.commit()
    conn.close()


def sample_and_store():
    """Runs forever in a background thread, sampling every 10 seconds."""
    while True:
        try:
            cpu = psutil.cpu_percent(interval=1)
            mem = psutil.virtual_memory().percent
            disk = psutil.disk_usage("/").percent
            procs = len(psutil.pids())
            net = psutil.net_io_counters()

            conn = get_db()
            conn.execute(
                """INSERT INTO metrics
                   (timestamp, cpu_percent, memory_percent, disk_percent,
                    process_count, network_bytes_sent, network_bytes_recv)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    datetime.now(timezone.utc).isoformat(),
                    cpu, mem, disk, procs,
                    net.bytes_sent, net.bytes_recv,
                ),
            )
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"[metrics agent] sampling error: {e}")

        time.sleep(SAMPLE_INTERVAL_SECONDS - 1)  # cpu_percent(interval=1) already blocks 1s


@app.route("/health")
def health():
    return jsonify({"status": "ok"})


@app.route("/metrics/latest")
def latest():
    conn = get_db()
    row = conn.execute("SELECT * FROM metrics ORDER BY id DESC LIMIT 1").fetchone()
    conn.close()
    if not row:
        return jsonify({"error": "no data yet"}), 404
    return jsonify(dict(row))


@app.route("/metrics/history")
def history():
    """Returns the last 500 samples (~83 minutes at 10s intervals)."""
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM metrics ORDER BY id DESC LIMIT 500"
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in reversed(rows)])


@app.route("/metrics/summary")
def summary():
    """Basic stats — useful for confirming baseline collection is progressing
    toward the 28-day target the Isolation Forest needs (AI-SRE doc Section 6.3)."""
    conn = get_db()
    row = conn.execute(
        """SELECT COUNT(*) as sample_count,
                  MIN(timestamp) as earliest,
                  MAX(timestamp) as latest,
                  AVG(cpu_percent) as avg_cpu,
                  AVG(memory_percent) as avg_memory
           FROM metrics"""
    ).fetchone()
    conn.close()
    return jsonify(dict(row))


if __name__ == "__main__":
    init_db()
    sampler_thread = threading.Thread(target=sample_and_store, daemon=True)
    sampler_thread.start()
    app.run(host="0.0.0.0", port=8080)