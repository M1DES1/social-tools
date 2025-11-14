const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const app = express();

// KONFIGURACJA CORS
app.use(cors({
    origin: ['https://socialtool.work.gd', 'http://localhost:3000'],
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

// ==================== SYSTEM STATUSÓW ONLINE/OFFLINE ====================

// Mapa aktywnych użytkowników (w pamięci)
const activeUsers = new Map();
const BAN_LIST = new Set();

// Aktualizacja statusu użytkownika
app.post('/update-status', async (req, res) => {
    const { username, ip, status, version } = req.body;
    
    if (!username || !ip) {
        return res.status(400).json({ success: false, message: 'Brak username lub IP' });
    }

    // Sprawdź czy użytkownik jest zbanowany
    if (BAN_LIST.has(ip)) {
        return res.json({ success: false, message: 'IP ZBANOWANE', banned: true });
    }

    const userData = {
        username,
        ip,
        status: status || 'online',
        version: version || '1.0',
        last_activity: new Date().toISOString(),
        timestamp: Date.now()
    };

    // Zapisz w pamięci
    activeUsers.set(username, userData);

    // Zapisz też w bazie danych
    try {
        const { error } = await supabase
            .from('user_status')
            .upsert({
                username: username,
                ip: ip,
                status: status || 'online',
                last_activity: new Date().toISOString(),
                version: version || '1.0'
            }, { onConflict: 'username' });

        if (error) throw error;
    } catch (error) {
        console.log('Błąd zapisu statusu do DB:', error);
    }

    res.json({ success: true, message: 'Status zaktualizowany' });
});

// Pobierz wszystkie statusy
app.get('/status', async (req, res) => {
    try {
        // Pobierz z bazy danych
        const { data: dbStatuses, error } = await supabase
            .from('user_status')
            .select('*')
            .order('last_activity', { ascending: false });

        if (error) throw error;

        // Połącz z aktywnymi użytkownikami w pamięci
        const allUsers = [...activeUsers.values()];
        const onlineUsers = allUsers.filter(user => user.status === 'online');
        const offlineUsers = allUsers.filter(user => user.status === 'offline');

        res.json({
            success: true,
            online: onlineUsers.length,
            offline: offlineUsers.length,
            total: allUsers.length,
            statuses: allUsers,
            banned_ips: Array.from(BAN_LIST),
            last_update: new Date().toISOString()
        });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== SYSTEM BANOWANIA ====================

// Banowanie IP
app.post('/ban-ip', async (req, res) => {
    const { ip, reason, admin } = req.body;
    
    if (!ip) {
        return res.status(400).json({ success: false, message: 'Brak IP do zbanowania' });
    }

    BAN_LIST.add(ip);
    
    // Zapisz ban w bazie danych
    try {
        const { error } = await supabase
            .from('bans')
            .insert({
                ip: ip,
                reason: reason || 'Administrator decision',
                banned_by: admin || 'system',
                banned_at: new Date().toISOString()
            });

        if (error) throw error;
    } catch (error) {
        console.log('Błąd zapisu bana do DB:', error);
    }

    res.json({ success: true, message: `IP ${ip} zostało zbanowane` });
});

// Odbanowanie IP
app.post('/unban-ip', async (req, res) => {
    const { ip } = req.body;
    
    if (!ip) {
        return res.status(400).json({ success: false, message: 'Brak IP do odbanowania' });
    }

    BAN_LIST.delete(ip);
    
    // Usuń ban z bazy danych
    try {
        const { error } = await supabase
            .from('bans')
            .delete()
            .eq('ip', ip);

        if (error) throw error;
    } catch (error) {
        console.log('Błąd usuwania bana z DB:', error);
    }

    res.json({ success: true, message: `IP ${ip} zostało odbanowane` });
});

// Lista zbanowanych IP
app.get('/bans', async (req, res) => {
    try {
        const { data: bans, error } = await supabase
            .from('bans')
            .select('*')
            .order('banned_at', { ascending: false });

        if (error) throw error;

        // Zsynchronizuj z pamięcią
        bans.forEach(ban => BAN_LIST.add(ban.ip));

        res.json({
            success: true,
            banned_ips: Array.from(BAN_LIST),
            bans: bans || []
        });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== SYSTEM WIADOMOŚCI ====================

// Wyślij wiadomość do użytkownika
app.post('/send-message', async (req, res) => {
    const { to_username, message, title, from_admin } = req.body;
    
    if (!to_username || !message) {
        return res.status(400).json({ success: false, message: 'Brak odbiorcy lub wiadomości' });
    }

    try {
        // Zapisz wiadomość w bazie danych
        const { data, error } = await supabase
            .from('messages')
            .insert({
                to_username: to_username,
                message: message,
                title: title || 'Wiadomość od Administratora',
                from_admin: from_admin || 'system',
                sent_at: new Date().toISOString(),
                read: false
            })
            .select();

        if (error) throw error;

        res.json({ 
            success: true, 
            message: `Wiadomość wysłana do ${to_username}`,
            message_id: data[0].id 
        });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Pobierz wiadomości dla użytkownika
app.get('/messages/:username', async (req, res) => {
    const username = req.params.username;
    
    try {
        const { data: messages, error } = await supabase
            .from('messages')
            .select('*')
            .eq('to_username', username)
            .order('sent_at', { ascending: false })
            .limit(50);

        if (error) throw error;

        res.json({
            success: true,
            messages: messages || []
        });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Oznacz wiadomość jako przeczytaną
app.post('/mark-message-read', async (req, res) => {
    const { message_id } = req.body;
    
    try {
        const { error } = await supabase
            .from('messages')
            .update({ read: true, read_at: new Date().toISOString() })
            .eq('id', message_id);

        if (error) throw error;

        res.json({ success: true, message: 'Wiadomość oznaczona jako przeczytana' });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== SYSTEM UŻYTKOWNIKÓW ====================

// Pobierz wszystkich użytkowników
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

// Usuń użytkownika
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

        // Usuń status użytkownika
        await supabase
            .from('user_status')
            .delete()
            .eq('username', username);

        res.json({ success: true, message: `Użytkownik ${username} został usunięty` });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Rejestracja nowego użytkownika
app.post('/register', async (req, res) => {
    const { username, password, ip } = req.body;
    
    if (!username || !password || !ip) {
        return res.status(400).json({ success: false, message: 'Brak wymaganych danych' });
    }

    // Sprawdź czy IP jest zbanowane
    if (BAN_LIST.has(ip)) {
        return res.json({ success: false, message: 'IP ZBANOWANE - Nie można utworzyć konta', banned: true });
    }

    try {
        // Sprawdź czy użytkownik już istnieje
        const { data: existingUser, error: checkError } = await supabase
            .from('users')
            .select('username')
            .eq('username', username)
            .single();

        if (existingUser) {
            return res.status(409).json({ success: false, message: 'Nazwa użytkownika jest już zajęta' });
        }

        // Sprawdź czy IP ma już konto
        const { data: existingIP, error: ipError } = await supabase
            .from('users')
            .select('ip')
            .eq('ip', ip)
            .single();

        if (existingIP) {
            return res.status(409).json({ success: false, message: 'To IP ma już konto' });
        }

        // Utwórz nowego użytkownika
        const { data: newUser, error: createError } = await supabase
            .from('users')
            .insert([{
                username: username,
                password: password,
                ip: ip,
                version: '2.0'
            }])
            .select();

        if (createError) throw createError;

        res.json({ success: true, message: 'Rejestracja udana!', user: newUser[0] });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== INICJALIZACJA BAZY DANYCH ====================

async function initializeDatabase() {
    console.log('🔄 Inicjalizacja bazy danych...');
    
    // Tabela statusów użytkowników
    try {
        const { error } = await supabase
            .from('user_status')
            .select('*')
            .limit(1);
            
        if (error && error.code === '42P01') {
            console.log('📋 Tabela user_status nie istnieje - należy ją utworzyć w Supabase');
        }
    } catch (error) {
        console.log('ℹ️ Tabela user_status:', error.message);
    }

    // Tabela banów
    try {
        const { error } = await supabase
            .from('bans')
            .select('*')
            .limit(1);
    } catch (error) {
        console.log('ℹ️ Tabela bans:', error.message);
    }

    // Tabela wiadomości
    try {
        const { error } = await supabase
            .from('messages')
            .select('*')
            .limit(1);
    } catch (error) {
        console.log('ℹ️ Tabela messages:', error.message);
    }

    // Załaduj istniejące bany
    try {
        const { data: bans, error } = await supabase
            .from('bans')
            .select('ip');
            
        if (bans) {
            bans.forEach(ban => BAN_LIST.add(ban.ip));
            console.log(`🚫 Załadowano ${BAN_LIST.size} zbanowanych IP`);
        }
    } catch (error) {
        console.log('ℹ️ Brak tabeli bans - można ją utworzyć później');
    }
}

// ==================== ENDPOINT GŁÓWNY ====================

app.get('/', (req, res) => {
    res.json({ 
        message: '🚀 Social Tools Admin API działa!', 
        status: 'online',
        features: {
            'user_management': 'Tak - rejestracja, usuwanie, lista',
            'status_system': 'Tak - online/offline w czasie rzeczywistym',
            'ban_system': 'Tak - banowanie i odbanowywanie IP',
            'messaging': 'Tak - wysyłanie wiadomości do użytkowników',
            'real_time': 'Tak - aktualizacje w pamięci i DB'
        },
        endpoints: {
            'POST /update-status': 'Aktualizuj status użytkownika',
            'GET /status': 'Pobierz wszystkie statusy',
            'POST /ban-ip': 'Zbanuj IP',
            'POST /unban-ip': 'Odbanuj IP',
            'GET /bans': 'Lista zbanowanych IP',
            'POST /send-message': 'Wyślij wiadomość',
            'GET /messages/:username': 'Pobierz wiadomości użytkownika',
            'GET /users': 'Lista wszystkich użytkowników',
            'DELETE /users/:username': 'Usuń użytkownika',
            'POST /register': 'Rejestracja nowego użytkownika'
        }
    });
});

// Uruchom serwer
const PORT = process.env.PORT || 10000;
app.listen(PORT, async () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Supabase: ${supabaseUrl}`);
    console.log(`👥 System użytkowników: AKTYWNY`);
    console.log(`🟢 System statusów: AKTYWNY`);
    console.log(`🚫 System banów: AKTYWNY`);
    console.log(`📨 System wiadomości: AKTYWNY`);
    
    // Inicjalizuj bazę danych
    await initializeDatabase();
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
