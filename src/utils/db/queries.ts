import Post, { IPost } from '../../models/posts';
import { v4 } from 'uuid';
import Reaction, { IReaction, IReactionType, IResourceType } from '../../models/reactions';
import Comment, { IComment } from '../../models/comments';
import Activity, { IActivity } from '../../models/activities';
import DB_HELPERS from './helpers';
import { Query } from 'dynamoose/dist/DocumentRetriever';
import { HttpDynamoDBResponsePagination, IDynamooseDocument } from '../../interfaces/app';
import { ObjectType } from 'dynamoose/dist/General';

const createPost = async (post: Partial<IPost>): Promise<IPost | undefined> => {
    const createdPost = await Post.create({ ...post, _id: v4() });
    return createdPost.toObject();
};

const getPostsByUserId = async (userId: string, page: number, limit: number) => {
    const postsQuery = Post.find({ sourceId: userId });
    const { documents: posts, pagination } = await DB_HELPERS.fetchMongoDBPaginatedDocuments<IPost>(
        postsQuery,
        [
            'sourceId',
            '_id',
            'createdAt',
            'updatedAt',
            'sourceType',
            'contents',
            'visibleOnlyToConnections',
            'commentsOnlyByConnections',
            'activity',
            'sourceActivity',
            'hashtags',
            'isBanned',
            'isDeleted',
        ],
        page,
        limit
    );
    const posting = posts.filter((post) => post.isDeleted != true);
    return { posting, pagination };
};

const updatePost = async (postId: string, updatedPost: Partial<IPost>): Promise<IPost | undefined> => {
    const createdPost = await Post.findByIdAndUpdate(postId, updatedPost, { new: true });
    return createdPost?.toObject();
};

const getPostById = async (postId: string): Promise<IPost | undefined> => {
    const post = await Post.findById(postId).exec();
    if (!post) {
        return undefined;
    }
    return post.toObject();
};

const getPostsByIds = async (postsIdList: Set<string>): Promise<Array<IPost>> => {
    const posts = await Post.find({
        _id: {
            $in: Array.from(postsIdList),
        },
    }).lean({ virtuals: true });
    return posts;
};

const deletePostById = async (postId: string): Promise<IPost | undefined> => {
    const postToDelete: Partial<IPost> = { isDeleted: true };
    const post = await updatePost(postId, postToDelete);
    if (!post) {
        return undefined;
    }
    return post;
};

const createComment = async (comment: IComment): Promise<IComment | undefined> => {
    const commentObj = new Comment(comment);
    await commentObj.save();
    return commentObj;
};

const getCommentById = async (commentId: string): Promise<IComment | undefined> => {
    const comment = await Comment.scan('id')
        .eq(commentId)
        .and()
        .where('isDeleted')
        .eq(false)
        .using('commentIdIndex')
        .exec();
    return comment?.[0];
};

const updateComment = async (
    sourceId: string,
    createdAt: Date,
    updatedComment: Partial<Pick<IComment, 'contents' | 'isDeleted' | 'isBanned'>>
): Promise<IComment | undefined> => {
    const comment = await Comment.update({ sourceId: sourceId, createdAt: createdAt.getTime() }, updatedComment);
    return comment;
};

const getCommentsForResource = async (
    resourceType: IResourceType,
    resourceId: string,
    limit: number,
    nextSearchStartFromKey?: ObjectType
): Promise<{ documents: Array<Partial<IComment>> | undefined; dDBPagination: HttpDynamoDBResponsePagination }> => {
    const commentsQuery = Comment.query('resourceId')
        .eq(resourceId)
        .and()
        .where('resourceType')
        .eq(resourceType)
        .and()
        .where('isDeleted')
        .eq(false)
        .using('resourceIndex');
    const paginatedDocuments = await DB_HELPERS.fetchDynamoDBPaginatedDocuments<IComment>(
        commentsQuery as Query<IDynamooseDocument<IComment>>,
        [],
        limit,
        ['sourceId', 'createdAt', 'resourceId', 'resourceType'],
        nextSearchStartFromKey
    );

    if (paginatedDocuments.dDBPagination.nextSearchStartFromKey) {
        paginatedDocuments.dDBPagination.nextSearchStartFromKey.createdAt = new Date(
            paginatedDocuments.dDBPagination.nextSearchStartFromKey.createdAt
        ).getTime();
    }
    return paginatedDocuments;
};

const getCommentsByResourceIdsForSource = async (
    sourceId: string,
    resourceIdsList: Set<string>,
    resourceType: IResourceType,
    limit: number,
    nextSearchStartFromKey?: ObjectType
): Promise<{ documents: Array<Partial<IComment>> | undefined; dDBPagination: HttpDynamoDBResponsePagination }> => {
    if (resourceIdsList.size <= 0) {
        return { documents: [], dDBPagination: { count: 0 } };
    }
    const commentsQuery = Comment.query('sourceId')
        .eq(sourceId)
        .and()
        .where('resourceId')
        .in(Array.from(resourceIdsList))
        .and()
        .where('resourceType')
        .eq(resourceType)
        .and()
        .where('isDeleted')
        .eq(false);

    const paginatedDocuments = await DB_HELPERS.fetchDynamoDBPaginatedDocuments<IComment>(
        commentsQuery,
        [],
        limit,
        ['sourceId', 'createdAt', 'resourceId', 'resourceType'],
        nextSearchStartFromKey
    );

    if (paginatedDocuments.dDBPagination.nextSearchStartFromKey) {
        paginatedDocuments.dDBPagination.nextSearchStartFromKey.createdAt = new Date(
            paginatedDocuments.dDBPagination.nextSearchStartFromKey.createdAt
        ).getTime();
    }
    return paginatedDocuments;
};

