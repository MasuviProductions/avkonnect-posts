import * as dynamoose from 'dynamoose';
import { TABLE } from '../constants/db';
import { IDynamooseDocument } from '../interfaces/app';
import { IReactionType, IResourceType } from './reactions';

const ReactionsCountAttrSchema = new dynamoose.Schema({
    like: { type: Number },
    support: { type: Number },
    love: { type: Number },
    laugh: { type: Number },
    sad: { type: Number },
});

export interface IActivity {
    id: string;
    resourceId: string;
    resourceType: IResourceType;
    reactions: Record<IReactionType, number>;
    commentsCount: number;
}
const ActivitiesSchema = new dynamoose.Schema(
    {
        id: { type: String, index: { name: 'activityIdIndex' } },
        resourceId: { type: String, hashKey: true }, // partition key
        resourceType: { type: String, rangeKey: true },
        reactions: { type: Object, schema: ReactionsCountAttrSchema },
        commentsCount: { type: Number },
    },
    {
        timestamps: true,
    }
);
const Activity = dynamoose.model<IDynamooseDocument<IActivity>>(TABLE.ACTIVITIES, ActivitiesSchema);

export default Activity;
