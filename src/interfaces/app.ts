import { Document } from 'dynamoose/dist/Document';
import { ObjectType } from 'dynamoose/dist/General';
import {
    RouteHandlerMethod,
    RawServerDefault,
    RawRequestDefaultExpression,
    RawReplyDefaultExpression,
    ContextConfigDefault,
    RequestGenericInterface,
    preHandlerAsyncHookHandler,
} from 'fastify';
import { ReplyGenericInterface } from 'fastify/types/reply';
import { IActivity } from '../models/activities';
import { IComment, ICommentContent } from '../models/comments';
import { IPost, IPostsContent } from '../models/posts';
import { IReaction, IReactionType, IResourceType } from '../models/reactions';
import { ISourceType } from '../models/shared';
import { IUserApiModel } from './api';

interface FastifyRouteGenericInterface extends RequestGenericInterface, ReplyGenericInterface {}

export type RequestHandler<Request = unknown> = RouteHandlerMethod<
    RawServerDefault,
    RawRequestDefaultExpression<RawServerDefault>,
    RawReplyDefaultExpression<RawServerDefault>,
    Request & FastifyRouteGenericInterface,
    ContextConfigDefault
>;

export type PreRequestHandler<Request = unknown> = preHandlerAsyncHookHandler<
    RawServerDefault,
    RawRequestDefaultExpression<RawServerDefault>,
    RawReplyDefaultExpression<RawServerDefault>,
    Request & FastifyRouteGenericInterface,
    ContextConfigDefault
>;

export interface HttpResponseError {
    code: string;
    message: string;
}

export interface HttpResponsePagination {
    totalCount: number;
    totalPages: number;
    page: number;
    count: number;
}

export interface HttpDynamoDBResponsePagination {
    nextSearchStartFromKey?: ObjectType;
    count: number;
}

export interface HttpResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: HttpResponseError;
    pagination?: HttpResponsePagination;
    dDBPagination?: HttpDynamoDBResponsePagination;
}

export type IDynamooseDocument<T> = T & Document;

export interface IFeedsSQSEventRecord {
    eventType: 'generateFeeds';
    resourceId: string;
    resourceType: 'post' | 'comment' | 'reaction';
}

export interface ICreateReactionRequest {
    resourceId: string;
    resourceType: IResourceType;
    reaction: IReactionType;
}

export interface ICreateCommentRequest {
    resourceId: string;
    resourceType: IResourceType;
    comment: Omit<ICommentContent, 'createdAt'>;
}

export interface IUpdateCommentRequest {
    comment: Omit<ICommentContent, 'createdAt'>;
}

export interface ICreatePostRequest {
    content: Omit<IPostsContent, 'createdAt'>;
    hashtags: string[];
    visibleOnlyToConnections: boolean;
    commentsOnlyByConnections: boolean;
}

export type IRelatedSource = Partial<IUserApiModel>;

export interface IPostApiModel extends IPost {
    activity: IActivity;
    sourceActivity?: ISourceActivity;
}

export interface IPostResponse extends IPostApiModel {
    relatedSources: IRelatedSource[];
}

export interface IUpdatePostRequest {
    content?: Omit<IPostsContent, 'createdAt'>;
    hashtags?: Array<string>;
}

export interface ISourceActivity {
    comments?: ICommentContent[];
    reaction?: IReactionType;
}

export interface IPostsInfo extends Omit<IPostApiModel, 'id'> {
    postId: string;
}

export interface IPostsInfoRequest {
    sourceId?: string;
    sourceType?: ISourceType;
    postIds: Array<string>;
}

export interface IPostsInfoResponse {
    postsInfo: Array<IPostsInfo>;
    relatedSources: Array<IRelatedSource>;
}

export interface IPostReactionsResponse {
    reactions: Array<IReaction>;
    relatedSources: Array<IRelatedSource>;
}

export interface ICommentApiModel extends IComment {
    activity: IActivity;
    sourceActivity?: ISourceActivity;
}

export interface IPostCommentsResponse {
    comments: Array<ICommentApiModel>;
    relatedSources: Array<IRelatedSource>;
}

export type IPostActivityResponse = IActivity;

export interface ICommentResponse extends ICommentApiModel {
    relatedSources: IRelatedSource[];
}

export interface ICommentCommentsResponse {
    comments: Array<ICommentApiModel>;
    relatedSources: Array<IRelatedSource>;
}

export type ICommentActivityResponse = IActivity;

export interface IReactionResponse extends IReaction {
    relatedSource: IRelatedSource;
}
