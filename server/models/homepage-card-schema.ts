import mongoose, { Document, Schema, Types } from 'mongoose';

// Interface for HomePage Card document
export interface IHomepageCard extends Document {
  title: string;
  description: string;
  icon: string; // Lucide icon name
  action_type: 'url' | 'category_dropdown';
  action_url?: string; // For URL type actions
  action_button_text?: string; // Custom button text for URL actions
  category_id?: Types.ObjectId; // Reference to KnowledgebaseCategory for dropdown actions
  background_color?: string; // Optional background color override
  is_enabled: boolean;
  ordinal: number; // For ordering cards
  created_at: Date;
  updated_at: Date;
}

const homepageCardSchema = new Schema<IHomepageCard>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    icon: { type: String, required: true, trim: true }, // Lucide icon name like 'Shield', 'FileText', etc.
    action_type: { 
      type: String, 
      required: true, 
      enum: ['url', 'category_dropdown'],
      default: 'url'
    },
    action_url: { 
      type: String, 
      trim: true,
      validate: {
        validator: function(this: IHomepageCard, v: string) {
          // URL is required if action_type is 'url'
          return this.action_type !== 'url' || Boolean(v && v.length > 0);
        },
        message: 'URL is required when action type is URL'
      }
    },
    action_button_text: { 
      type: String, 
      trim: true,
      default: function(this: IHomepageCard) {
        return this.action_type === 'url' ? 'Learn More' : undefined;
      }
    },
    category_id: { 
      type: Schema.Types.ObjectId, 
      ref: 'KnowledgebaseCategory',
      validate: {
        validator: function(this: IHomepageCard, v: Types.ObjectId) {
          // Category ID is required if action_type is 'category_dropdown'
          return this.action_type !== 'category_dropdown' || Boolean(v);
        },
        message: 'Category is required when action type is category dropdown'
      }
    },
    background_color: { type: String, trim: true }, // Hex color or CSS class
    is_enabled: { type: Boolean, default: true },
    ordinal: { type: Number, default: 0 },
  },
  { 
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for populating category details
homepageCardSchema.virtual('category', {
  ref: 'KnowledgebaseCategory',
  localField: 'category_id',
  foreignField: '_id',
  justOne: true
});

// Export schema for tenant-specific model compilation
export const HomepageCardSchema = homepageCardSchema;
