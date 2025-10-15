import express from 'express';
import {
    handleDeleteAgentById,
    handleGetAgents,
    handleGetAgentsById,
    handlePostAgents,
    handleUpdateAgentsData
} from '../controllers/AgentController';

const router = express.Router();

router.delete('/api/agents/:agentId', handleDeleteAgentById);
router.get('/agents', handleGetAgents);
router.get('/api/agents/:id', handleGetAgentsById);
router.post('/agents', handlePostAgents);
router.put('/api/agents/:id', handleUpdateAgentsData);

export default router;