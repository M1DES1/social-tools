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

// SYSTEM W PAMIĘCI
const activeUsers = new Map();
const BAN_LIST = new Map();
const USER_MESSAGES = new Map();

// ==================== SYSTEM WIADOMOŚCI ====================

// Wysyłanie wiadomości do użytkownika
app.post('/send-message', async (req, res) => {
    const { to_username, message, title, from_admin } = req.body;
    
    console.log(`📨 Próba wysłania wiadomości do: ${to_username}`, req.body);
    
    if (!to_username || !message) {
        return res.status(400).json({ 
            success: false, 
            message: 'Brak odbiorcy lub wiadomości' 
        });
    }

    try {
        const messageData = {
            id: Date.now() + Math.random(),
            to_username: to_username,
            from_admin: from_admin || 'Administrator',
            title: title || 'Wiadomość od Administratora',
            message: message,
            timestamp: new Date().toISOString(),
            read: false,
            delivered: false
        };

        // Zapisz wiadomość dla użytkownika
        if (!USER_MESSAGES.has(to_username)) {
            USER_MESSAGES.set(to_username, []);
        }
        USER_MESSAGES.get(to_username).push(messageData);

        console.log(`✅ Wiadomość zapisana dla ${to_username}:`, messageData.title);
        
        res.json({ 
            success: true, 
            message: `Wiadomość wysłana do ${to_username}`,
            message_id: messageData.id
        });

    } catch (error) {
        console.error('❌ Błąd wysyłania wiadomości:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Błąd serwera' 
        });
    }
});

// Pobieranie wiadomości dla użytkownika
app.get('/messages/:username', async (req, res) => {
    const username = req.params.username;
    
    console.log(`📥 Pobieranie wiadomości dla: ${username}`);
    
    try {
        const userMessages = USER_MESSAGES.get(username) || [];
        
        // Znajdź nieprzeczytane wiadomości
        const unreadMessages = userMessages.filter(msg => !msg.read);
        
        console.log(`✅ Znaleziono ${unreadMessages.length} nieprzeczytanych wiadomości dla ${username}`);
        
        res.json({
            success: true,
            messages: unreadMessages,
            unread_count: unreadMessages.length,
            total_messages: userMessages.length
        });

    } catch (error) {
        console.error('❌ Błąd pobierania wiadomości:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Błąd serwera' 
        });
    }
});

