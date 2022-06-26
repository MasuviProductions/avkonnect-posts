import { getAuthenticationTokenType } from '@masuviproductions/avkonnect-auth/lib';
import { AuthenticationToken } from '@masuviproductions/avkonnect-auth/lib/constants/app';
import { ErrorMessage, ErrorCode } from '../constants/errors';
import { PreRequestHandler } from '../interfaces/app';
import { HttpError } from '../utils/error';

export const userPathValidationHandler: PreRequestHandler<{ Params: { userId: string } }> = async (request) => {
    const userId = request.params.userId;
    const authUser = request.authUser;

    const authType = getAuthenticationTokenType(request.headers.authorization);

    if (!authType || !authUser) {
        throw new HttpError(ErrorMessage.AuthenticationError, 401, ErrorCode.AuthenticationError);
    }

    if (authType === AuthenticationToken.Bearer) {
        if (authUser.id !== userId) {
            throw new HttpError(ErrorMessage.AuthorizationError, 403, ErrorCode.AuthorizationError);
        }
    }
};
