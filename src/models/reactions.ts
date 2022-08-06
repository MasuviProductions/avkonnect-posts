import * as dynamoose from 'dynamoose';
import { TABLE } from '../constants/db';
import { IDynamooseDocument } from '../interfaces/app';
import { ISourceType } from './shared';

export type IResourceType = 'post' | 'comment';

export const REACTIONS = ['like', 'support', 'love', 'laugh', 'sad'] as const;
export type IReactionType = typeof REACTIONS[number];

export interface IReaction {
    id: string;
    sourceId: string;
    sourceType: ISourceType;
    createdAt: Date;
    resourceId: string;
    resourceType: IResourceType;
    reaction: IReactionType;
}
const ReactionsSchema = new dynamoose.Schema({
    id: { type: String, index: { name: 'reactionIdIndex' } },
    sourceId: { type: String, hashKey: true },
    sourceType: { type: String },
    createdAt: { type: Date, rangeKey: true },
    resourceId: {
        type: String,
        index: { global: true, name: 'resourceIndex', rangeKey: 'resourceType', project: true },
    },
    resourceType: { type: String },
    reaction: { type: String },
});
const Reaction = dynamoose.model<IDynamooseDocument<IReaction>>(TABLE.REACTIONS, ReactionsSchema);

export default Reaction;
