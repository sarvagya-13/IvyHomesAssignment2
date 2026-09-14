import mongoose from 'mongoose';

/**
 * A local mirror of a demo account. The upstream service owns the credentials;
 * we only keep what we need to attach saved listings to a person and to keep
 * the session alive across refreshes.
 */
const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    displayName: { type: String, required: true },
    lastLoginAt: { type: Date, default: Date.now },
    loginCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

userSchema.methods.toPublic = function toPublic() {
  return { id: this._id.toString(), email: this.email, name: this.displayName, lastLoginAt: this.lastLoginAt };
};

userSchema.statics.recordLogin = async function recordLogin(email) {
  const displayName = email.split('@')[0].replace(/^demo(\d+)$/i, 'Demo User $1');
  return this.findOneAndUpdate(
    { email: email.toLowerCase() },
    { $set: { lastLoginAt: new Date(), displayName }, $inc: { loginCount: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
};

export const User = mongoose.model('User', userSchema);
