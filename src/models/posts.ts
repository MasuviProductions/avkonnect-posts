import mongoose, { Schema } from 'mongoose';
import mongooseLeanVirtuals from 'mongoose-lean-virtuals';
import { TABLE } from '../constants/db';
import { IRelatedSource, ISourceType } from './shared';

const RelatedSourceSchema = new Schema<IRelatedSource>({
    sourceId: { type: String },
    sourceType: { type: String },
});

export interface IPostsContent {
    text: string;
    createdAt: Date;
    mediaUrls: string[];
    relatedSources: IRelatedSource[];
    hashtags: string[];
}
const PostContentSchema = new Schema<IPostsContent>(
    {
        text: { type: String },
        createdAt: { type: Date },
        mediaUrls: { type: Array.of(String) },
        relatedSources: { type: Array.of(RelatedSourceSchema) },
        hashtags: { type: Array.of(String) },
    },
    { id: false }
);

export interface IPost {
    id: string; // primary key
    createdAt: Date;
    updatedAt: Date;
    sourceId: string;
    sourceType: ISourceType;
    contents: IPostsContent[];
    visibleOnlyToConnections: boolean;
    commentsOnlyByConnections: boolean;
}
const PostsSchema = new Schema(
    {
        _id: { type: String },
        createdAt: { type: Date },
        updatedAt: { type: Date },
        sourceId: { type: String, required: true, index: true },
        sourceType: { type: String, required: true },
        contents: { type: Array.of(PostContentSchema) },
        visibleOnlyToConnections: { type: Boolean, required: true },
        commentsOnlyByConnections: { type: Boolean, required: true },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

PostsSchema.virtual('id').get(function (): string {
    return this._id;
});

PostsSchema.set('toObject', {
    virtuals: true,
    transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
    },
});

PostsSchema.plugin(mongooseLeanVirtuals);

const Post = mongoose.model<IPost>(TABLE.POSTS, PostsSchema);

export default Post;
