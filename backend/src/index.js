const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;
const DATA_FILE = path.join(__dirname, '../data/waitlist.json');

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Ensure data directory exists
if (!fs.existsSync(path.dirname(DATA_FILE))) {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
}

// Initialize waitlist file if not exists
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2));
}

// Routes
app.get('/', (req, res) => {
    res.send('Tai Backend is running 🍄');
});

app.post('/api/waitlist', (req, res) => {
    const { email } = req.body;

    if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'Invalid email address' });
    }

    try {
        const data = JSON.parse(fs.readFileSync(DATA_FILE));

        if (data.find(entry => entry.email === email)) {
            return res.status(409).json({ message: 'Email already registered' });
        }

        const newEntry = {
            email,
            timestamp: new Date().toISOString(),
            ip: req.ip
        };

        data.push(newEntry);
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

        console.log(`[Waitlist] New signup: ${email}`);
        res.status(201).json({ message: 'Successfully joined waitlist' });
    } catch (error) {
        console.error('Error saving to waitlist:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
