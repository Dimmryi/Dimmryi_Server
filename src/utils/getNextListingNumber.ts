import CounterModel from '../models/CounterModel';

export const getNextListingNumber = async (): Promise<number> => {
    const counter = await CounterModel.findOneAndUpdate(
        { name: 'listingNumber' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );
    return counter.seq;
};
