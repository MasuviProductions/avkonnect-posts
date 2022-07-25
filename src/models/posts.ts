import mongoose, { Schema } from 'mongoose';
import mongooseLeanVirtuals from 'mongoose-lean-virtuals';
import { TABLE } from '../constants/db';

export interface IPostsContent {
    text: string;
    createdAt: Date;
    mediaUrls: string[];
    relatedUserIds: string[];
    hashtags: string[];
}
const PostContentSchema = new Schema<IPostsContent>(
    {
        text: { type: String },
        createdAt: { type: Date },
        mediaUrls: { type: Array.of(String) },
        relatedUserIds: { type: Array.of(String) },
        hashtags: { type: Array.of(String) },
    },
    { id: false }
);

export interface IPost {
    id: string; // primary key
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    contents: IPostsContent[];
    visibleOnlyToConnections: boolean;
    commentsOnlyByConnections: boolean;
}
const PostsSchema = new Schema(
    {
        _id: { type: String },
        createdAt: { type: Date },
        updatedAt: { type: Date },
        userId: { type: String, required: true, index: true },
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
