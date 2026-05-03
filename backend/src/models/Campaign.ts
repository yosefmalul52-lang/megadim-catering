import mongoose, { Document, Model, Schema } from 'mongoose';

export type CampaignPlatform = 'facebook' | 'instagram';
export type CampaignStatus = 'draft' | 'pending' | 'published' | 'failed';

export interface ICampaign extends Document {
  title: string;
  content: string;
  mediaUrl?: string;
  platforms: CampaignPlatform[];
  status: CampaignStatus;
  n8nResponse?: Record<string, unknown>;
  scheduledAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const CampaignSchema = new Schema<ICampaign>(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true, trim: true },
    mediaUrl: { type: String, trim: true },
    platforms: {
      type: [{ type: String, enum: ['facebook', 'instagram'] }],
      required: true,
      default: []
    },
    status: {
      type: String,
      enum: ['draft', 'pending', 'published', 'failed'],
      default: 'draft',
      index: true
    },
    n8nResponse: { type: Schema.Types.Mixed },
    scheduledAt: { type: Date, default: null }
  },
  {
    timestamps: true,
    collection: 'campaigns'
  }
);

CampaignSchema.index({ createdAt: -1 });
CampaignSchema.index({ status: 1, createdAt: -1 });

export default (mongoose.models.Campaign as Model<ICampaign>) ||
  mongoose.model<ICampaign>('Campaign', CampaignSchema);
