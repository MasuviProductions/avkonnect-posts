import * as dynamoose from 'dynamoose';
import { TABLE } from '../constants/db';
import { IDynamooseDocument } from '../interfaces/app';
import { IReactionType, IResourceType } from './reactions';
import { ISourceType } from './shared';

interface IBanInfo {
    sourceId: string;
    sourceType: ISourceType;
    banReason: string;
}
const BanSchema = new dynamoose.Schema({
    sourceId: { type: String },
    sourceType: { type: String },
    banReason: { type: String },
});

interface IReportSource {
    sourceId: string;
    sourceType: ISourceType;
    reportReason: string;
}
const ReportSourceSchema = new dynamoose.Schema({
    sourceId: { type: String },
    sourceType: { type: String },
    reportReason: { type: String },
});

interface IReportInfo {
    reportCount: number;
    sources: Array<IReportSource>;
}
const ReportInfoSchema = new dynamoose.Schema({
    reportCount: { type: Number },
    sources: { type: Array, schema: Array.of(ReportSourceSchema) },
});

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
    reportInfo: IReportInfo;
    banInfo?: IBanInfo;
}
const ActivitiesSchema = new dynamoose.Schema(
    {
        id: { type: String, index: { name: 'activityIdIndex' } },
        resourceId: { type: String, hashKey: true }, // partition key
        resourceType: { type: String, rangeKey: true },
        reactions: { type: Object, schema: ReactionsCountAttrSchema },
        commentsCount: { type: Number },
        reportInfo: { type: Object, schema: ReportInfoSchema },
        banInfo: { type: Object, schema: BanSchema },
    },
    {
        timestamps: true,
    }
);
const Activity = dynamoose.model<IDynamooseDocument<IActivity>>(TABLE.ACTIVITIES, ActivitiesSchema);

export default Activity;
