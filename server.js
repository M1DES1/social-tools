const express = require('express');
const Client = require('ssh2-sftp-client');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Funkcja do sprawdzania czy użytkownik istnieje (sprawdza czy jest plik)
async function checkIfUserExists(username) {
    const sftp = new Client();
    
    try {
        await sftp.connect({
            host: 'eu9r-free.falixserver.net',
            port: 4483,
            username: '7vadveg.75387402',
            password: 'vVftg4ynf'
        });

        const userFilePath = `/users_socialtool/users/${username}.txt`;
        
        try {
            // Spróbuj pobrać plik użytkownika - jeśli istnieje to znaczy że użytkownik jest zajęty
            await sftp.get(userFilePath);
            await sftp.end();
            return true;
        } catch (error) {
            // Plik nie istnieje - użytkownik dostępny
            await sftp.end();
            return false;
        }

    } catch (error) {
        console.error('Błąd przy sprawdzaniu użytkownika:', error);
        return false;
    }
}

// Funkcja do zapisywania logu do osobnego pliku użytkownika
async function saveLogToUserFile(username, password, ip) {
    const sftp = new Client();

    try {
        await sftp.connect({
            host: 'eu9r-free.falixserver.net',
            port: 4483,
            username: '7vadveg.75387402',
            password: 'vVftg4ynf'
        });

        const userDir = '/users_socialtool/users';
        const userFilePath = `${userDir}/${username}.txt`;
        
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
        const logEntry = `${timestamp} | User: ${username}| Password: ${password} | IP: ${ip} | Version: 2.0\n`;

        console.log('Ścieżka pliku użytkownika:', userFilePath);
        console.log('Log entry:', logEntry);

        // Sprawdź czy katalog users istnieje, jeśli nie - utwórz
        try {
            await sftp.stat(userDir);
        } catch (error) {
            console.log('Katalog users nie istnieje, tworzę...');
            await sftp.mkdir(userDir, true);
        }

        // Sprawdź czy plik użytkownika istnieje
        let existingContent = '';
        try {
            const fileContent = await sftp.get(userFilePath);
            existingContent = fileContent.toString();
            console.log('Istniejąca zawartość pliku:', existingContent);
        } catch (error) {
            console.log('Plik użytkownika nie istnieje, tworzę nowy...');
            existingContent = '';
        }

        // Dodaj nowy log do pliku użytkownika
        let newContent;
        if (existingContent.trim() === '') {
            newContent = logEntry;
        } else {
            if (!existingContent.endsWith('\n')) {
                existingContent += '\n';
            }
            newContent = existingContent + logEntry;
        }

        console.log('Zapisywanie do pliku użytkownika...');
        await sftp.put(Buffer.from(newContent), userFilePath);
        
        await sftp.end();
        console.log('✅ Pomyślnie zapisano log do pliku użytkownika:', username);
        return true;

    } catch (error) {
        console.error('❌ Błąd SFTP przy zapisie do pliku użytkownika:', error);
        return false;
    }
}

// Funkcja do zapisywania do głównego pliku logów (dla kompatybilności)
async function saveToMainLog(username, password, ip) {
    const sftp = new Client();

    try {
        await sftp.connect({
            host: 'eu9r-free.falixserver.net',
            port: 4483,
            username: '7vadveg.75387402',
            password: 'vVftg4ynf'
        });

        const mainLogPath = '/users_socialtool/user_logs.txt';
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
        const logEntry = `${timestamp} | User: ${username}| Password: ${password} | IP: ${ip} | Version: 2.0\n`;

        let existingContent = '';
        try {
            const fileContent = await sftp.get(mainLogPath);
            existingContent = fileContent.toString();
        } catch (error) {
            console.log('Główny plik logów nie istnieje, tworzę...');
            existingContent = '';
        }

        let newContent;
        if (existingContent.trim() === '') {
            newContent = logEntry;
        } else {
            if (!existingContent.endsWith('\n')) {
                existingContent += '\n';
            }
            newContent = existingContent + logEntry;
        }

        await sftp.put(Buffer.from(newContent), mainLogPath);
        await sftp.end();
        console.log('✅ Zapisano do głównego logu');
        return true;

    } catch (error) {
        console.error('❌ Błąd przy zapisie do głównego logu:', error);
        return false;
    }
}

