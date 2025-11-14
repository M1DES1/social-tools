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
        // Weryfikacja z backendem
        const usersResponse = await fetch('https://social-tools.onrender.com/check-logs');
        const usersData = await usersResponse.json();
        
        if (usersData.success) {
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
            showMessage('❌ Błąd połączenia z serwerem', 'error');
        }
    } catch (error) {
        console.error('💥 Błąd:', error);
        showMessage('❌ Wystąpił błąd podczas logowania', 'error');
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