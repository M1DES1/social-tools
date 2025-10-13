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
        
        // Sprawdź czy plik istnieje
        try {
            const fileContent = await sftp.get(remotePath);
            const logs = fileContent.toString();
            
            // Sprawdź czy username już istnieje w logach
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

// Funkcja do zapisywania logu
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
        await sftp.append(Buffer.from(logEntry), remotePath);
        
        await sftp.end();
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

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
