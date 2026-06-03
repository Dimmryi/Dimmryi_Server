import { Request, Response } from 'express';
import mongoose from 'mongoose';
import AgentModel from '../models/AgentModel';

const normalizeAgentImage = (image: unknown) => {
    if (Array.isArray(image)) {
        return image.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
    }

    return typeof image === 'string' && image.trim().length > 0 ? [image] : [];
};

const getAgentPayload = (body: any) => {
    const { image, name, jobTitle, email, saleVolume, totalDeal, rating, license, phone, date } = body;

    return {
        image: normalizeAgentImage(image),
        name,
        jobTitle,
        email,
        saleVolume,
        totalDeal,
        rating,
        license,
        phone,
        date: date || Date.now().toString(),
    };
};

const hasRequiredAgentFields = (payload: ReturnType<typeof getAgentPayload>) =>
    payload.image.length > 0 &&
    typeof payload.name === 'string' &&
    payload.name.trim().length > 2 &&
    typeof payload.jobTitle === 'string' &&
    payload.jobTitle.trim().length > 0 &&
    typeof payload.email === 'string' &&
    payload.email.includes('@');

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
        const agents = await AgentModel.find({ isActive: { $ne: false }, status: { $ne: 'hidden' } });
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
            image: normalizeAgentImage(image),
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

export const handleGetMyAgent = async (req: any, res: any) => {
    try {
        const agent = await AgentModel.findOne({ userId: req.session.user.id });
        res.json({ agent: agent || null });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

export const handlePostMyAgent = async (req: any, res: any) => {
    try {
        const payload = getAgentPayload(req.body);

        if (!hasRequiredAgentFields(payload)) {
            return res.status(400).json({ message: 'Name, job title, email and image are required.' });
        }

        const existingAgent = await AgentModel.findOne({ userId: req.session.user.id });
        if (existingAgent) {
            const updated = await AgentModel.findOneAndUpdate(
                { userId: req.session.user.id },
                { ...payload, isActive: true, status: 'active' },
                { new: true }
            );

            return res.json({ message: 'Agent profile restored successfully!', agent: updated });
        }

        const agent = new AgentModel({
            ...payload,
            userId: req.session.user.id,
            isActive: true,
            status: 'active',
        });

        await agent.save();
        res.status(201).json({ message: 'Agent profile created successfully!', agent });
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Server error' });
    }
};

export const handleUpdateMyAgent = async (req: any, res: any) => {
    try {
        const payload = getAgentPayload(req.body);

        if (!hasRequiredAgentFields(payload)) {
            return res.status(400).json({ message: 'Name, job title, email and image are required.' });
        }

        const updated = await AgentModel.findOneAndUpdate(
            { userId: req.session.user.id },
            { ...payload, isActive: true, status: 'active' },
            { new: true }
        );

        if (!updated) {
            return res.status(404).json({ message: 'Agent profile not found.' });
        }

        res.json({ message: 'Agent profile updated successfully!', agent: updated });
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Server error' });
    }
};

export const handleHideMyAgent = async (req: any, res: any) => {
    try {
        const updated = await AgentModel.findOneAndUpdate(
            { userId: req.session.user.id },
            { isActive: false, status: 'hidden' },
            { new: true }
        );

        if (!updated) {
            return res.status(404).json({ message: 'Agent profile not found.' });
        }

        res.json({ message: 'Agent profile hidden successfully.', agent: updated });
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Server error' });
    }
};