app.post('/save-log', async (req, res) => {
    console.log('=== NOWA REJESTRACJA ===');
    console.log('Otrzymano żądanie:', req.body);
    
    const { username, password, ip } = req.body;
    
    if (!username || !password) {
        return res.json({ success: false, message: 'Brak danych' });
    }

    // Walidacja nazwy użytkownika (nie może zawierać znaków specjalnych)
    const validUsername = /^[a-zA-Z0-9_]+$/.test(username);
    if (!validUsername) {
        return res.json({ success: false, message: 'Nazwa użytkownika może zawierać tylko litery, cyfry i podkreślenia' });
    }

    // Sprawdź czy użytkownik już istnieje
    console.log('Sprawdzanie czy użytkownik istnieje...');
    const userExists = await checkIfUserExists(username);
    if (userExists) {
        console.log('❌ Użytkownik już istnieje:', username);
        return res.json({ success: false, message: 'Nazwa użytkownika jest już zajęta' });
    }

    console.log('✅ Użytkownik nie istnieje, tworzenie pliku...');

    // Zapisz do pliku użytkownika
    console.log('Zapisywanie do pliku użytkownika...');
    const saveResult = await saveLogToUserFile(username, password, ip);

    // Również zapisz do głównego logu (opcjonalnie)
    await saveToMainLog(username, password, ip);

    if (saveResult) {
        console.log('🎉 Rejestracja udana dla:', username);
        res.json({ 
            success: true, 
            message: 'Rejestracja udana!' 
        });
    } else {
        console.log('💥 Błąd rejestracji dla:', username);
        res.json({ success: false, message: 'Błąd podczas rejestracji' });
    }
    
    console.log('=== KONIEC REJESTRACJI ===');
});

app.get('/', (req, res) => {
    res.json({ message: 'SFTP Logger API działa!', status: 'online' });
});

// Funkcja do listowania wszystkich użytkowników
app.get('/list-users', async (req, res) => {
    console.log('=== LISTOWANIE UŻYTKOWNIKÓW ===');
    const sftp = new Client();
    
    try {
        await sftp.connect({
            host: 'eu9r-free.falixserver.net',
            port: 4483,
            username: '7vadveg.75387402',
            password: 'vVftg4ynf'
        });

        const userDir = '/users_socialtool/users';
        
        try {
            const files = await sftp.list(userDir);
            const userFiles = files.filter(file => file.name.endsWith('.txt'));
            
            console.log('Znalezione pliki użytkowników:', userFiles.map(f => f.name));
            
            await sftp.end();
            
            res.json({ 
                success: true, 
                users: userFiles.map(file => file.name.replace('.txt', '')),
                totalUsers: userFiles.length,
                files: userFiles
            });
        } catch (error) {
            console.log('Katalog users nie istnieje lub jest pusty');
            await sftp.end();
            res.json({ 
                success: true, 
                users: [],
                totalUsers: 0,
                message: 'Brak zarejestrowanych użytkowników'
            });
        }

    } catch (error) {
        console.error('Błąd:', error);
        res.json({ success: false, error: error.message });
    }
});

// Funkcja do podglądu pliku konkretnego użytkownika
app.get('/view-user/:username', async (req, res) => {
    const username = req.params.username;
    console.log('=== PODGLĄD UŻYTKOWNIKA ===', username);
    
    const sftp = new Client();
    
    try {
        await sftp.connect({
            host: 'eu9r-free.falixserver.net',
            port: 4483,
            username: '7vadveg.75387402',
            password: 'vVftg4ynf'
        });

        const userFilePath = `/users_socialtool/users/${username}.txt`;
        
        try {
            const fileContent = await sftp.get(userFilePath);
            const logs = fileContent.toString();
            
            await sftp.end();
            
            res.set('Content-Type', 'text/plain');
            res.send(`=== PLIK UŻYTKOWNIKA: ${username} ===\n\n${logs}\n\n=== KONIEC PLIKU ===`);
        } catch (error) {
            await sftp.end();
            res.set('Content-Type', 'text/plain');
            res.send(`=== UŻYTKOWNIK ${username} NIE ISTNIEJE ===`);
        }

    } catch (error) {
        console.error('Błąd:', error);
        res.set('Content-Type', 'text/plain');
        res.send('Błąd: ' + error.message);
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Endpoints:`);
    console.log(`   GET  / - Status API`);
    console.log(`   POST /save-log - Rejestracja użytkownika`);
    console.log(`   GET  /list-users - Lista wszystkich użytkowników`);
    console.log(`   GET  /view-user/:username - Podgląd pliku użytkownika`);
});
