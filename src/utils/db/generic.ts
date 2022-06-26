import { ErrorCode, ErrorMessage } from '../../constants/errors';
import { IResourceType } from '../../models/reactions';
import { HttpError } from '../error';
import DB_QUERIES from './queries';

export const throwErrorIfResourceNotFound = async (resourceType: IResourceType, resourceId: string) => {
    switch (resourceType) {
        case 'post': {
            const post = await DB_QUERIES.getPostById(resourceId);
            if (!post) {
                throw new HttpError(ErrorMessage.NotFound, 404, ErrorCode.NotFound);
            }
            break;
        }
        case 'comment': {
            const comment = await DB_QUERIES.getCommentById(resourceId);
            if (!comment) {
                throw new HttpError(ErrorMessage.NotFound, 404, ErrorCode.NotFound);
            }
            break;
        }
        default: {
            throw new HttpError(ErrorMessage.InvalidResourceTypeError, 400, ErrorCode.InputError);
        }
    }
};
