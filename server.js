const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const app = express();

// KONFIGURACJA CORS
app.use(cors({
    origin: ['https://socialtool.work.gd', 'http://localhost:3000', 'http://127.0.0.1:5500'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));
app.options('*', cors());

// PARSOWANIE JSON
app.use(express.json());

// KONFIGURACJA SUPABASE
const supabaseUrl = 'https://kazlfzeinvzpyywpilkk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthemxmemVpbnZ6cHl5d3BpbGtrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzEyNjM3OCwiZXhwIjoyMDc4NzAyMzc4fQ.M4DN5LWKX9LcDZFkBwRz5mVv0dlr2_UgDAq96l48flU';
const supabase = createClient(supabaseUrl, supabaseKey);

// SYSTEM STATUSÓW I BANÓW (w pamięci)
const activeUsers = new Map();
const BAN_LIST = new Set();

// ==================== ENDPOINTY DLA SOCIAL TOOLS.EXE ====================

// Rejestracja użytkownika
app.post('/save-log', async (req, res) => {
    console.log('📝 Rejestracja:', req.body.username);
    
    try {
        const { username, password, ip } = req.body;

        // Sprawdź czy użytkownik istnieje
        const { data: istnieje } = await supabase
            .from('users')
            .select('username')
            .eq('username', username)
            .single();

        if (istnieje) {
            return res.status(409).json({ 
                success: false, 
                message: 'Ta nazwa użytkownika jest już zajęta' 
            });
        }

        // Dodaj użytkownika
        const { error } = await supabase
            .from('users')
            .insert([
                { 
                    username: username, 
                    password: password, 
                    ip: ip,
                    version: '2.0'
                }
            ]);

        if (error) {
            console.error('Błąd bazy:', error);
            return res.status(500).json({ success: false, message: 'Błąd bazy danych' });
        }

        res.json({ success: true, message: 'Konto utworzone pomyślnie!' });
        
    } catch (error) {
        console.error('Błąd:', error);
        res.status(500).json({ success: false, message: 'Błąd serwera' });
    }
});

// Lista użytkowników (dla logowania)
app.get('/check-logs', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*');

        if (error) throw error;

        res.json({ 
            success: true, 
            users: data || [] 
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== ENDPOINTY DLA ADMIN PANEL ====================

// Statusy użytkowników (dla Admin Panel)
app.get('/status', async (req, res) => {
    try {
        const statuses = Array.from(activeUsers.values());
        const onlineUsers = statuses.filter(s => s.status === 'online');
        
        res.json({ 
            success: true, 
            online: onlineUsers.length,
            offline: statuses.length - onlineUsers.length,
            total: statuses.length,
            statuses: statuses,
            banned_ips: Array.from(BAN_LIST)
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Aktualizacja statusu (dla Social Tools.exe)
app.post('/update-status', async (req, res) => {
    const { username, ip, status } = req.body;
    
    if (!username || !ip) {
        return res.status(400).json({ 
            success: false, 
            message: 'Brak wymaganych danych' 
        });
    }

    // Sprawdź czy użytkownik jest zbanowany
    if (BAN_LIST.has(ip)) {
        return res.json({ 
            success: false, 
            message: 'IP ZBANOWANE', 
            banned: true 
        });
    }

    const userData = {
        username,
        ip,
        status: status || 'online',
        last_activity: new Date().toISOString(),
        timestamp: Date.now()
    };

    activeUsers.set(username, userData);

    res.json({ 
        success: true, 
        message: 'Status zaktualizowany'
    });
});

// Lista użytkowników (dla Admin Panel)
app.get('/users', async (req, res) => {
    try {
        const { data: users, error } = await supabase
            .from('users')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Dodaj status online/offline
        const usersWithStatus = (users || []).map(user => ({
            ...user,
            is_online: activeUsers.has(user.username),
            is_banned: BAN_LIST.has(user.ip)
        }));

        res.json({
            success: true,
            users: usersWithStatus,
            total: usersWithStatus.length
        });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Usuwanie użytkownika
app.delete('/users/:username', async (req, res) => {
    const username = req.params.username;
    
    try {
        // Znajdź użytkownika aby pobrać IP
        const { data: user, error: findError } = await supabase
            .from('users')
            .select('ip')
            .eq('username', username)
            .single();

        if (findError) throw findError;

        // Usuń użytkownika
        const { error: deleteError } = await supabase
            .from('users')
            .delete()
            .eq('username', username);

        if (deleteError) throw deleteError;

        // Usuń też z aktywnych użytkowników
        activeUsers.delete(username);

        // Automatycznie zbanuj IP
        if (user && user.ip) {
            BAN_LIST.add(user.ip);
        }

        res.json({ success: true, message: `Użytkownik ${username} został usunięty` });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// System banów
app.post('/ban-ip', async (req, res) => {
    const { ip, reason } = req.body;
    
    if (!ip) {
        return res.status(400).json({ success: false, message: 'Brak IP' });
    }

    BAN_LIST.add(ip);
    console.log(`🚫 Zbanowano IP: ${ip}, powód: ${reason}`);
    
    res.json({ success: true, message: `IP ${ip} zostało zbanowane` });
});

app.post('/unban-ip', async (req, res) => {
    const { ip } = req.body;
    
    if (!ip) {
        return res.status(400).json({ success: false, message: 'Brak IP' });
    }

    BAN_LIST.delete(ip);
    console.log(`✅ Odbanowano IP: ${ip}`);
    
    res.json({ success: true, message: `IP ${ip} zostało odbanowane` });
});

app.get('/bans', async (req, res) => {
    res.json({
        success: true,
        banned_ips: Array.from(BAN_LIST),
        bans: Array.from(BAN_LIST).map(ip => ({ 
            ip, 
            reason: 'Administrator decision',
            banned_by: 'system',
            banned_at: new Date().toISOString()
        }))
    });
});

// System wiadomości
app.post('/send-message', async (req, res) => {
    const { to_username, message, title } = req.body;
    
    if (!to_username || !message) {
        return res.status(400).json({ success: false, message: 'Brak odbiorcy lub wiadomości' });
    }

    console.log(`📨 Wiadomość do ${to_username}: ${message}`);
    
    res.json({ 
        success: true, 
        message: `Wiadomość wysłana do ${to_username}`,
        message_id: Date.now()
    });
});

app.get('/messages/:username', async (req, res) => {
    const username = req.params.username;
    
    // W prawdziwej implementacji tutaj byłby odczyt z bazy danych
    res.json({
        success: true,
        messages: []
    });
});

// Endpoint główny
app.get('/', (req, res) => {
    res.json({ 
        message: '🚀 Social Tools API działa!', 
        status: 'online',
        version: '2.0',
        endpoints: {
            'POST /save-log': 'Rejestracja użytkownika',
            'GET /check-logs': 'Lista użytkowników (login)',
            'POST /update-status': 'Aktualizuj status',
            'GET /status': 'Statusy online/offline',
            'GET /users': 'Lista użytkowników (admin)',
            'DELETE /users/:username': 'Usuń użytkownika',
            'POST /ban-ip': 'Zbanuj IP',
            'POST /unban-ip': 'Odbanuj IP',
            'GET /bans': 'Lista banów',
            'POST /send-message': 'Wyślij wiadomość'
        }
    });
});

// Czyszczenie starych statusów co 5 minut
setInterval(() => {
    const now = Date.now();
    const FIVE_MINUTES = 5 * 60 * 1000;
    
    for (let [username, userData] of activeUsers.entries()) {
        if (now - userData.timestamp > FIVE_MINUTES) {
            activeUsers.delete(username);
        }
    }
}, 30000);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 Serwer działa na porcie ${PORT}`);
    console.log(`✅ Wszystkie endpointy aktywne!`);
});
