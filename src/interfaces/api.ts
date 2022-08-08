import { ISourceType } from '../models/shared';

export type INotificationResourceType = 'post' | 'comment' | 'connection' | 'broadcast';

export type IConnectionActivity = 'connectionRequest' | 'connectionConfirmation';
export type IPostActivity = 'postReaction' | 'postComment' | 'postCreation';
export type ICommentActivity = 'commentReaction' | 'commentComment' | 'commentCreation';

export type INotificationResourceActivity = IConnectionActivity | IPostActivity | ICommentActivity;

export interface INotificationActivity {
    resourceId: string;
    resourceType: INotificationResourceType;
    resourceActivity: INotificationResourceActivity;
    sourceId: string;
    sourceType: ISourceType;
}

export interface IConnectionApiModel {
    id: string;
    connectorId: string;
    connecteeId: string;
    isConnected: boolean;
    connectedAt?: number;
    connectionInitiatedBy: string;
}

export interface IUserApiModel {
    id: string;
    aboutUser: string;
    backgroundImageUrl: string;
    connectionCount: number;
    currentPosition: string;
    dateOfBirth?: Date;
    displayPictureUrl: string;
    email: string;
    followerCount: number;
    followeeCount: number;
    headline: string;
    name: string;
    phone: string;
    gender: string;
    location: string;
    projectsRefId: string;
    experiencesRefId: string;
    skillsRefId: string;
    certificationsRefId: string;
    unseenNotificationsCount?: number;
}

export type IUserApiResponse = IUserApiModel;

export type IPatchUserApiRequest = Pick<IUserApiModel, 'unseenNotificationsCount'>;
