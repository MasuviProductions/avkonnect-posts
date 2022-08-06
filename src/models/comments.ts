import * as dynamoose from 'dynamoose';
import { TABLE } from '../constants/db';
import { IDynamooseDocument } from '../interfaces/app';
import { IResourceType } from './reactions';
import { IRelatedSource, ISourceType, RelatedSourceSchema } from './shared';

export interface ICommentContent {
    text: string;
    createdAt: Date;
    mediaUrls: string[];
    relatedSources: IRelatedSource[];
}
const CommentContentSchema = new dynamoose.Schema({
    text: { type: String },
    createdAt: { type: Date },
    mediaUrls: { type: Array, schema: Array.of(String) },
    relatedSources: { type: Array, schema: Array.of(RelatedSourceSchema) },
});

export interface IComment {
    sourceId: string;
    sourceType: ISourceType;
    resourceId: string;
    id: string;
    resourceType: IResourceType;
    createdAt: Date;
    contents: ICommentContent[]; // project to gsi
}
const CommentsSchema = new dynamoose.Schema({
    sourceId: { type: String, hashKey: true }, // partition key
    sourceType: { type: String },
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
