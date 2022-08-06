import * as dynamoose from 'dynamoose';

export type ISourceType = 'user' | 'company';

export interface IRelatedSource {
    sourceId: string;
    sourceType: ISourceType;
}
export const RelatedSourceSchema = new dynamoose.Schema({
    sourceId: { type: String },
    sourceType: { type: String },
});
