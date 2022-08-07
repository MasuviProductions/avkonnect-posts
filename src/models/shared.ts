export enum SourceType {
    USER = 'user',
    COMPANY = 'company',
}

export const SOURCE_TYPES = [SourceType.USER, SourceType.COMPANY] as const;

export type ISourceType = typeof SOURCE_TYPES[number];
