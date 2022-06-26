import * as dynamoose from 'dynamoose';
import { TABLE } from '../constants/db';
import { IDynamooseDocument } from '../interfaces/app';
import { IResourceType } from './reactions';

export interface ICommentContent {
    text: string;
    createdAt: Date;
    mediaUrls: string[];
    relatedUserIds: string[];
}
const CommentContentSchema = new dynamoose.Schema({
    text: { type: String },
    createdAt: { type: Date },
    mediaUrls: { type: Array, schema: Array.of(String) },
    relatedUserIds: { type: Array, schema: Array.of(String) },
});

export interface IComment {
    userId: string;
    resourceId: string;
    id: string;
    resourceType: IResourceType;
    createdAt: Date;
    contents: ICommentContent[]; // project to gsi
}
const CommentsSchema = new dynamoose.Schema({
    userId: { type: String, hashKey: true }, // partition key
    resourceId: {
        type: String,
        index: { name: 'resourceIndex', global: true, rangeKey: 'resourceType', project: true },
    }, // partition key- gsi
    id: { type: String, index: { name: 'commentIdIndex' } }, // lsi
    resourceType: { type: String }, // sort key- gsi
    createdAt: { type: Date, rangeKey: true }, // sort key
    contents: { type: Array, schema: Array.of(CommentContentSchema) },
});
const Comment = dynamoose.model<IDynamooseDocument<IComment>>(TABLE.COMMENTS, CommentsSchema);

export default Comment;
