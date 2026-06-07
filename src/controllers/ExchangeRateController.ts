import { Response } from 'express';

type CachedRate = {
    baseCurrency: 'USD';
    targetCurrency: 'UAH';
    rate: number;
    source: 'NBU';
    sourceUrl: string;
    fetchedAt: string;
};

const NBU_USD_URL = 'https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?valcode=USD&json';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
let cachedRate: CachedRate | null = null;

const isCacheFresh = () => {
    if (!cachedRate) return false;
    return Date.now() - new Date(cachedRate.fetchedAt).getTime() < CACHE_TTL_MS;
};

const fetchUsdRateFromNbu = async (): Promise<CachedRate> => {
    const response = await fetch(NBU_USD_URL);
    const data = await response.json();
    const rate = Number(Array.isArray(data) ? data[0]?.rate : 0);

    if (!response.ok || !Number.isFinite(rate) || rate <= 0) {
        throw new Error('Could not load USD rate from NBU.');
    }

    return {
        baseCurrency: 'USD',
        targetCurrency: 'UAH',
        rate,
        source: 'NBU',
        sourceUrl: NBU_USD_URL,
        fetchedAt: new Date().toISOString(),
    };
};

export const getUsdUahRate = async () => {
    if (isCacheFresh() && cachedRate) {
        return cachedRate;
    }

    cachedRate = await fetchUsdRateFromNbu();
    return cachedRate;
};

export const handleGetUsdUahRate = async (_req: any, res: Response) => {
    try {
        const hadFreshCache = isCacheFresh() && cachedRate;
        const rate = await getUsdUahRate();
        res.json({ ...rate, cached: Boolean(hadFreshCache) });
    } catch (error) {
        console.error('Get USD/UAH rate error:', error);
        if (cachedRate) {
            return res.json({ ...cachedRate, cached: true, stale: true });
        }

        res.status(503).json({ message: 'Exchange rate is temporarily unavailable.' });
    }
};
