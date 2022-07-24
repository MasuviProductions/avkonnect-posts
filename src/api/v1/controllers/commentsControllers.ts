import { v4 } from 'uuid';
import { ErrorMessage, ErrorCode } from '../../../constants/errors';
import { RequestHandler, ICreateCommentRequest, HttpResponse, IUpdateCommentRequest } from '../../../interfaces/app';
import { IComment, ICommentContent } from '../../../models/comments';
import { IPost } from '../../../models/posts';
import { throwErrorIfResourceNotFound } from '../../../utils/db/generic';
import DB_QUERIES from '../../../utils/db/queries';
import { HttpError } from '../../../utils/error';

export const createComment: RequestHandler<{
    Body: ICreateCommentRequest;
}> = async (request, reply) => {
    const { authUser, body } = request;
    await throwErrorIfResourceNotFound(body.resourceType, body.resourceId);
    const currentTime = Date.now();
    const comment: IComment = {
        ...body,
        id: v4(),
        userId: authUser?.id as string,
        createdAt: new Date(currentTime),
        resourceId: body.resourceId,
        resourceType: body.resourceType,
        contents: [{ ...body.comment, createdAt: new Date(currentTime) }],
    };
    const createdComment = await DB_QUERIES.createComment(comment);
    if (!createdComment) {
        throw new HttpError(ErrorMessage.CreationError, 400, ErrorCode.CreationError);
    }
    const response: HttpResponse<IComment> = {
        success: true,
        data: createdComment,
    };
    reply.status(200).send(response);
};

export const updateComment: RequestHandler<{
    Params: { commentId: string };
    Body: IUpdateCommentRequest;
}> = async (request, reply) => {
    const {
        authUser,
        body,
        params: { commentId },
    } = request;
    const comment = await DB_QUERIES.getCommentById(commentId);
    if (!comment) {
        throw new HttpError(ErrorMessage.NotFound, 404, ErrorCode.NotFound);
    }
    if (authUser?.id != comment.userId) {
        throw new HttpError(ErrorMessage.AuthorizationError, 403, ErrorCode.AuthorizationError);
    }
    const newCommentContent: ICommentContent = { ...body.comment, createdAt: new Date(Date.now()) };
    const updatedComment = await DB_QUERIES.updateComment(comment.userId, comment.createdAt, {
        contents: [...comment.contents, newCommentContent],
    });
    const response: HttpResponse<IComment> = {
        success: true,
        data: updatedComment,
    };
    reply.status(200).send(response);
};

export const deleteComment: RequestHandler<{
    Params: { commentId: string };
}> = async (request, reply) => {
    const {
        params: { commentId },
        authUser,
    } = request;
    const comment = await DB_QUERIES.getCommentById(commentId);
    if (!comment) {
        throw new HttpError(ErrorMessage.NotFound, 404, ErrorCode.NotFound);
    }
    if (authUser?.id != comment.userId) {
        if (comment.resourceType === 'comment') {
            const parentComment = await DB_QUERIES.getCommentById(comment.resourceId);
            if (authUser?.id !== parentComment?.userId) {
                throw new HttpError(ErrorMessage.AuthorizationError, 403, ErrorCode.AuthorizationError);
            }
        } else if (comment.resourceType === 'post') {
            const parentPost = await DB_QUERIES.getPostById(comment.resourceId);
            if (authUser?.id !== parentPost?.userId) {
                throw new HttpError(ErrorMessage.AuthorizationError, 403, ErrorCode.AuthorizationError);
            }
        } else {
            throw new HttpError(ErrorMessage.AuthorizationError, 403, ErrorCode.AuthorizationError);
        }
    }
    await DB_QUERIES.deleteComment(comment.userId, comment.createdAt);
    // TODO: Handle deletion of reacts and comments of comment
    const response: HttpResponse<IPost> = {
        success: true,
    };
    reply.status(200).send(response);
};

export const getCommentComments: RequestHandler<{
    Params: { commentId: string };
}> = async (request, reply) => {
    const {
        params: { commentId },
    } = request;
    const comments = await DB_QUERIES.getCommentsForResource('comment', commentId);
    const response: HttpResponse = {
        success: true,
        data: comments || [],
    };
    reply.status(200).send(response);
};