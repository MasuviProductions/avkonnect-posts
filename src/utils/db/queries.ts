import Post, { IPost } from '../../models/posts';
import { v4 } from 'uuid';
import Reaction, { IReaction, IReactionType, IResourceType } from '../../models/reactions';
import Comment, { IComment } from '../../models/comments';

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
    const reaction = await Reaction.query('userId')
        .eq(userId)
        .and()
        .where('resourceId')
        .eq(resourceId)
        .and()
        .where('resourceType')
        .eq(resourceType)
        .exec();

    return reaction?.[0];
};

const DB_QUERIES = {
    createPost,
    createComment,
    getCommentsForResource,
    getPostById,
    deletePostById,
    updatePost,
    createReaction,
    updateReactionTypeForReaction,
    getReactionsByUserIdForResource,
    getCommentById,
    deleteComment,
    updateComment,
    getReactionByIdForUser,
    deleteReaction,
    getReactionsForResource,
};

export default DB_QUERIES;
