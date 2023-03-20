import mongoose, { Schema } from 'mongoose';
import mongooseLeanVirtuals from 'mongoose-lean-virtuals';
import { TABLE } from '../constants/db';
import { ISourceType } from './shared';

export type IPostImageType = 'postImageOriginal' | 'postImageThumbnail' | 'postImageMax' | 'postImageStandard';
export type IPostStatus = 'created' | 'draft';
export type IPostMediaStatus = 'uploading' | 'uploaded' | 'processing' | 'failed' | 'success';

export interface IPostMediaUrl {
    resolution: string;
    url: string;
    type: IPostImageType;
}
const PostMediaUrl = new Schema<IPostMediaUrl>({
    resolution: { type: String },
    url: { type: String },
    type: { type: String },
});

export interface IPostsContent {
    text: string;
    createdAt: Date;
    mediaUrls: Array<Array<IPostMediaUrl>>;
    stringifiedRawContent: string;
}

const PostContentSchema = new Schema<IPostsContent>(
    {
        text: { type: String },
        createdAt: { type: Date },
        mediaUrls: { type: Array.of(Array.of(PostMediaUrl)) },
        stringifiedRawContent: { type: String },
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
    hashtags: Array<string>;
    visibleOnlyToConnections: boolean;
    commentsOnlyByConnections: boolean;
    postStatus: IPostStatus;
    postMediaStatus: IPostMediaStatus;
    isDeleted: boolean;
    isBanned: boolean;
}
const PostsSchema = new Schema(
    {
        _id: { type: String },
        createdAt: { type: Date },
        updatedAt: { type: Date },
        sourceId: { type: String, required: true, index: true },
        sourceType: { type: String, required: true },
        contents: { type: Array.of(PostContentSchema) },
        hashtags: { type: Array.of(String) },
        visibleOnlyToConnections: { type: Boolean, required: true },
        commentsOnlyByConnections: { type: Boolean, required: true },
        postStatus: { type: String, required: true },
        postMediaStatus: { type: String, required: true },
        isDeleted: { type: Boolean, default: false },
        isBanned: { type: Boolean, default: false },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

PostsSchema.index({ sourceId: 1, createdAt: -1 }, { name: 'sourceIdAndCreatedAtIndex', unique: false });

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
