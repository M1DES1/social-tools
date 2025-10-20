const express = require('express');
const Client = require('ssh2-sftp-client');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Funkcja do sprawdzania czy użytkownik istnieje
async function checkIfUserExists(username) {
    const sftp = new Client();
    
    try {
        await sftp.connect({
            host: 'eu9r-free.falixserver.net',
            port: 2022,
            username: '7vadveg.75387402',
            password: 'vVftg4ynf'
        });

        const remotePath = '/users_socialtool/user_logs.txt';
        
        try {
            const fileContent = await sftp.get(remotePath);
            const logs = fileContent.toString();
            
            // Sprawdź każdą linię czy zawiera username
            const lines = logs.split('\n').filter(line => line.trim());
            for (const line of lines) {
                if (line.includes(`User: ${username}|`)) {
                    await sftp.end();
                    return true;
                }
            }
            
            await sftp.end();
            return false;
        } catch (error) {
            // Plik nie istnieje - pierwszy użytkownik
            await sftp.end();
            return false;
        }

    } catch (error) {
        console.error('Błąd przy sprawdzaniu użytkownika:', error);
        return false;
    }
}

// Funkcja do sprawdzania czy IP ma już konto
async function checkIfIPExists(ip) {
    const sftp = new Client();
    
    try {
        await sftp.connect({
            host: 'eu9r-free.falixserver.net',
            port: 2022,
            username: '7vadveg.75387402',
            password: 'vVftg4ynf'
        });

        const remotePath = '/users_socialtool/user_logs.txt';
        
        try {
            const fileContent = await sftp.get(remotePath);
            const logs = fileContent.toString();
            
            // Sprawdź każdą linię czy zawiera to IP
            const lines = logs.split('\n').filter(line => line.trim());
            for (const line of lines) {
                if (line.includes(`IP: ${ip} `)) {
                    await sftp.end();
                    return true;
                }
            }
            
            await sftp.end();
            return false;
        } catch (error) {
            // Plik nie istnieje - pierwsze IP
            await sftp.end();
            return false;
        }

    } catch (error) {
        console.error('Błąd przy sprawdzaniu IP:', error);
        return false;
    }
}

// Funkcja do zapisywania logu - DODAJE NOWĄ LINIĘ
async function saveLogToSFTP(logEntry) {
    const sftp = new Client();

    try {
        await sftp.connect({
            host: 'eu9r-free.falixserver.net',
            port: 2022,
            username: '7vadveg.75387402',
            password: 'vVftg4ynf'
        });

        const remotePath = '/users_socialtool/user_logs.txt';
        
        let existingContent = '';
        
        // 1. Pobierz istniejący plik
        try {
            const fileContent = await sftp.get(remotePath);
            existingContent = fileContent.toString();
            console.log('📄 Istniejąca zawartość:', existingContent);
        } catch (error) {
            // Plik nie istnieje - zaczynamy od pustego
            console.log('📄 Plik nie istnieje, tworzę nowy...');
            existingContent = '';
        }

        // 2. Dodaj nową linię do istniejącej zawartości
        let newContent;
        if (existingContent.trim() === '') {
            // Jeśli plik jest pusty - dodaj pierwszą linię
            newContent = logEntry;
        } else {
            // Jeśli plik ma już dane - dodaj nową linię na końcu
            // Upewnij się że ostatnia linia ma znak nowej linii
            if (!existingContent.endsWith('\n')) {
                existingContent += '\n';
            }
            newContent = existingContent + logEntry;
        }

        console.log('💾 Nowa zawartość do zapisania:', newContent);
        
        // 3. Zapisz cały plik z dodaną nową linią
        await sftp.put(Buffer.from(newContent), remotePath);
        
        await sftp.end();
        console.log('✅ Pomyślnie dodano nowy log:', logEntry.trim());
        return true;

    } catch (error) {
        console.error('❌ Błąd SFTP:', error);
        return false;
    }
}

