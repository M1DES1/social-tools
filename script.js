const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const app = express();

// Konfiguracja CORS
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parsowanie JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Middleware do logowania
app.use((req, res, next) => {
    console.log('=== 📨 INCOMING REQUEST ===');
    console.log('Method:', req.method);
    console.log('URL:', req.url);
    console.log('Body:', req.body);
    console.log('=== 🏁 END REQUEST LOG ===');
    next();
});

// Konfiguracja Supabase
const supabaseUrl = 'https://kazlfzeinvzpyywpilkk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthemxmemVpbnZ6cHl5d3BpbGtrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzEyNjM3OCwiZXhwIjoyMDc4NzAyMzc4fQ.M4DN5LWKX9LcDZFkBwRz5mVv0dlr2_UgDAq96l48flU';
const supabase = createClient(supabaseUrl, supabaseKey);

// Funkcja do sprawdzania czy użytkownik istnieje
async function checkIfUserExists(username) {
    try {
        console.log('🔍 Checking user:', username);
        const { data, error } = await supabase
            .from('users')
            .select('username')
            .eq('username', username)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                console.log('✅ User does not exist');
                return false;
            }
            console.error('❌ DB Error checking user:', error);
            return false;
        }

        console.log('✅ User exists:', data);
        return !!data;
    } catch (error) {
        console.error('❌ Error checking user:', error);
        return false;
    }
}

// Funkcja do sprawdzania czy IP ma już konto
async function checkIfIPExists(ip) {
    try {
        console.log('🔍 Checking IP:', ip);
        const { data, error } = await supabase
            .from('users')
            .select('ip')
            .eq('ip', ip)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                console.log('✅ IP does not exist');
                return false;
            }
            console.error('❌ DB Error checking IP:', error);
            return false;
        }

        console.log('✅ IP exists:', data);
        return !!data;
    } catch (error) {
        console.error('❌ Error checking IP:', error);
        return false;
    }
}

// Funkcja do zapisywania użytkownika - DOSTOSOWANA DO TWOJEJ TABELI
async function saveUserToDatabase(username, password, ip) {
    try {
        console.log('💾 Saving user to database...');
        
        const userData = {
            username: username,
            password: password,
            ip: ip,
            version: '2.0'
            // created_at i id są automatycznie generowane
        };

        console.log('📝 User data:', userData);

        const { data, error } = await supabase
            .from('users')
            .insert([userData])
            .select();

        if (error) {
            console.error('❌ Database insert error:', {
                code: error.code,
                message: error.message,
                details: error.details,
                hint: error.hint
            });
            return false;
        }

        console.log('✅ User saved successfully:', data);
        return true;
    } catch (error) {
        console.error('💥 Critical save error:', error);
        return false;
    }
}

// Główny endpoint rejestracji
app.post('/save-log', async (req, res) => {
    console.log('=== 🆕 NOWA REJESTRACJA ===');
    console.log('📨 Otrzymano żądanie:', req.body);
    
    const { username, password, ip } = req.body;
    
    // Walidacja danych
    if (!username || !password || !ip) {
        console.log('❌ Missing data:', { username, password, ip });
        return res.json({ 
            success: false, 
            message: 'Brak wymaganych danych: username, password, ip' 
        });
    }

    console.log('🔍 Sprawdzanie czy użytkownik istnieje...');
    const userExists = await checkIfUserExists(username);
    if (userExists) {
        console.log('❌ Użytkownik już istnieje:', username);
        return res.json({ 
            success: false, 
            message: 'Nazwa użytkownika jest już zajęta' 
        });
    }

    console.log('🔍 Sprawdzanie czy IP ma już konto...');
    const ipExists = await checkIfIPExists(ip);
    if (ipExists) {
        console.log('❌ IP ma już konto:', ip);
        return res.json({ 
            success: false, 
            message: 'Za dużo użytkowników zostało zarejestrowanych na tym IP' 
        });
    }

    console.log('✅ Użytkownik i IP są dostępne, zapisywanie do bazy...');
    const saveResult = await saveUserToDatabase(username, password, ip);

    if (saveResult) {
        console.log('🎉 Rejestracja udana dla:', username);
        res.json({ 
            success: true, 
            message: 'Rejestracja udana!' 
        });
    } else {
        console.log('💥 Błąd rejestracji dla:', username);
        res.json({ 
            success: false, 
            message: 'Błąd podczas rejestracji' 
        });
    }
    
    console.log('=== ✅ KONIEC REJESTRACJI ===\n');
});

// Pozostałe endpointy pozostają bez zmian
app.get('/check-logs', async (req, res) => {
    console.log('=== 📊 SPRAWDZANIE UŻYTKOWNIKÓW ===');
    
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('❌ DB Error:', error);
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
        console.error('❌ Error:', error);
        res.json({ success: false, error: error.message });
    }
});

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

app.get('/', (req, res) => {
    res.json({ 
        message: 'Supabase Logger API działa!', 
        status: 'online',
        database: 'Supabase PostgreSQL',
        table: 'users (uuid)',
        endpoints: {
            'POST /save-log': 'Rejestracja użytkownika',
            'GET /check-logs': 'Sprawdź użytkowników',
            'GET /check-user/:username': 'Sprawdź użytkownika',
            'GET /check-ip/:ip': 'Sprawdź IP'
        }
    });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Supabase API z tabelą users (uuid)`);
});