// Oznacz wiadomość jako przeczytaną (usuwa ją z listy nieprzeczytanych)
app.post('/messages/:username/read', async (req, res) => {
    const username = req.params.username;
    const { message_id } = req.body;
    
    try {
        const userMessages = USER_MESSAGES.get(username) || [];
        const messageIndex = userMessages.findIndex(msg => msg.id === message_id);
        
        if (messageIndex !== -1) {
            // Oznacz jako przeczytaną
            userMessages[messageIndex].read = true;
            console.log(`✅ Oznaczono wiadomość ${message_id} jako przeczytaną dla ${username}`);
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Błąd oznaczania wiadomości:', error);
        res.status(500).json({ success: false, message: 'Błąd serwera' });
    }
});

// Usuń przeczytane wiadomości (sprzątanie)
app.delete('/messages/:username/cleanup', async (req, res) => {
    const username = req.params.username;
    
    try {
        if (USER_MESSAGES.has(username)) {
            const userMessages = USER_MESSAGES.get(username);
            // Zostaw tylko nieprzeczytane wiadomości
            const unreadMessages = userMessages.filter(msg => !msg.read);
            USER_MESSAGES.set(username, unreadMessages);
            
            console.log(`🧹 Wyczyszczono przeczytane wiadomości dla ${username}`);
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Błąd czyszczenia wiadomości:', error);
        res.status(500).json({ success: false, message: 'Błąd serwera' });
    }
});

// ==================== SYSTEM STATUSÓW ====================

// Aktualizacja statusu (dla Social Tools.exe)
app.post('/update-status', async (req, res) => {
    const { username, ip, status, version } = req.body;
    
    if (!username || !ip) {
        return res.status(400).json({ 
            success: false, 
            message: 'Brak wymaganych danych' 
        });
    }

    try {
        // SPRAWDŹ BANY - zarówno IP jak i username
        const ipBanned = BAN_LIST.has(ip);
        const userBanned = Array.from(BAN_LIST.values()).some(ban => ban.username === username);
        
        if (ipBanned || userBanned) {
            const banReason = ipBanned ? BAN_LIST.get(ip).reason : 'Konto zbanowane';
            console.log(`🚫 Odmowa dostępu - zbanowany użytkownik: ${username}, IP: ${ip}`);
            return res.json({ 
                success: false, 
                message: banReason, 
                banned: true 
            });
        }

        // Sprawdź czy użytkownik istnieje w bazie
        const { data: userExists } = await supabase
            .from('users')
            .select('username')
            .eq('username', username)
            .single();

        if (!userExists) {
            console.log(`🗑️ Konto usunięte: ${username}`);
            return res.json({ 
                success: false, 
                message: '🗑️ KONTO USUNIĘTE przez administratora', 
                banned: true 
            });
        }

        // Aktualizuj status z aktualnym timestamp
        const userData = {
            username,
            ip,
            status: status || 'online',
            version: version || '2.0',
            last_activity: new Date().toISOString(),
            timestamp: Date.now(),
            last_status_update: Date.now()
        };

        activeUsers.set(username, userData);

        console.log(`🟢 Status zaktualizowany: ${username} - ${status}`);

        res.json({ 
            success: true, 
            message: 'Status zaktualizowany'
        });

    } catch (error) {
        console.error('❌ Błąd update-status:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Błąd serwera' 
        });
    }
});

// Lista statusów online (dla Admin Panel)
app.get('/status', async (req, res) => {
    try {
        const now = Date.now();
        const OFFLINE_THRESHOLD = 15 * 1000; // 15 sekund
        
        // Sprawdź które statusy są nieaktualne
        for (let [username, userData] of activeUsers.entries()) {
            if (now - userData.timestamp > OFFLINE_THRESHOLD) {
                // Oznacz jako offline
                userData.status = 'offline';
                console.log(`⚪ Automatycznie oznaczono jako offline: ${username}`);
            }
        }

        const statuses = Array.from(activeUsers.values());
        const onlineUsers = statuses.filter(s => s.status === 'online');
        const offlineUsers = statuses.filter(s => s.status === 'offline');
        
        res.json({ 
            success: true, 
            online: onlineUsers.length,
            offline: offlineUsers.length,
            total: statuses.length,
            statuses: statuses,
            banned_ips: Array.from(BAN_LIST.entries()).map(([ip, data]) => ({
                ip,
                reason: data.reason,
                username: data.username,
                banned_at: data.timestamp
            }))
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== SYSTEM BANÓW ====================

// Banowanie IP/użytkownika
app.post('/ban-ip', async (req, res) => {
    const { ip, reason, username, admin } = req.body;
    
    if (!ip) {
        return res.status(400).json({ 
            success: false, 
            message: 'Brak IP' 
        });
    }

    try {
        const banData = {
            ip: ip,
            username: username || '',
            reason: reason || 'Administrator decision',
            admin: admin || 'admin_panel',
            timestamp: new Date().toISOString()
        };

        BAN_LIST.set(ip, banData);
        
        // Usuń z aktywnych użytkowników jeśli jest online
        if (username && activeUsers.has(username)) {
            activeUsers.delete(username);
            console.log(`🚫 Usunięto z aktywnych: ${username} (zbanowany)`);
        }

        console.log(`🚫 Zbanowano IP: ${ip}, użytkownik: ${username}, powód: ${reason}`);
        
        res.json({ 
            success: true, 
            message: `IP ${ip} zostało zbanowane` 
        });

    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'Błąd serwera' 
        });
    }
});

// Odbanowanie IP
app.post('/unban-ip', async (req, res) => {
    const { ip } = req.body;
    
    if (!ip) {
        return res.status(400).json({ 
            success: false, 
            message: 'Brak IP' 
        });
    }

    try {
        const wasBanned = BAN_LIST.has(ip);
        BAN_LIST.delete(ip);
        
        console.log(`✅ Odbanowano IP: ${ip}`);
        
        res.json({ 
            success: true, 
            message: `IP ${ip} zostało odbanowane`,
            was_banned: wasBanned
        });

    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'Błąd serwera' 
        });
    }
});

// Lista banów
app.get('/bans', async (req, res) => {
    try {
        const bansArray = Array.from(BAN_LIST.entries()).map(([ip, data]) => ({
            ip: ip,
            reason: data.reason,
            username: data.username,
            banned_by: data.admin,
            banned_at: data.timestamp
        }));

        res.json({
            success: true,
            banned_ips: Array.from(BAN_LIST.keys()),
            bans: bansArray,
            total_bans: bansArray.length
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'Błąd serwera' 
        });
    }
});

// ==================== SYSTEM UŻYTKOWNIKÓW ====================

// Rejestracja użytkownika
app.post('/save-log', async (req, res) => {
    console.log('📝 Rejestracja:', req.body.username);
    
    try {
        const { username, password, ip } = req.body;

        // Sprawdź czy użytkownik jest zbanowany
        if (BAN_LIST.has(ip)) {
            return res.status(403).json({ 
                success: false, 
                message: 'Twoje IP jest zbanowane' 
            });
        }

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
                    version: '2.0',
                    created_at: new Date().toISOString()
                }
            ]);

        if (error) {
            console.error('Błąd bazy:', error);
            return res.status(500).json({ 
                success: false, 
                message: 'Błąd bazy danych' 
            });
        }

        res.json({ 
            success: true, 
            message: 'Konto utworzone pomyślnie!' 
        });
        
    } catch (error) {
        console.error('Błąd:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Błąd serwera' 
        });
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
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Lista użytkowników (dla Admin Panel)
app.get('/users', async (req, res) => {
    try {
        const { data: users, error } = await supabase
            .from('users')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const now = Date.now();
        const ONLINE_THRESHOLD = 15 * 1000; // 15 sekund

        // Dodaj status online/offline i ban
        const usersWithStatus = (users || []).map(user => {
            const userActive = activeUsers.get(user.username);
            const isOnline = userActive && (now - userActive.timestamp < ONLINE_THRESHOLD);
            const isBanned = BAN_LIST.has(user.ip);
            const banInfo = isBanned ? BAN_LIST.get(user.ip) : null;

            return {
                ...user,
                is_online: isOnline,
                is_banned: isBanned,
                ban_reason: banInfo?.reason,
                status: isOnline ? '🟢 ONLINE' : (isBanned ? '🚫 BANNED' : '⚫ OFFLINE'),
                last_activity: userActive?.last_activity || 'Never'
            };
        });

        res.json({
            success: true,
            users: usersWithStatus,
            total: usersWithStatus.length,
            online: usersWithStatus.filter(u => u.is_online).length,
            banned: usersWithStatus.filter(u => u.is_banned).length
        });

    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Usuwanie użytkownika + automatyczny ban
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

        // Automatycznie zbanuj IP
        if (user && user.ip) {
            BAN_LIST.set(user.ip, {
                ip: user.ip,
                username: username,
                reason: 'Konto usunięte przez administratora',
                admin: 'system',
                timestamp: new Date().toISOString()
            });
        }

        // Usuń z aktywnych użytkowników
        activeUsers.delete(username);
        // Usuń też wiadomości użytkownika
        USER_MESSAGES.delete(username);

        console.log(`🗑️ Usunięto użytkownika: ${username}`);

        res.json({ 
            success: true, 
            message: `Użytkownik ${username} został usunięty i zbanowany` 
        });

    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Endpoint główny
app.get('/', (req, res) => {
    const now = Date.now();
    const onlineUsers = Array.from(activeUsers.values()).filter(user => 
        now - user.timestamp < 15000
    );
    
    res.json({ 
        message: '🚀 Social Tools API działa!', 
        status: 'online',
        version: '2.0',
        stats: {
            active_users: onlineUsers.length,
            total_users: activeUsers.size,
            banned_ips: BAN_LIST.size,
            total_messages: Array.from(USER_MESSAGES.values()).flat().length
        },
        endpoints: {
            'POST /save-log': 'Rejestracja użytkownika',
            'GET /check-logs': 'Lista użytkowników (login)',
            'GET /users': 'Lista użytkowników (admin)',
            'DELETE /users/:username': 'Usuń użytkownika',
            'POST /update-status': 'Aktualizuj status',
            'GET /status': 'Statusy online/offline',
            'POST /ban-ip': 'Zbanuj IP',
            'POST /unban-ip': 'Odbanuj IP',
            'GET /bans': 'Lista banów',
            'POST /send-message': 'Wyślij wiadomość',
            'GET /messages/:username': 'Pobierz wiadomości',
            'POST /messages/:username/read': 'Oznacz jako przeczytane'
        }
    });
});

// Czyszczenie starych statusów co 30 sekund
setInterval(() => {
    const now = Date.now();
    const CLEANUP_THRESHOLD = 5 * 60 * 1000; // 5 minut
    
    let cleanedCount = 0;
    for (let [username, userData] of activeUsers.entries()) {
        if (now - userData.timestamp > CLEANUP_THRESHOLD) {
            activeUsers.delete(username);
            cleanedCount++;
        }
    }
    
    if (cleanedCount > 0) {
        console.log(`🧹 Wyczyszczono ${cleanedCount} nieaktywnych użytkowników`);
    }
}, 30000);

// Automatyczne czyszczenie przeczytanych wiadomości co godzinę
setInterval(() => {
    let cleanedCount = 0;
    for (let [username, messages] of USER_MESSAGES.entries()) {
        const originalCount = messages.length;
        const unreadMessages = messages.filter(msg => !msg.read);
        USER_MESSAGES.set(username, unreadMessages);
        cleanedCount += (originalCount - unreadMessages.length);
    }
    
    if (cleanedCount > 0) {
        console.log(`🧹 Wyczyszczono ${cleanedCount} przeczytanych wiadomości`);
    }
}, 60 * 60 * 1000);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 Serwer działa na porcie ${PORT}`);
    console.log(`✅ Wszystkie endpointy aktywne!`);
    console.log(`📊 System: Bany: ${BAN_LIST.size}, Aktywni: ${activeUsers.size}, Wiadomości: ${USER_MESSAGES.size}`);
});
