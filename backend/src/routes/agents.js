const express = require('express');
const agentManager = require('../services/AgentManager');
const router = express.Router();

// POST /api/agents/join
// Spawn an agent into a room (P2P or Relay mode)
router.post('/join', async (req, res) => {
    const { roomId, mode = 'p2p', agentConfig } = req.body;

    if (!roomId) {
        return res.status(400).json({ error: 'roomId is required' });
    }

    // Default Config if none provided
    const config = agentConfig || {
        agentId: 'agent-default',
        name: 'Tai Bot',
        avatar: { style: 'robot' }
    };

    try {
        await agentManager.spawnAgent(roomId, mode, config);

        res.json({
            success: true,
            message: `Agent joined room ${roomId} in ${mode} mode`,
            agentId: config.agentId
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// POST /api/agents/leave
// Remove agent from room
router.post('/leave', (req, res) => {
    const { roomId } = req.body;

    if (!roomId) {
        return res.status(400).json({ error: 'roomId is required' });
    }

    const removed = agentManager.removeAgent(roomId);

    if (removed) {
        res.json({ success: true, message: 'Agent left room' });
    } else {
        res.status(404).json({ error: 'No active agent found in this room' });
    }
});

module.exports = router;