const deleteComment = async (sourceId: string, createdAt: Date): Promise<IComment | undefined> => {
    return await updateComment(sourceId, createdAt, { isDeleted: true });
};

const createReaction = async (reaction: IReaction): Promise<IReaction | undefined> => {
    const reactionObj = new Reaction(reaction);
    await reactionObj.save();
    return reactionObj;
};

const getReactionsForResource = async (
    resourceType: IResourceType,
    resourceId: string,
    reactionType: IReactionType | undefined,
    limit: number,
    nextSearchStartFromKey?: ObjectType
): Promise<{ documents: Array<Partial<IReaction>> | undefined; dDBPagination: HttpDynamoDBResponsePagination }> => {
    let reactionsQuery = Reaction.query('resourceId').eq(resourceId).and().where('resourceType').eq(resourceType);

    if (reactionType) {
        reactionsQuery = reactionsQuery.and().where('reaction').eq(reactionType);
    }

    const paginatedDocuments = await DB_HELPERS.fetchDynamoDBPaginatedDocuments<IReaction>(
        reactionsQuery.using('resourceIndex') as Query<IDynamooseDocument<IReaction>>,
        [],
        limit,
        ['sourceId', 'createdAt', 'resourceId', 'resourceType'],
        nextSearchStartFromKey
    );

    if (paginatedDocuments.dDBPagination.nextSearchStartFromKey) {
        paginatedDocuments.dDBPagination.nextSearchStartFromKey.createdAt = new Date(
            paginatedDocuments.dDBPagination.nextSearchStartFromKey.createdAt
        ).getTime();
    }

    return paginatedDocuments;
};

const getReactionByIdForSource = async (reactionId: string, sourceId: string): Promise<IReaction | undefined> => {
    const reaction = await Reaction.query('sourceId').eq(sourceId).and().where('id').eq(reactionId).exec();
    return reaction?.[0];
};

const getReaction = async (reactionId: string): Promise<IReaction | undefined> => {
    const reaction = await Reaction.scan('id').eq(reactionId).using('reactionIdIndex').exec();
    return reaction[0];
};

const updateReactionTypeForReaction = async (
    sourceId: string,
    createdAt: Date,
    reactionType: IReactionType
): Promise<IReaction | undefined> => {
    const updatedReaction = await Reaction.update(
        { sourceId: sourceId, createdAt: createdAt.getTime() },
        { reaction: reactionType }
    );
    return updatedReaction;
};

const deleteReaction = async (sourceId: string, createdAt: Date): Promise<void> => {
    await Reaction.delete({ sourceId: sourceId, createdAt: createdAt.getTime() });
};

const getReactionsBySourceForResource = async (
    sourceId: string,
    resourceId: string,
    resourceType: IResourceType
): Promise<IReaction | undefined> => {
    const reactions = await Reaction.query('sourceId')
        .eq(sourceId)
        .and()
        .where('resourceId')
        .eq(resourceId)
        .and()
        .where('resourceType')
        .eq(resourceType)
        .exec();

    return reactions?.[0];
};

const getReactionsByResourceIdsForSource = async (
    sourceId: string,
    resourceIdsList: Set<string>,
    resourceType: IResourceType
): Promise<Array<IReaction>> => {
    if (resourceIdsList.size <= 0) {
        return [];
    }
    const reactions = await Reaction.query('sourceId')
        .eq(sourceId)
        .and()
        .where('resourceId')
        .in(Array.from(resourceIdsList))
        .and()
        .where('resourceType')
        .eq(resourceType)
        .exec();
    return reactions;
};

const createActivity = async (activity: IActivity): Promise<IActivity> => {
    const activityObj = new Activity(activity);
    await activityObj.save();
    return activityObj;
};

const updateActivity = async (
    resourceId: string,
    resourceType: IResourceType,
    activity: Partial<Pick<IActivity, 'commentsCount' | 'reactionsCount' | 'banInfo' | 'reportInfo'>>
): Promise<IActivity> => {
    const updatedActivity = await Activity.update({ resourceId: resourceId, resourceType: resourceType }, activity);
    return updatedActivity;
};

const getActivityByResource = async (
    resourceId: string,
    resourceType: IResourceType
): Promise<IActivity | undefined> => {
    const activity = await Activity.get({ resourceId, resourceType });
    return activity;
};

const getActivitiesByResourceIds = async (
    resourceIdList: Set<string>,
    resourceType: IResourceType
): Promise<Array<IActivity>> => {
    if (resourceIdList.size <= 0) {
        return [];
    }
    const activities = await Activity.batchGet(
        Array.from(resourceIdList).map((resourceId) => ({
            resourceId: resourceId,
            resourceType: resourceType,
        }))
    );
    return activities;
};

const DB_QUERIES = {
    createPost,
    getPostsByIds,
    getActivitiesByResourceIds,
    updateActivity,
    createComment,
    getCommentsByResourceIdsForSource,
    getCommentsForResource,
    getPostById,
    deletePostById,
    updatePost,
    createReaction,
    updateReactionTypeForReaction,
    getReactionsBySourceForResource,
    getReactionsByResourceIdsForSource,
    getCommentById,
    deleteComment,
    updateComment,
    getReactionByIdForSource,
    getReaction,
    deleteReaction,
    getPostsByUserId,
    getReactionsForResource,
    createActivity,
    getActivityByResource,
};

export default DB_QUERIES;
