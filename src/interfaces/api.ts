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

export type IUserImageType =
    | 'displayPictureOriginal'
    | 'displayPictureThumbnail'
    | 'displayPictureMax'
    | 'displayPictureStandard'
    | 'backgroundPictureOriginal'
    | 'backgroundPictureThumbnail'
    | 'backgroundPictureMax'
    | 'backgroundPictureStandard';

export interface IImage<T extends string = string> {
    resolution: string;
    url: string;
    type: T;
}

export interface IUserImage {
    mediaUrls: Array<IMediaUrl>;
    mediaStatus: string;
}

type IMediaUrl = IImage<IUserImageType>;

export type IProfilePictureImages = IUserImage;

export type IBackgroundPictureImages = IUserImage;

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
    profilePictureImages: IProfilePictureImages;
    backgroundPictureImages: IBackgroundPictureImages;
}

export type IUserApiResponse = IUserApiModel;

export type IPatchUserApiRequest = Pick<IUserApiModel, 'unseenNotificationsCount'>;
