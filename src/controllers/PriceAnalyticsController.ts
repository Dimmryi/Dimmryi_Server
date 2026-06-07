import { Response } from 'express';
import mongoose from 'mongoose';
import PriceAnalyticsSnapshot from '../models/PriceAnalyticsSnapshotModel';

const allowedListingTypes = ['sale', 'rent'];
const allowedPropertyTypes = ['flat', 'private house', 'commercial real estate'];
const allowedMarketTypes = ['primary', 'secondary', 'all'];
const allowedCurrencies = ['USD', 'UAH', 'EUR'];
const allowedConfidence = ['high', 'medium', 'low'];
const monthPattern = /^\d{4}-\d{2}$/;

const toTrimmedString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const toNumber = (value: unknown) => {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : 0;
};

const normalizeSnapshotPayload = (body: Record<string, unknown>) => {
    const region = toTrimmedString(body.region);
    const city = toTrimmedString(body.city);
    const listingType = toTrimmedString(body.listingType);
    const propertyType = toTrimmedString(body.propertyType);
    const marketType = toTrimmedString(body.marketType) || 'all';
    const periodMonth = toTrimmedString(body.periodMonth);
    const currency = toTrimmedString(body.currency) || 'USD';
    const confidence = toTrimmedString(body.confidence) || 'medium';
    const source = toTrimmedString(body.source);

    if (!region) return { error: 'Region is required.' };
    if (!allowedListingTypes.includes(listingType)) return { error: 'Invalid listing type.' };
    if (!allowedPropertyTypes.includes(propertyType)) return { error: 'Invalid property type.' };
    if (!allowedMarketTypes.includes(marketType)) return { error: 'Invalid market type.' };
    if (!monthPattern.test(periodMonth)) return { error: 'Period month must be in YYYY-MM format.' };
    if (!allowedCurrencies.includes(currency)) return { error: 'Invalid currency.' };
    if (!allowedConfidence.includes(confidence)) return { error: 'Invalid confidence level.' };
    if (!source) return { error: 'Source is required.' };

    const pricePerSquareMeter = toNumber(body.pricePerSquareMeter);
    if (pricePerSquareMeter <= 0) return { error: 'Price per square meter must be greater than zero.' };

    return {
        snapshot: {
            region,
            city,
            listingType,
            propertyType,
            marketType,
            periodMonth,
            averagePrice: toNumber(body.averagePrice),
            medianPrice: toNumber(body.medianPrice),
            pricePerSquareMeter,
            sampleSize: Math.max(0, Math.round(toNumber(body.sampleSize))),
            currency,
            source,
            sourceUrl: toTrimmedString(body.sourceUrl),
            confidence,
            note: toTrimmedString(body.note),
        },
    };
};

const buildPublicQuery = (query: Record<string, unknown>) => {
    const filters: Record<string, unknown> = {};
    const region = toTrimmedString(query.region);
    const city = toTrimmedString(query.city);
    const listingType = toTrimmedString(query.listingType);
    const propertyType = toTrimmedString(query.propertyType);
    const marketType = toTrimmedString(query.marketType);

    if (region) filters.region = region;
    if (city) filters.city = city;
    if (allowedListingTypes.includes(listingType)) filters.listingType = listingType;
    if (allowedPropertyTypes.includes(propertyType)) filters.propertyType = propertyType;
    if (allowedMarketTypes.includes(marketType)) filters.marketType = marketType;

    return filters;
};

export const handleGetPriceAnalytics = async (req: any, res: Response) => {
    try {
        const filters = buildPublicQuery(req.query);
        const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 24);

        const snapshots = await PriceAnalyticsSnapshot.find(filters)
            .sort({ periodMonth: -1, updatedAt: -1 })
            .limit(limit)
            .lean();

        res.json({
            filters,
            snapshots: snapshots.reverse(),
            updatedPeriod: 'monthly',
        });
    } catch (error) {
        console.error('Get price analytics error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

export const handleGetAdminPriceAnalytics = async (req: any, res: Response) => {
    try {
        const filters = buildPublicQuery(req.query);
        const snapshots = await PriceAnalyticsSnapshot.find(filters)
            .sort({ periodMonth: -1, updatedAt: -1 })
            .limit(250)
            .lean();

        res.json(snapshots);
    } catch (error) {
        console.error('Get admin price analytics error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

export const handleUpsertPriceAnalyticsSnapshot = async (req: any, res: Response) => {
    try {
        const normalized = normalizeSnapshotPayload(req.body || {});
        if ('error' in normalized) {
            return res.status(400).json({ message: normalized.error });
        }

        const snapshot = normalized.snapshot;
        const saved = await PriceAnalyticsSnapshot.findOneAndUpdate(
            {
                region: snapshot.region,
                city: snapshot.city,
                listingType: snapshot.listingType,
                propertyType: snapshot.propertyType,
                marketType: snapshot.marketType,
                periodMonth: snapshot.periodMonth,
                source: snapshot.source,
            },
            { $set: snapshot },
            { new: true, upsert: true, runValidators: true }
        );

        res.status(201).json(saved);
    } catch (error) {
        console.error('Upsert price analytics snapshot error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

export const handleDeletePriceAnalyticsSnapshot = async (req: any, res: Response) => {
    try {
        const { snapshotId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(snapshotId)) {
            return res.status(400).json({ message: 'Invalid snapshot id.' });
        }

        const deleted = await PriceAnalyticsSnapshot.deleteOne({ _id: snapshotId });
        res.json({
            message: deleted.deletedCount ? 'Price analytics snapshot deleted.' : 'Snapshot was not found.',
            deletedCount: deleted.deletedCount,
        });
    } catch (error) {
        console.error('Delete price analytics snapshot error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
