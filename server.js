const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
require('dotenv').config();

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

// KONFIGURACJA MYSQL AIVEN
const dbConfig = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: {
        rejectUnauthorized: false
    },
    connectTimeout: 60000,
    charset: 'utf8mb4'
};

// FUNKCJA DO POŁĄCZENIA Z BAZĄ
async function getConnection() {
    try {
        console.log('🔄 Próba połączenia z MySQL...');
        const connection = await mysql.createConnection(dbConfig);
        console.log('✅ Połączono z MySQL Aiven');
        return connection;
    } catch (error) {
        console.error('❌ BŁĄD POŁĄCZENIA MYSQL:', error.message);
        throw error;
    }
}

// SYSTEM W PAMIĘCI
const activeUsers = new Map();
const BAN_LIST = new Map();
const USER_MESSAGES = new Map();

// INICJALIZACJA BAZY DANYCH
async function initializeDatabase() {
    let connection;
    try {
        console.log('🔄 Inicjalizacja bazy danych...');
        connection = await getConnection();
        
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                ip VARCHAR(45),
                version VARCHAR(50) DEFAULT '2.0',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP NULL,
                status VARCHAR(50) DEFAULT 'offline'
            )
        `);
        
        console.log('✅ Tabela users gotowa');
        await connection.end();
    } catch (error) {
        console.error('❌ Błąd inicjalizacji bazy danych:', error.message);
        if (connection) await connection.end();
    }
}

// ==================== SYSTEM WIADOMOŚCI ====================

app.post('/send-message', async (req, res) => {
    const { to_username, message, title, from_admin } = req.body;
    
    console.log(`📨 Próba wysłania wiadomości do: ${to_username}`);
    
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

app.get('/messages/:username', async (req, res) => {
    const username = req.params.username;
    
    console.log(`📥 Pobieranie wiadomości dla: ${username}`);
    
    try {
        const userMessages = USER_MESSAGES.get(username) || [];
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

app.post('/messages/:username/read', async (req, res) => {
    const username = req.params.username;
    const { message_id } = req.body;
    
    try {
        const userMessages = USER_MESSAGES.get(username) || [];
        const messageIndex = userMessages.findIndex(msg => msg.id === message_id);
        
        if (messageIndex !== -1) {
            userMessages[messageIndex].read = true;
            console.log(`✅ Oznaczono wiadomość ${message_id} jako przeczytaną dla ${username}`);
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Błąd oznaczania wiadomości:', error);
        res.status(500).json({ success: false, message: 'Błąd serwera' });
    }
});

app.delete('/messages/:username/cleanup', async (req, res) => {
    const username = req.params.username;
    
    try {
        if (USER_MESSAGES.has(username)) {
            const userMessages = USER_MESSAGES.get(username);
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

app.post('/update-status', async (req, res) => {
    const { username, ip, status, version } = req.body;
    
    if (!username || !ip) {
        return res.status(400).json({ 
            success: false, 
            message: 'Brak wymaganych danych' 
        });
    }

    try {
        // SPRAWDŹ BANY
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

        // Sprawdź czy użytkownik istnieje w bazie MySQL
        const connection = await getConnection();
        const [users] = await connection.execute(
            'SELECT username FROM users WHERE username = ?',
            [username]
        );
        await connection.end();

        if (users.length === 0) {
            console.log(`🗑️ Konto usunięte: ${username}`);
            return res.json({ 
                success: false, 
                message: '🗑️ KONTO USUNIĘTE przez administratora', 
                banned: true 
            });
        }

        // Aktualizuj status
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

app.get('/status', async (req, res) => {
    try {
        const now = Date.now();
        const OFFLINE_THRESHOLD = 15 * 1000;
        
        for (let [username, userData] of activeUsers.entries()) {
            if (now - userData.timestamp > OFFLINE_THRESHOLD) {
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

        const connection = await getConnection();

        // Sprawdź czy użytkownik istnieje
        const [existingUsers] = await connection.execute(
            'SELECT username FROM users WHERE username = ?',
            [username]
        );

        if (existingUsers.length > 0) {
            await connection.end();
            return res.status(409).json({ 
                success: false, 
                message: 'Ta nazwa użytkownika jest już zajęta' 
            });
        }

        // Dodaj użytkownika
        await connection.execute(
            'INSERT INTO users (username, password, ip, version, created_at) VALUES (?, ?, ?, ?, ?)',
            [username, password, ip, '2.0', new Date().toISOString()]
        );

        await connection.end();

        console.log('✅ Użytkownik zarejestrowany:', username);
        
        res.json({ 
            success: true, 
            message: 'Konto utworzone pomyślnie!' 
        });
        
    } catch (error) {
        console.error('💥 Błąd rejestracji:', error.message);
        res.status(500).json({ 
            success: false, 
            message: 'Błąd połączenia z bazą danych' 
        });
    }
});

app.get('/check-logs', async (req, res) => {
    try {
        const connection = await getConnection();
        const [users] = await connection.execute('SELECT * FROM users');
        await connection.end();

        res.json({ 
            success: true, 
            users: users || [] 
        });
    } catch (error) {
        console.error('Błąd check-logs:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

app.get('/users', async (req, res) => {
    try {
        const connection = await getConnection();
        const [users] = await connection.execute(
            'SELECT * FROM users ORDER BY created_at DESC'
        );
        await connection.end();

        const now = Date.now();
        const ONLINE_THRESHOLD = 15 * 1000;

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
        console.error('Błąd users:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

app.delete('/users/:username', async (req, res) => {
    const username = req.params.username;
    
    try {
        const connection = await getConnection();

        // Znajdź użytkownika aby pobrać IP
        const [users] = await connection.execute(
            'SELECT ip FROM users WHERE username = ?',
            [username]
        );

        if (users.length === 0) {
            await connection.end();
            return res.status(404).json({ 
                success: false, 
                message: 'Użytkownik nie znaleziony' 
            });
        }

        const userIP = users[0].ip;

        // Usuń użytkownika
        await connection.execute(
            'DELETE FROM users WHERE username = ?',
            [username]
        );

        await connection.end();

        // Automatycznie zbanuj IP
        if (userIP) {
            BAN_LIST.set(userIP, {
                ip: userIP,
                username: username,
                reason: 'Konto usunięte przez administratora',
                admin: 'system',
                timestamp: new Date().toISOString()
            });
        }

        // Usuń z aktywnych użytkowników
        activeUsers.delete(username);
        USER_MESSAGES.delete(username);

        console.log(`🗑️ Usunięto użytkownika: ${username}`);

        res.json({ 
            success: true, 
            message: `Użytkownik ${username} został usunięty i zbanowany` 
        });

    } catch (error) {
        console.error('Błąd usuwania użytkownika:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// TEST ENDPOINT DLA BAZY DANYCH
app.get('/test-db', async (req, res) => {
    try {
        const connection = await getConnection();
        const [rows] = await connection.execute('SELECT NOW() as current_time');
        await connection.end();
        
        res.json({ 
            success: true, 
            message: 'Database connection OK',
            time: rows[0].current_time
        });
    } catch (error) {
        res.json({ 
            success: false, 
            message: 'Database connection FAILED',
            error: error.message 
        });
    }
});

// HEALTH CHECK
app.get('/health', async (req, res) => {
    try {
        const connection = await getConnection();
        const [result] = await connection.execute('SELECT 1 as test');
        await connection.end();
        
        res.json({ 
            success: true, 
            message: 'Database connected',
            database: 'OK',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.json({ 
            success: false, 
            message: 'Database connection failed',
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
        message: '🚀 Social Tools API z MySQL działa!', 
        status: 'online',
        version: '2.0',
        database: 'MySQL Aiven',
        stats: {
            active_users: onlineUsers.length,
            total_users: activeUsers.size,
            banned_ips: BAN_LIST.size,
            total_messages: Array.from(USER_MESSAGES.values()).flat().length
        },
        endpoints: {
            'GET /health': 'Health check bazy danych',
            'GET /test-db': 'Test połączenia z bazą',
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

// Czyszczenie starych statusów
setInterval(() => {
    const now = Date.now();
    const CLEANUP_THRESHOLD = 5 * 60 * 1000;
    
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

// Automatyczne czyszczenie przeczytanych wiadomości
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

// URUCHOMIENIE SERWERA
const PORT = process.env.PORT || 10000;

async function startServer() {
    console.log('🚀 Uruchamianie serwera...');
    console.log('📊 Konfiguracja bazy:', {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        database: process.env.DB_NAME
    });
    
    await initializeDatabase();
    
    app.listen(PORT, () => {
        console.log(`🎉 Serwer działa na porcie ${PORT}`);
        console.log(`📊 System: Bany: ${BAN_LIST.size}, Aktywni: ${activeUsers.size}`);
    });
}

startServer().catch(console.error);
