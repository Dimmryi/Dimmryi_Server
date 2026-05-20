import { Request, Response } from 'express';
import mongoose from 'mongoose';
import AgentModel from '../models/AgentModel';

export const handleDeleteAgentById = async (req: any, res: any) => {
    try {
        const { agentId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(agentId)) {
            return res.status(400).json({ message: `Invalid ID format: ${agentId}` });
        }

        const deleted = await AgentModel.deleteMany({ _id: new mongoose.Types.ObjectId(agentId) });

        if (deleted.deletedCount === 0) {
            return res.status(404).json({ message: 'Agent not found.' });
        }

        res.status(200).json({ message: 'Agent deleted.', deletedCount: deleted.deletedCount });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

export const handleGetAgents = async (req: Request, res: Response) => {
    try {
        const agents = await AgentModel.find();
        res.json(agents);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

export const handleGetAgentsById = async (req: any, res: any) => {
    try {
        const agent = await AgentModel.find({ _id: req.params.id });
        if (!agent) {
            res.status(404).json({ message: 'Agent not found.' });
            return;
        }
        res.json(agent);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

export const handlePostAgents = async (req: any, res: any) => {
    try {
        const { image, ...rest } = req.body;
        const agent = new AgentModel({
            image: Array.isArray(image) ? image : [image],
            ...rest,
        });
        await agent.save();
        res.json({ message: 'Agent added successfully!' });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

export const handleUpdateAgentsData = async (req: any, res: any) => {
    try {
        const { id } = req.params;
        const { name, rating, email, jobTitle, saleVolume, license, totalDeal, phone, image } = req.body;

        if (!name || !rating || !email || !jobTitle || !saleVolume || !license || !totalDeal || !phone || !image) {
            return res.status(400).json({ error: 'All fields are required.' });
        }

        if (req.session.user?.role !== 'admin') {
            return res.status(403).json({ message: 'Administrator access required.' });
        }

        const updated = await AgentModel.findByIdAndUpdate(
            id,
            { name, rating, email, jobTitle, saleVolume, license, totalDeal, phone, image, date: Date.now() },
            { new: true }
        );

        res.json(updated);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};
