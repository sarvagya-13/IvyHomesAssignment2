import mongoose from 'mongoose';

/**
 * Saved listings live here rather than upstream.
 *
 * The documented /v1/favourites does not exist, and the endpoint that does
 * (/v1/saved) is scoped to the shared demo accounts, so two people using
 * demo1 would see each other saves. Holding them locally, keyed by user, is
 * what makes "per user, and still there after a reload and a re-login" true.
 */
const savedListingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    listingId: { type: String, required: true, trim: true },
    kind: { type: String, enum: ['listing', 'rental'], default: 'listing' },
    note: { type: String, default: '', maxlength: 500 },
  },
  { timestamps: true },
);

savedListingSchema.index({ user: 1, listingId: 1 }, { unique: true });

export const SavedListing = mongoose.model('SavedListing', savedListingSchema);
