import { Request, Response } from 'express';
import AiEstimatorUsageModel from '../models/AiEstimatorUsageModel';

const MAX_DESCRIPTION_LENGTH = 3000;
const DEFAULT_MODEL = 'gemini-2.5-flash';
const DEFAULT_TIMEZONE = 'Europe/Kiev';

const getUsedDate = () => new Intl.DateTimeFormat('en-CA', {
    timeZone: process.env.AI_ESTIMATOR_TIMEZONE || DEFAULT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
}).format(new Date());

const buildPrompt = (description: string, language: string) => `You are a real estate appraisal expert. Analyze the property description and calculate the approximate value.
Description: ${description}
Consider location, area, rooms, floor, condition, nearby amenities, and market trends.
Format: Approximate cost: [price range in hryvnia]. Justification: [brief explanation].
${language === 'en' ? 'Give answer in English.' : 'Give answer in Ukrainian.'}`;

const getGoogleAiKey = () => process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY || '';

const getEstimateText = (data: any) => data?.candidates?.[0]?.content?.parts?.[0]?.text;

export const handleGetAiEstimatorStatus = async (req: any, res: Response) => {
    try {
        const userId = req.session.user.id;
        const usedDate = getUsedDate();
        const existingUsage = await AiEstimatorUsageModel.exists({ userId, usedDate });

        res.json({ usedToday: Boolean(existingUsage), usedDate });
    } catch (error) {
        console.error('AI estimator status error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

export const handleEstimatePropertyValue = async (req: Request, res: Response) => {
    let usageCreated = false;
    const sessionUser = (req as any).session?.user;
    const userId = sessionUser?.id;
    const usedDate = getUsedDate();

    try {
        const description = typeof req.body?.propertyDescription === 'string'
            ? req.body.propertyDescription.trim()
            : '';
        const language = req.body?.language === 'en' ? 'en' : 'uk';

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        if (!description) {
            return res.status(400).json({ message: 'Property description is required.' });
        }

        if (description.length > MAX_DESCRIPTION_LENGTH) {
            return res.status(400).json({ message: `Property description must be ${MAX_DESCRIPTION_LENGTH} characters or less.` });
        }

        const apiKey = getGoogleAiKey();
        if (!apiKey) {
            return res.status(503).json({ message: 'AI estimator is not configured.' });
        }

        try {
            await AiEstimatorUsageModel.create({
                userId,
                usedDate,
                usedAt: new Date(),
                promptLength: description.length,
            });
            usageCreated = true;
        } catch (error: any) {
            if (error?.code === 11000) {
                return res.status(429).json({
                    message: 'Daily estimator limit reached.',
                    usedToday: true,
                    usedDate,
                });
            }
            throw error;
        }

        const model = process.env.GOOGLE_AI_MODEL || DEFAULT_MODEL;
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: buildPrompt(description, language) }] }] }),
            },
        );

        if (!response.ok) {
            const text = await response.text();
            console.error('Google AI estimator response error:', response.status, text);
            throw new Error(`Google AI service failed with ${response.status}`);
        }

        const data = await response.json();
        const estimate = getEstimateText(data);

        if (!estimate) {
            throw new Error('Empty response from Google AI service');
        }

        res.json({ estimate, usedToday: true, usedDate });
    } catch (error) {
        if (usageCreated && userId) {
            await AiEstimatorUsageModel.deleteOne({ userId, usedDate }).catch((cleanupError) => {
                console.error('AI estimator usage cleanup error:', cleanupError);
            });
        }

        console.error('AI estimator error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
