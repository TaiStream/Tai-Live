const { AgentGateway } = require('@tai/node-operator');

class AgentManager {
    constructor() {
        this.agents = new Map(); // roomId -> AgentGateway
    }

    async spawnAgent(roomId, mode, agentConfig) {
        if (this.agents.has(roomId)) {
            console.log(`Agent already exists in room ${roomId}`);
            return this.agents.get(roomId);
        }

        // Initialize Real AgentGateway
        // Note: Real AgentGateway expects strictly typed config, ensure defaults are set
        const agent = new AgentGateway(agentConfig, roomId, mode);

        try {
            const signageUrl = 'ws://localhost:8080';
            const relayUrl = 'ws://localhost:8081';

            // Start agent (connects to signaling and/or relay)
            await agent.start(signageUrl, relayUrl);

            this.agents.set(roomId, agent);

            // Hook into errors to auto-cleanup
            agent.on('error', (err) => {
                console.error(`Agent error in room ${roomId}:`, err);
                this.removeAgent(roomId);
            });

            return agent;
        } catch (error) {
            console.error('Failed to spawn agent:', error);
            throw error;
        }
    }

    async removeAgent(roomId) {
        const agent = this.agents.get(roomId);
        if (agent) {
            await agent.stop();
            this.agents.delete(roomId);
            return true;
        }
        return false;
    }

    getAgent(roomId) {
        return this.agents.get(roomId);
    }
}

// Singleton instance
const agentManager = new AgentManager();
module.exports = agentManager;
