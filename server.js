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

// Funkcja do zapisywania logu (POPRAWIONA - używa append)
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
        
        // SPRAWDŹ CZY PLIK ISTNIEJE - jeśli nie, utwórz go
        try {
            await sftp.get(remotePath);
        } catch (error) {
            // Plik nie istnieje - utwórz pusty plik
            console.log('Tworzę nowy plik...');
            await sftp.put(Buffer.from(''), remotePath);
        }

        // DODAJ NOWĄ LINIĘ NA KONIEC PLIKU
        await sftp.append(Buffer.from(logEntry), remotePath);
        
        await sftp.end();
        console.log('Dodano nowy log:', logEntry);
        return true;

    } catch (error) {
        console.error('Błąd SFTP:', error);
        return false;
    }
}

// Funkcja do znajdowania wolnej linii
async function findAvailableLine() {
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
            
            // Znajdź pierwszą pustą linię lub zwróć koniec pliku
            if (lines.length === 0) {
                return 1; // Pierwsza linia
            }
            
            // Sprawdź czy ostatnia linia jest pusta
            const lastLine = lines[lines.length - 1];
            if (!lastLine.trim()) {
                return lines.length;
            }
            
            // Zwróć następną linię po ostatniej
            return lines.length + 1;
            
        } catch (error) {
            // Plik nie istnieje - pierwsza linia
            await sftp.end();
            return 1;
        }

    } catch (error) {
        console.error('Błąd przy szukaniu wolnej linii:', error);
        return 1;
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

    // Znajdź wolną linię (dla debugowania)
    const availableLine = await findAvailableLine();
    console.log(`Wolna linia: ${availableLine}`);

    // Zapisz do SFTP
    const saveResult = await saveLogToSFTP(logEntry);

    if (saveResult) {
        res.json({ 
            success: true, 
            message: 'Rejestracja udana!',
            line: availableLine 
        });
    } else {
        res.json({ success: false, message: 'Błąd podczas rejestracji' });
    }
});

app.get('/', (req, res) => {
    res.json({ message: 'SFTP Logger API działa!', status: 'online' });
});

// Funkcja do sprawdzania zawartości pliku
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
            const lines = logs.split('\n').filter(line => line.trim());
            
            await sftp.end();
            
            res.json({ 
                success: true, 
                logs: logs,
                lines: lines,
                totalLines: lines.length,
                fileInfo: `Plik zawiera ${lines.length} wpisów`
            });
        } catch (error) {
            await sftp.end();
            res.json({ success: false, error: 'Plik nie istnieje lub jest pusty' });
        }

    } catch (error) {
        console.error('Błąd:', error);
        res.json({ success: false, error: error.message });
    }
});

// Funkcja do czyszczenia pliku (TYLKO DO TESTOW)
app.delete('/clear-logs', async (req, res) => {
    const sftp = new Client();
    
    try {
        await sftp.connect({
            host: 'eu9r-free.falixserver.net',
            port: 4483,
            username: '7vadveg.75387402',
            password: 'vVftg4ynf'
        });

        const remotePath = '/users_socialtool/user_logs.txt';
        await sftp.put(Buffer.from(''), remotePath);
        
        await sftp.end();
        res.json({ success: true, message: 'Plik wyczyszczony' });
    } catch (error) {
        console.error('Błąd:', error);
        res.json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
