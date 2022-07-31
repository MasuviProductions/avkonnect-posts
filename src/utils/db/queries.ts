import Post, { IPost } from '../../models/posts';
import { v4 } from 'uuid';
import Reaction, { IReaction, IReactionType, IResourceType } from '../../models/reactions';
import Comment, { IComment } from '../../models/comments';
import Activity, { IActivity } from '../../models/activities';

const createPost = async (post: Partial<IPost>): Promise<IPost | undefined> => {
    const createdPost = await Post.create({ ...post, _id: v4() });
    return createdPost.toObject();
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

const deletePostById = async (postId: string) => {
    const post = await Post.findByIdAndDelete(postId).exec();
    if (!post) {
        return undefined;
    }
    return post.toObject();
};

const createComment = async (comment: IComment): Promise<IComment | undefined> => {
    const commentObj = new Comment(comment);
    await commentObj.save();
    return commentObj;
};

const getCommentById = async (commentId: string): Promise<IComment | undefined> => {
    const comment = await Comment.scan('id').eq(commentId).using('commentIdIndex').exec();
    return comment?.[0];
};

const updateComment = async (
    userId: string,
    createdAt: Date,
    updatedComment: Pick<IComment, 'contents'>
): Promise<IComment | undefined> => {
    const comment = await Comment.update({ userId: userId, createdAt: createdAt.getTime() }, updatedComment);
    return comment;
};

const getCommentsForResource = async (
    resourceType: IResourceType,
    resourceId: string
): Promise<IComment[] | undefined> => {
    const comments = Comment.query('resourceId')
        .eq(resourceId)
        .and()
        .where('resourceType')
        .eq(resourceType)
        .using('resourceIndex')
        .exec();
    return comments;
};

const getCommentsByResourceIdsForUser = (userId: string, resourceIdsList: Set<string>, resourceType: IResourceType) => {
    const comments = Comment.query('userId')
        .eq(userId)
        .and()
        .where('resourceId')
        .in(Array.from(resourceIdsList))
        .and()
        .where('resourceType')
        .eq(resourceType)
        .exec();
    return comments;
};

const deleteComment = async (userId: string, createdAt: Date): Promise<void> => {
    await Comment.delete({ userId: userId, createdAt: createdAt.getTime() });
};

const createReaction = async (reaction: IReaction): Promise<IReaction | undefined> => {
    const reactionObj = new Reaction(reaction);
    await reactionObj.save();
    return reactionObj;
};

const getReactionsForResource = async (
    resourceType: IResourceType,
    resourceId: string
): Promise<IReaction[] | undefined> => {
    const reactions = Reaction.query('resourceId')
        .eq(resourceId)
        .and()
        .where('resourceType')
        .eq(resourceType)
        .using('resourceIndex')
        .exec();
    return reactions;
};

const getReactionByIdForUser = async (reactionId: string, userId: string): Promise<IReaction | undefined> => {
    const reaction = await Reaction.query('userId').eq(userId).and().where('id').eq(reactionId).exec();
    return reaction?.[0];
};

const getReaction = async (reactionId: string): Promise<IReaction | undefined> => {
    const reaction = await Reaction.scan('id').eq(reactionId).using('reactionIdIndex').exec();
    return reaction;
};

const updateReactionTypeForReaction = async (
    userId: string,
    createdAt: Date,
    reactionType: IReactionType
): Promise<IReaction | undefined> => {
    const updatedReaction = await Reaction.update(
        { userId: userId, createdAt: createdAt.getTime() },
        { reaction: reactionType }
    );
    return updatedReaction;
};

const deleteReaction = async (userId: string, createdAt: Date): Promise<void> => {
    await Reaction.delete({ userId: userId, createdAt: createdAt.getTime() });
};

const getReactionsByUserIdForResource = async (
    userId: string,
    resourceId: string,
    resourceType: IResourceType
): Promise<IReaction | undefined> => {
    const reactions = await Reaction.query('userId')
        .eq(userId)
        .and()
        .where('resourceId')
        .eq(resourceId)
        .and()
        .where('resourceType')
        .eq(resourceType)
        .exec();

    return reactions?.[0];
};

const getReactionsByResourceIdsForUser = async (
    userId: string,
    resourceIdsList: Set<string>,
    resourceType: IResourceType
): Promise<Array<IReaction>> => {
    const reactions = await Reaction.query('userId')
        .eq(userId)
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
    activity: Partial<Pick<IActivity, 'commentsCount' | 'reactions'>>
): Promise<IActivity> => {
    const updatedActivity = await Activity.update({ resourceId: resourceId, resourceType: resourceType }, activity);
    return updatedActivity;
};

const getActivityByResource = async (resourceId: string, resourceType: IResourceType): Promise<IActivity> => {
    const activity = await Activity.get({ resourceId, resourceType });
    return activity;
};

const getActivitiesByResourceIds = async (
    resourceIdList: Set<string>,
    resourceType: IResourceType
): Promise<Array<IActivity>> => {
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
    getCommentsByResourceIdsForUser,
    getCommentsForResource,
    getPostById,
    deletePostById,
    updatePost,
    createReaction,
    updateReactionTypeForReaction,
    getReactionsByUserIdForResource,
    getReactionsByResourceIdsForUser,
    getCommentById,
    deleteComment,
    updateComment,
    getReactionByIdForUser,
    getReaction,
    deleteReaction,
    getReactionsForResource,
    createActivity,
    getActivityByResource,
};

export default DB_QUERIES;
