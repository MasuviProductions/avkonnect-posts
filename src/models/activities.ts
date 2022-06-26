import * as dynamoose from 'dynamoose';
import { TABLE } from '../constants/db';
import { IDynamooseDocument } from '../interfaces/app';
import { IReactionType } from './reactions';

const ReactionsCountAttrSchema = new dynamoose.Schema({
    likeCount: { type: Number },
    supportCount: { type: Number },
    loveCount: { type: Number },
    laughCount: { type: Number },
    sadCount: { type: Number },
});

export interface IActivity {
    id: string;
    resourceId: string;
    resourceType: 'post' | 'comment';
    reactions: Record<IReactionType, number>;
    commentsCount: number;
}
const ActivitiesSchema = new dynamoose.Schema(
    {
        id: { type: String, index: { name: 'activityIdIndex' } },
        resourceId: { type: String, hashKey: true }, // partition key
        resourceType: { type: String, rangeKey: true }, // sort key
        reactions: { type: ReactionsCountAttrSchema },
        commentsCount: { type: Number },
    },
    {
        timestamps: true,
    }
);
const Activity = dynamoose.model<IDynamooseDocument<IActivity>>(TABLE.ACTIVITIES, ActivitiesSchema);

export default Activity;