app.post('/save-log', async (req, res) => {
    console.log('=== 🆕 NOWA REJESTRACJA ===');
    console.log('📨 Otrzymano żądanie:', req.body);
    
    const { username, password, ip } = req.body;
    
    if (!username || !password) {
        return res.json({ success: false, message: 'Brak danych' });
    }

    // Sprawdź czy użytkownik już istnieje
    console.log('🔍 Sprawdzanie czy użytkownik istnieje...');
    const userExists = await checkIfUserExists(username);
    if (userExists) {
        console.log('❌ Użytkownik już istnieje:', username);
        return res.json({ success: false, message: 'Nazwa użytkownika jest już zajęta' });
    }

    // Sprawdź czy IP ma już konto
    console.log('🔍 Sprawdzanie czy IP ma już konto...');
    const ipExists = await checkIfIPExists(ip);
    if (ipExists) {
        console.log('❌ IP ma już konto:', ip);
        return res.json({ success: false, message: 'Za dużo użytkowników zostało zarejestrowanych na tym IP' });
    }

    console.log('✅ Użytkownik i IP są dostępne, tworzenie logu...');
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const logEntry = `${timestamp} | User: ${username}| Password: ${password} | IP: ${ip} | Version: 2.0\n`;

    console.log('📝 Nowy log:', logEntry);

    // Zapisz do SFTP
    console.log('💾 Zapisywanie do SFTP...');
    const saveResult = await saveLogToSFTP(logEntry);

    if (saveResult) {
        console.log('🎉 Rejestracja udana dla:', username, 'z IP:', ip);
        res.json({ 
            success: true, 
            message: 'Rejestracja udana!' 
        });
    } else {
        console.log('💥 Błąd rejestracji dla:', username);
        res.json({ success: false, message: 'Błąd podczas rejestracji' });
    }
    
    console.log('=== ✅ KONIEC REJESTRACJI ===\n');
});

app.get('/', (req, res) => {
    res.json({ 
        message: 'SFTP Logger API działa!', 
        status: 'online',
        endpoints: {
            'POST /save-log': 'Rejestracja użytkownika',
            'GET /check-logs': 'Sprawdź logi (JSON)',
            'GET /view-file': 'Zobacz plik (tekst)',
            'GET /check-user/:username': 'Sprawdź czy użytkownik istnieje',
            'GET /check-ip/:ip': 'Sprawdź czy IP ma konto'
        }
    });
});

// Funkcja do sprawdzania zawartości pliku
app.get('/check-logs', async (req, res) => {
    console.log('=== 📊 SPRAWDZANIE LOGÓW ===');
    const sftp = new Client();
    
    try {
        await sftp.connect({
            host: 'eu9r-free.falixserver.net',
            port: 4483,
            username: '7vadveg.75387402',
            password: 'vVftg4ynf'
        });

        const remotePath = '/users_socialtool/user_logs.txt';
        
        try {
            const fileContent = await sftp.get(remotePath);
            const logs = fileContent.toString();
            const lines = logs.split('\n').filter(line => line.trim());
            
            await sftp.end();
            
            console.log('📋 Znalezione linie:', lines);
            
            res.json({ 
                success: true, 
                logs: logs,
                lines: lines,
                totalLines: lines.length,
                fileInfo: `Plik zawiera ${lines.length} wpisów`,
                rawContent: logs
            });
        } catch (error) {
            console.log('📭 Plik nie istnieje lub jest pusty');
            await sftp.end();
            res.json({ 
                success: false, 
                error: 'Plik nie istnieje lub jest pusty',
                lines: [],
                totalLines: 0
            });
        }

    } catch (error) {
        console.error('❌ Błąd:', error);
        res.json({ success: false, error: error.message });
    }
});

// Funkcja do wyświetlenia pełnej zawartości pliku
app.get('/view-file', async (req, res) => {
    const sftp = new Client();
    
    try {
        await sftp.connect({
            host: 'eu9r-free.falixserver.net',
            port: 2022,
            username: '7vadveg.75387402',
            password: 'vVftg4ynf'
        });

        const remotePath = '/users_socialtool/user_logs.txt';
        
        try {
            const fileContent = await sftp.get(remotePath);
            const logs = fileContent.toString();
            
            await sftp.end();
            
            // Zwróć jako tekst do łatwego przeglądania
            res.set('Content-Type', 'text/plain');
            res.send(`=== ZAWARTOŚĆ PLIKU user_logs.txt ===\n\n${logs}\n\n=== KONIEC PLIKU ===\nLiczba znaków: ${logs.length}\nLiczba linii: ${logs.split('\n').length}`);
        } catch (error) {
            await sftp.end();
            res.set('Content-Type', 'text/plain');
            res.send('=== PLIK JEST PUSTY LUB NIE ISTNIEJE ===');
        }

    } catch (error) {
        console.error('❌ Błąd:', error);
        res.set('Content-Type', 'text/plain');
        res.send('Błąd: ' + error.message);
    }
});

// Funkcja do sprawdzenia czy konkretny użytkownik istnieje
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

// Funkcja do sprawdzenia czy IP ma już konto
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

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Dostępne endpointy:`);
    console.log(`   GET  / - Status API`);
    console.log(`   POST /save-log - Rejestracja użytkownika`);
    console.log(`   GET  /check-logs - Sprawdź logi (JSON)`);
    console.log(`   GET  /view-file - Zobacz plik (tekst)`);
    console.log(`   GET  /check-user/:username - Sprawdź użytkownika`);
    console.log(`   GET  /check-ip/:ip - Sprawdź czy IP ma konto`);
});


