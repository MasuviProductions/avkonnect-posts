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
import { IComment, ICommentContent } from '../models/comments';
import { IPost, IPostsContent } from '../models/posts';
import { IReaction, IReactionType, IResourceType } from '../models/reactions';
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

export interface IUpdatePostRequest {
    content: Omit<IPostsContent, 'createdAt'>;
}

export interface IPostInfoUserActivity {
    userComments?: ICommentContent[];
    userReaction?: IReactionType;
}

export interface IPostsInfo extends Omit<IPost, 'id'> {
    postId: string;
    reactionsCount: Record<IReactionType, number>;
    commentsCount: number;
    userActivity?: IPostInfoUserActivity;
}

export interface IPostsInfoRequest {
    userId?: string;
    postIds: Array<string>;
}

export type IPostsInfoResponse = Array<IPostsInfo>;

export interface IFeedsSQSEventRecord {
    eventType: 'generateFeeds';
    resourceId: string;
    resourceType: 'post' | 'comment' | 'reaction';
}

export interface IPostReactionModel extends IReaction {
    relatedUser: IUserApiModel;
}
export type IPostReactionsResponse = Array<IPostReactionModel>;

export interface IPostCommentModel extends IComment {
    relatedUser: IUserApiModel;
}
export type IPostCommentsResponse = Array<IPostCommentModel>;
