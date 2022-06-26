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
