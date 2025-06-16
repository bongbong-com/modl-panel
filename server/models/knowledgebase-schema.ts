import mongoose, { Document, Schema, Types } from 'mongoose';
import slugify from 'slugify';

// Interface for KnowledgebaseArticle document
export interface IKnowledgebaseArticle extends Document {
  title: string;
  slug: string;
  content: string; // Markdown content
  category: Types.ObjectId; // Reference to KnowledgebaseCategory
  author?: Types.ObjectId; // Optional: reference to User who created/edited
  is_visible: boolean;
  ordinal: number; // For ordering within a category
  created_at: Date;
  updated_at: Date;
  // TODO: Add views, helpful votes, etc. later if needed
}

// Interface for KnowledgebaseCategory document
export interface IKnowledgebaseCategory extends Document {
  name: string;
  slug: string;
  description?: string;
  ordinal: number; // For ordering categories
  articles: IKnowledgebaseArticle[]; // Populated field
  created_at: Date;
  updated_at: Date;
}

const knowledgebaseArticleSchema = new Schema<IKnowledgebaseArticle>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, index: true },
    content: { type: String, required: true },
    category: { type: Schema.Types.ObjectId, ref: 'KnowledgebaseCategory', required: true },
    author: { type: Schema.Types.ObjectId, ref: 'User' }, // Assuming a 'User' model exists
    is_visible: { type: Boolean, default: true },
    ordinal: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

// Pre-save hook to generate slug for articles
knowledgebaseArticleSchema.pre<IKnowledgebaseArticle>('save', function (next) {
  if (this.isModified('title') || this.isNew) {
    this.slug = slugify(this.title, { lower: true, strict: true });
  }
  next();
});


const knowledgebaseCategorySchema = new Schema<IKnowledgebaseCategory>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, unique: true, index: true },
    description: { type: String, trim: true },
    ordinal: { type: Number, default: 0 },
    // articles are populated virtually or on demand, not stored as an array of ObjectIds here
    // to avoid unbounded array issues.
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Pre-save hook to generate slug for categories
knowledgebaseCategorySchema.pre<IKnowledgebaseCategory>('save', function (next) {
  if (this.isModified('name') || this.isNew) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
  next();
});

// Virtual for populating articles in a category
knowledgebaseCategorySchema.virtual('articles', {
  ref: 'KnowledgebaseArticle',
  localField: '_id',
  foreignField: 'category',
  justOne: false,
  options: { sort: { ordinal: 1 } } // Default sort order for articles within a category
});

// Export schemas directly for tenant-specific model compilation
export const KnowledgebaseArticleSchema = knowledgebaseArticleSchema;
export const KnowledgebaseCategorySchema = knowledgebaseCategorySchema;

// mongoose.model<IKnowledgebaseArticle>('KnowledgebaseArticle', knowledgebaseArticleSchema);
// mongoose.model<IKnowledgebaseCategory>('KnowledgebaseCategory', knowledgebaseCategorySchema);