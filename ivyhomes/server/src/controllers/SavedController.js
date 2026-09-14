import { z } from 'zod';
import { asyncHandler, ApiError } from '../core/ApiError.js';
import { SavedListing } from '../models/SavedListing.js';
import { datasetService } from '../services/DatasetService.js';

const saveBody = z.object({
  listing_id: z.string().min(1),
  kind: z.enum(['listing', 'rental']).default('listing'),
  note: z.string().max(500).optional(),
});

export class SavedController {
  list = asyncHandler(async (req, res) => {
    const saved = await SavedListing.find({ user: req.user._id }).sort({ createdAt: -1 }).lean();
    const listingIds = saved.filter((s) => s.kind === 'listing').map((s) => s.listingId);
    const byId = new Map(datasetService.getListingsByIds(listingIds).map((l) => [l.listing_id, l]));
    const rentalsById = new Map(datasetService.rentals.map((r) => [r.listing_id, r]));

    const results = saved.map((s) => ({
      saved_at: s.createdAt,
      kind: s.kind,
      note: s.note,
      listing_id: s.listingId,
      record: s.kind === 'rental' ? rentalsById.get(s.listingId) ?? null : byId.get(s.listingId) ?? null,
    })).filter((s) => s.record !== null);

    res.json({ count: results.length, results });
  });

  /** Ids only - lets the browse grid render its save state in one request. */
  ids = asyncHandler(async (req, res) => {
    const saved = await SavedListing.find({ user: req.user._id }).select('listingId').lean();
    res.json({ ids: saved.map((s) => s.listingId) });
  });

  add = asyncHandler(async (req, res) => {
    const parsed = saveBody.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest('Could not save that listing', parsed.error.flatten().fieldErrors);
    const { listing_id: listingId, kind, note } = parsed.data;

    // Refuse to save something that is not in the catalogue at all.
    if (kind === 'listing') datasetService.getListing(listingId);
    else datasetService.getRental(listingId);

    const doc = await SavedListing.findOneAndUpdate(
      { user: req.user._id, listingId },
      { $setOnInsert: { user: req.user._id, listingId, kind }, ...(note ? { $set: { note } } : {}) },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    res.status(201).json({ saved: { listing_id: doc.listingId, kind: doc.kind, saved_at: doc.createdAt } });
  });

  remove = asyncHandler(async (req, res) => {
    const result = await SavedListing.deleteOne({ user: req.user._id, listingId: req.params.id });
    if (result.deletedCount === 0) throw ApiError.notFound('That listing is not in your saved list');
    res.status(204).end();
  });
}

export const savedController = new SavedController();
