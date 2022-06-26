import * as dynamoose from 'dynamoose';
import { TABLE } from '../constants/db';
import { IDynamooseDocument } from '../interfaces/app';

export type IResourceType = 'post' | 'comment';

export const REACTIONS = ['like', 'support', 'love', 'laugh', 'sad'] as const;
export type IReactionType = typeof REACTIONS[number];

export interface IReaction {
    id: string;
    userId: string;
    createdAt: Date;
    resourceId: string;
    resourceType: IResourceType;
    reaction: IReactionType;
}
const ReactionsSchema = new dynamoose.Schema({
    id: { type: String, index: { name: 'reactionIdIndex' } }, // lsi
    userId: { type: String, hashKey: true }, // partition key
    createdAt: { type: Date, rangeKey: true }, // sort key
    resourceId: {
        type: String,
        index: { global: true, name: 'resourceIndex', rangeKey: 'resourceType', project: true },
    }, // partition key- gsi
    resourceType: { type: String }, // sort key- gsi
    reaction: { type: String },
});
const Reaction = dynamoose.model<IDynamooseDocument<IReaction>>(TABLE.REACTIONS, ReactionsSchema);

export default Reaction;
