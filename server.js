const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const app = express();

// ROZSZERZONA KONFIGURACJA CORS - NA SAMYM POCZĄTKU
app.use(cors({
    origin: [
        'https://socialtool.work.gd',
        'https://m1des1.github.io',
        'http://localhost:3000',
        'http://localhost:8080',
        'http://localhost:5500'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Origin', 'Accept']
}));

// Obsługa preflight requests
app.options('*', cors());

// Parsowanie JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Middleware do logowania
app.use((req, res, next) => {
    console.log('=== 📨 INCOMING REQUEST ===');
    console.log('Method:', req.method);
    console.log('URL:', req.url);
    console.log('Headers:', req.headers.origin);
    console.log('Body:', req.body);
    console.log('=== 🏁 END REQUEST LOG ===');
    next();
});

// Konfiguracja Supabase
const supabaseUrl = 'https://kazlfzeinvzpyywpilkk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthemxmemVpbnZ6cHl5d3BpbGtrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzEyNjM3OCwiZXhwIjoyMDc4NzAyMzc4fQ.M4DN5LWKX9LcDZFkBwRz5mVv0dlr2_UgDAq96l48flU';
const supabase = createClient(supabaseUrl, supabaseKey);

// ==================== SYSTEM STATUSÓW ====================
const STATUS_FILE = path.join(__dirname, 'status.txt');

// Funkcja do inicjalizacji pliku statusów
function initializeStatusFile() {
    try {
        if (!fs.existsSync(STATUS_FILE)) {
            fs.writeFileSync(STATUS_FILE, '', 'utf8');
            console.log('✅ Utworzono plik status.txt');
        } else {
            console.log('📁 Plik status.txt już istnieje');
        }
    } catch (error) {
        console.error('❌ Błąd tworzenia pliku status:', error);
    }
}

// Funkcja do zapisywania statusu
function saveUserStatus(userData) {
    try {
        const statusLine = JSON.stringify({
            username: userData.username,
            ip: userData.ip,
            status: userData.status,
            last_activity: userData.last_activity || new Date().toISOString(),
            version: userData.version || '1.0',
            timestamp: new Date().toISOString()
        }) + '\n';
        
        fs.appendFileSync(STATUS_FILE, statusLine, 'utf8');
        console.log(`✅ Status: ${userData.username} - ${userData.status}`);
        return true;
    } catch (error) {
        console.error('❌ Błąd zapisywania statusu:', error);
        return false;
    }
}

// Funkcja do odczytu statusów
function getUserStatuses() {
    try {
        if (!fs.existsSync(STATUS_FILE)) {
            return [];
        }
        
        const content = fs.readFileSync(STATUS_FILE, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());
        
        return lines
            .map(line => {
                try {
                    return JSON.parse(line);
                } catch {
                    return null;
                }
            })
            .filter(status => status !== null)
            .reverse();
    } catch (error) {
        console.error('❌ Błąd odczytu statusów:', error);
        return [];
    }
}

// ==================== ENDPOINTY STATUSÓW ====================

// Endpoint do aktualizacji statusu
app.post('/update-status', async (req, res) => {
    console.log('=== 🔄 AKTUALIZACJA STATUSU ===');
    
    const { username, ip, status, last_activity, version } = req.body;
    
    if (!username || !ip || !status) {
        console.log('❌ Brak wymaganych danych statusu');
        return res.status(400).json({ 
            success: false, 
            message: 'Brak wymaganych danych: username, ip, status' 
        });
    }
    
    const userData = {
        username,
        ip,
        status,
        last_activity: last_activity || new Date().toISOString(),
        version: version || '1.0'
    };
    
    const saveResult = saveUserStatus(userData);
    
    if (saveResult) {
        console.log(`✅ Status: ${username} (${ip}) - ${status}`);
        res.json({ 
            success: true, 
            message: 'Status zaktualizowany'
        });
    } else {
        res.status(500).json({ 
            success: false, 
            message: 'Błąd zapisywania statusu' 
        });
    }
});

// Endpoint do sprawdzania statusów
app.get('/status', async (req, res) => {
    console.log('=== 📊 SPRAWDZANIE STATUSÓW ===');
    
    try {
        const statuses = getUserStatuses();
        const onlineUsers = statuses.filter(s => s.status === 'online');
        const offlineUsers = statuses.filter(s => s.status === 'offline');
        
        console.log(`👥 Statusy: ${onlineUsers.length} online, ${offlineUsers.length} offline`);
        
        res.json({ 
            success: true, 
            online: onlineUsers.length,
            offline: offlineUsers.length,
            total: statuses.length,
            statuses: statuses.slice(0, 100), // Ostatnie 100 statusów
            last_update: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Błąd pobierania statusów:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint do sprawdzania statusu konkretnego użytkownika
app.get('/status/:username', async (req, res) => {
    const username = req.params.username;
    console.log(`🔍 Sprawdzanie statusu: ${username}`);
    
    try {
        const statuses = getUserStatuses();
        const userStatus = statuses.find(s => s.username === username);
        
        if (userStatus) {
            res.json({
                success: true,
                user: userStatus,
                is_online: userStatus.status === 'online',
                message: `Użytkownik ${userStatus.status === 'online' ? 'online' : 'offline'}`
            });
        } else {
            res.json({
                success: false,
                message: 'Użytkownik nie znaleziony w statusach'
            });
        }
    } catch (error) {
        console.error('❌ Błąd sprawdzania statusu:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== ORYGINALNE ENDPOINTY ====================

// Funkcja do sprawdzania czy użytkownik istnieje
async function checkIfUserExists(username) {
    try {
        console.log('🔍 Checking user:', username);
        const { data, error } = await supabase
            .from('users')
            .select('username')
            .eq('username', username)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                console.log('✅ User does not exist');
                return false;
            }
            console.error('❌ DB Error checking user:', error);
            return false;
        }

        console.log('✅ User exists:', data);
        return !!data;
    } catch (error) {
        console.error('❌ Error checking user:', error);
        return false;
    }
}

// Funkcja do sprawdzania czy IP ma już konto
async function checkIfIPExists(ip) {
    try {
        console.log('🔍 Checking IP:', ip);
        const { data, error } = await supabase
            .from('users')
            .select('ip')
            .eq('ip', ip)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                console.log('✅ IP does not exist');
                return false;
            }
            console.error('❌ DB Error checking IP:', error);
            return false;
        }

        console.log('✅ IP exists:', data);
        return !!data;
    } catch (error) {
        console.error('❌ Error checking IP:', error);
        return false;
    }
}

// Funkcja do zapisywania użytkownika
async function saveUserToDatabase(username, password, ip) {
    try {
        console.log('💾 Saving user to database...');
        
        const userData = {
            username: username,
            password: password,
            ip: ip,
            version: '2.0'
        };

        console.log('📝 User data:', userData);

        const { data, error } = await supabase
            .from('users')
            .insert([userData])
            .select();

        if (error) {
            console.error('❌ Database insert error:', {
                code: error.code,
                message: error.message,
                details: error.details,
                hint: error.hint
            });
            return false;
        }

        console.log('✅ User saved successfully:', data);
        return true;
    } catch (error) {
        console.error('💥 Critical save error:', error);
        return false;
    }
}

// Główny endpoint rejestracji
app.post('/save-log', async (req, res) => {
    console.log('=== 🆕 NOWA REJESTRACJA ===');
    console.log('📨 Otrzymano żądanie:', req.body);
    
    const { username, password, ip } = req.body;
    
    // Walidacja danych
    if (!username || !password || !ip) {
        console.log('❌ Missing data:', { username, password, ip });
        return res.status(400).json({ 
            success: false, 
            message: 'Brak wymaganych danych: username, password, ip' 
        });
    }

    console.log('🔍 Sprawdzanie czy użytkownik istnieje...');
    const userExists = await checkIfUserExists(username);
    if (userExists) {
        console.log('❌ Użytkownik już istnieje:', username);
        return res.status(409).json({ 
            success: false, 
            message: 'Nazwa użytkownika jest już zajęta' 
        });
    }

    console.log('🔍 Sprawdzanie czy IP ma już konto...');
    const ipExists = await checkIfIPExists(ip);
    if (ipExists) {
        console.log('❌ IP ma już konto:', ip);
        return res.status(409).json({ 
            success: false, 
            message: 'Za dużo użytkowników zostało zarejestrowanych na tym IP' 
        });
    }

    console.log('✅ Użytkownik i IP są dostępne, zapisywanie do bazy...');
    const saveResult = await saveUserToDatabase(username, password, ip);

    if (saveResult) {
        console.log('🎉 Rejestracja udana dla:', username);
        res.json({ 
            success: true, 
            message: 'Rejestracja udana!' 
        });
    } else {
        console.log('💥 Błąd rejestracji dla:', username);
        res.status(500).json({ 
            success: false, 
            message: 'Błąd podczas rejestracji' 
        });
    }
    
    console.log('=== ✅ KONIEC REJESTRACJI ===\n');
});

// Pozostałe endpointy
app.get('/check-logs', async (req, res) => {
    console.log('=== 📊 SPRAWDZANIE UŻYTKOWNIKÓW ===');
    
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('❌ DB Error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }

        console.log('📋 Znalezionych użytkowników:', data?.length || 0);
        
        res.json({ 
            success: true, 
            users: data || [],
            totalUsers: data?.length || 0,
            message: `Znaleziono ${data?.length || 0} użytkowników`
        });

    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/check-user/:username', async (req, res) => {
    const username = req.params.username;
    console.log(`🔍 Sprawdzanie użytkownika: ${username}`);
    
    const userExists = await checkIfUserExists(username);
    
    res.json({
        username: username,
        exists: userExists,
        message: userExists ? 'Użytkownik istnieje' : 'Użytkownik nie istnieje'
    });
});

app.get('/check-ip/:ip', async (req, res) => {
    const ip = req.params.ip;
    console.log(`🔍 Sprawdzanie IP: ${ip}`);
    
    const ipExists = await checkIfIPExists(ip);
    
    res.json({
        ip: ip,
        hasAccount: ipExists,
        message: ipExists ? 'IP ma już konto' : 'IP nie ma konta'
    });
});

app.get('/', (req, res) => {
    res.json({ 
        message: 'Supabase Logger API działa!', 
        status: 'online',
        database: 'Supabase PostgreSQL',
        cors: 'Enabled for socialtool.work.gd',
        endpoints: {
            'POST /save-log': 'Rejestracja użytkownika',
            'GET /check-logs': 'Sprawdź użytkowników',
            'GET /check-user/:username': 'Sprawdź użytkownika',
            'GET /check-ip/:ip': 'Sprawdź IP',
            'POST /update-status': 'Aktualizuj status użytkownika',
            'GET /status': 'Sprawdź wszystkie statusy',
            'GET /status/:username': 'Sprawdź status użytkownika'
        }
    });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Supabase API z tabelą users`);
    console.log(`🌐 CORS enabled for: socialtool.work.gd`);
    console.log(`📈 System statusów aktywny - plik: status.txt`);
    
    // Inicjalizuj plik statusów przy starcie
    initializeStatusFile();
});
