const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const app = express();

app.use(cors());
app.use(express.json());

// Konfiguracja Supabase z Twoimi danymi
const supabaseUrl = 'https://kazlfzeinvzpyywpilkk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthemxmemVpbnZ6cHl5d3BpbGtrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxMjYzNzgsImV4cCI6MjA3ODcwMjM3OH0.BvquQ7gTnvwllXzg60sYdXXpQqmM_O5bkxoh5S8Bn3Q';
const supabase = createClient(supabaseUrl, supabaseKey);

// Funkcja do sprawdzania czy użytkownik istnieje
async function checkIfUserExists(username) {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('username')
            .eq('username', username)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
            console.error('Błąd przy sprawdzaniu użytkownika:', error);
            return false;
        }

        return !!data; // zwraca true jeśli użytkownik istnieje
    } catch (error) {
        console.error('Błąd przy sprawdzaniu użytkownika:', error);
        return false;
    }
}

// Funkcja do sprawdzania czy IP ma już konto
async function checkIfIPExists(ip) {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('ip')
            .eq('ip', ip)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('Błąd przy sprawdzaniu IP:', error);
            return false;
        }

        return !!data; // zwraca true jeśli IP ma konto
    } catch (error) {
        console.error('Błąd przy sprawdzaniu IP:', error);
        return false;
    }
}

// Funkcja do zapisywania użytkownika
async function saveUserToDatabase(username, password, ip) {
    try {
        const { data, error } = await supabase
            .from('users')
            .insert([
                {
                    username: username,
                    password: password,
                    ip: ip,
                    version: '2.0',
                    created_at: new Date().toISOString()
                }
            ])
            .select();

        if (error) {
            console.error('Błąd zapisu do bazy:', error);
            return false;
        }

        console.log('✅ Pomyślnie dodano użytkownika:', data);
        return true;
    } catch (error) {
        console.error('❌ Błąd zapisu:', error);
        return false;
    }
}

// Główna endpoint do rejestracji
app.post('/save-log', async (req, res) => {
    console.log('=== 🆕 NOWA REJESTRACJA ===');
    console.log('📨 Otrzymano żądanie:', req.body);
    
    const { username, password, ip } = req.body;
    
    if (!username || !password) {
        return res.json({ success: false, message: 'Brak danych' });
    }

    // Sprawdź czy użytkownik już istnieje
    console.log('🔍 Sprawdzanie czy użytkownik istnieje...');
    const userExists = await checkIfUserExists(username);
    if (userExists) {
        console.log('❌ Użytkownik już istnieje:', username);
        return res.json({ success: false, message: 'Nazwa użytkownika jest już zajęta' });
    }

    // Sprawdź czy IP ma już konto
    console.log('🔍 Sprawdzanie czy IP ma już konto...');
    const ipExists = await checkIfIPExists(ip);
    if (ipExists) {
        console.log('❌ IP ma już konto:', ip);
        return res.json({ success: false, message: 'Za dużo użytkowników zostało zarejestrowanych na tym IP' });
    }

    console.log('✅ Użytkownik i IP są dostępne, zapisywanie do bazy...');

    // Zapisz do bazy danych
    console.log('💾 Zapisywanie do Supabase...');
    const saveResult = await saveUserToDatabase(username, password, ip);

    if (saveResult) {
        console.log('🎉 Rejestracja udana dla:', username, 'z IP:', ip);
        res.json({ 
            success: true, 
            message: 'Rejestracja udana!' 
        });
    } else {
        console.log('💥 Błąd rejestracji dla:', username);
        res.json({ success: false, message: 'Błąd podczas rejestracji' });
    }
    
    console.log('=== ✅ KONIEC REJESTRACJI ===\n');
});

// Endpoint do sprawdzania wszystkich użytkowników
app.get('/check-logs', async (req, res) => {
    console.log('=== 📊 SPRAWDZANIE UŻYTKOWNIKÓW ===');
    
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Błąd:', error);
            return res.json({ success: false, error: error.message });
        }

        console.log('📋 Znalezionych użytkowników:', data?.length || 0);
        
        res.json({ 
            success: true, 
            users: data || [],
            totalUsers: data?.length || 0,
            message: `Znaleziono ${data?.length || 0} użytkowników`
        });

    } catch (error) {
        console.error('❌ Błąd:', error);
        res.json({ success: false, error: error.message });
    }
});

// Endpoint do sprawdzania konkretnego użytkownika
app.get('/check-user/:username', async (req, res) => {
    const username = req.params.username;
    console.log(`🔍 Sprawdzanie użytkownika: ${username}`);
    
    const userExists = await checkIfUserExists(username);
    
    res.json({
        username: username,
        exists: userExists,
        message: userExists ? 'Użytkownik istnieje' : 'Użytkownik nie istnieje'
    });
});

// Endpoint do sprawdzania IP
app.get('/check-ip/:ip', async (req, res) => {
    const ip = req.params.ip;
    console.log(`🔍 Sprawdzanie IP: ${ip}`);
    
    const ipExists = await checkIfIPExists(ip);
    
    res.json({
        ip: ip,
        hasAccount: ipExists,
        message: ipExists ? 'IP ma już konto' : 'IP nie ma konta'
    });
});

// Endpoint do usuwania użytkownika (przydatne do testów)
app.delete('/delete-user/:username', async (req, res) => {
    const username = req.params.username;
    console.log(`🗑️ Usuwanie użytkownika: ${username}`);
    
    try {
        const { error } = await supabase
            .from('users')
            .delete()
            .eq('username', username);

        if (error) {
            console.error('Błąd usuwania:', error);
            return res.json({ success: false, error: error.message });
        }

        res.json({
            success: true,
            message: `Użytkownik ${username} został usunięty`
        });
    } catch (error) {
        console.error('❌ Błąd:', error);
        res.json({ success: false, error: error.message });
    }
});

// Endpoint główny
app.get('/', (req, res) => {
    res.json({ 
        message: 'Supabase Logger API działa!', 
        status: 'online',
        database: 'Supabase PostgreSQL',
        project: 'kazlfzeinvzpyywpilkk',
        endpoints: {
            'POST /save-log': 'Rejestracja użytkownika',
            'GET /check-logs': 'Sprawdź użytkowników (JSON)',
            'GET /check-user/:username': 'Sprawdź czy użytkownik istnieje',
            'GET /check-ip/:ip': 'Sprawdź czy IP ma konto',
            'DELETE /delete-user/:username': 'Usuń użytkownika (testy)'
        }
    });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Supabase API działa`);
    console.log(`🔗 URL: ${supabaseUrl}`);
    console.log(`📋 Dostępne endpointy:`);
    console.log(`   GET  / - Status API`);
    console.log(`   POST /save-log - Rejestracja użytkownika`);
    console.log(`   GET  /check-logs - Sprawdź użytkowników`);
    console.log(`   GET  /check-user/:username - Sprawdź użytkownika`);
    console.log(`   GET  /check-ip/:ip - Sprawdź IP`);
    console.log(`   DELETE /delete-user/:username - Usuń użytkownika`);
});
