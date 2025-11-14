// login.js - UPDATED WITH BETTER ERROR HANDLING
document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    if (!username || !password) {
        showMessage('Proszę wypełnić wszystkie pola', 'error');
        return;
    }

    showLoading(true);
    showMessage('', '');

    try {
        console.log('🔐 Próba logowania:', username);
        
        // Weryfikacja z backendem
        const usersResponse = await fetch('https://social-tools.onrender.com/check-logs');
        
        console.log('📩 Status odpowiedzi:', usersResponse.status);

        let usersData;
        try {
            usersData = await usersResponse.json();
        } catch (jsonError) {
            console.error('❌ Błąd parsowania JSON:', jsonError);
            throw new Error('Serwer zwrócił nieprawidłową odpowiedź');
        }
        
        console.log('📊 Dane użytkowników:', usersData);
        
        if (usersData && usersData.success) {
            const userExists = usersData.users.find(user => 
                user.username === username && user.password === password
            );
            
            if (userExists) {
                showMessage('🎉 Logowanie udane!', 'success');
                localStorage.setItem('currentUser', username);
                setTimeout(() => {
                    window.location.href = 'download.html';
                }, 1500);
            } else {
                showMessage('❌ Nieprawidłowa nazwa użytkownika lub hasło', 'error');
            }
        } else {
            const errorMsg = usersData ? usersData.message : 'Błąd połączenia z serwerem';
            showMessage('❌ ' + errorMsg, 'error');
        }
    } catch (error) {
        console.error('💥 Błąd logowania:', error);
        showMessage('❌ Błąd: ' + error.message, 'error');
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
