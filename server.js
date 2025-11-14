const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const app = express();

// KONFIGURACJA CORS
app.use(cors({
    origin: ['https://socialtool.work.gd', 'http://localhost:3000', 'http://127.0.0.1:5500'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));
app.options('*', cors());

// PARSOWANIE JSON
app.use(express.json());

// KONFIGURACJA SUPABASE
const supabaseUrl = 'https://kazlfzeinvzpyywpilkk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthemxmemVpbnZ6cHl5d3BpbGtrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzEyNjM3OCwiZXhwIjoyMDc4NzAyMzc4fQ.M4DN5LWKX9LcDZFkBwRz5mVv0dlr2_UgDAq96l48flU';
const supabase = createClient(supabaseUrl, supabaseKey);

// Endpoint rejestracji
app.post('/save-log', async (req, res) => {
    console.log('📨 Rejestracja:', req.body);
    
    const { username, password, ip } = req.body;
    
    if (!username || !password || !ip) {
        return res.status(400).json({ 
            success: false, 
            message: 'Brak wymaganych danych' 
        });
    }

    try {
        // Sprawdź czy użytkownik istnieje
        const { data: existingUser } = await supabase
            .from('users')
            .select('username')
            .eq('username', username)
            .single();

        if (existingUser) {
            return res.status(409).json({ 
                success: false, 
                message: 'Nazwa użytkownika jest już zajęta' 
            });
        }

        // Sprawdź czy IP ma konto
        const { data: existingIP } = await supabase
            .from('users')
            .select('ip')
            .eq('ip', ip)
            .single();

        if (existingIP) {
            return res.status(409).json({ 
                success: false, 
                message: 'To IP ma już konto' 
            });
        }

        // Utwórz użytkownika
        const { data: newUser, error } = await supabase
            .from('users')
            .insert([{
                username: username,
                password: password,
                ip: ip,
                version: '2.0'
            }])
            .select();

        if (error) throw error;

        res.json({ 
            success: true, 
            message: 'Rejestracja udana!' 
        });

    } catch (error) {
        console.error('❌ Błąd:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Błąd serwera' 
        });
    }
});

// Endpoint listy użytkowników
app.get('/check-logs', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json({ 
            success: true, 
            users: data || [] 
        });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint główny
app.get('/', (req, res) => {
    res.json({ 
        message: '🚀 Social Tools API działa!', 
        status: 'online',
        version: '2.0'
    });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
