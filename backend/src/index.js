const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { startSignalingServer } = require('./signaling');
const shelbyRoutes = require('./routes/shelby');
const { router: roomsRoutes, setRoomsProvider } = require('./routes/rooms');
const deliveryRoutes = require('./routes/delivery');

const app = express();
const PORT = 3001;
const SIGNALING_PORT = 8080;
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

// API Routes
app.use('/api/shelby', shelbyRoutes);
app.use('/api/rooms', roomsRoutes);
app.use('/', deliveryRoutes); // Mount at root for cleaner URLs like /stream/:id

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

// Start Express server
app.listen(PORT, () => {
    console.log(`🍄 Tai Backend running on http://localhost:${PORT}`);
    console.log(`🚀 Delivery Node Active at http://localhost:${PORT}/stream/:blobId`);
});

// Start WebSocket signaling server and share peers map with rooms API
const { wss, peers } = startSignalingServer(SIGNALING_PORT);
setRoomsProvider(() => peers);
