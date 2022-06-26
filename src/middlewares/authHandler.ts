import { preHandlerAsyncHookHandler } from 'fastify';
import { AuthenticationToken } from '@masuviproductions/avkonnect-auth/lib/constants/app';
import {
    getAuthenticationTokenType,
    getTokenFromApiRequest,
    verfiyAccessToken,
} from '@masuviproductions/avkonnect-auth/lib';
import { ErrorCode, ErrorMessage } from '../constants/errors';
import AVKKONNECT_CORE_SERVICE from '../services/avkonnect-core';
import { HttpError } from '../utils/error';

export const authHandler: preHandlerAsyncHookHandler = async (request) => {
    const authType = getAuthenticationTokenType(request.headers.authorization);
    const authToken = getTokenFromApiRequest(request.headers.authorization);

    if (!authToken) {
        throw new HttpError(ErrorMessage.AuthenticationError, 401, ErrorCode.AuthenticationError);
    }

    switch (authType) {
        case AuthenticationToken.Bearer: {
            try {
                await verfiyAccessToken(authToken);
            } catch (err) {
                throw new HttpError((err as Error).message, 401, ErrorCode.AuthenticationError);
            }
            const authUserResponse = await AVKKONNECT_CORE_SERVICE.getAuthUser(authToken);
            if (!authUserResponse) {
                throw new HttpError(ErrorMessage.AuthenticationError, 401, ErrorCode.AuthenticationError);
            }
            request.authUser = authUserResponse.data;
            break;
        }
        default: {
            throw new HttpError(ErrorMessage.AuthenticationError, 401, ErrorCode.AuthenticationError);
        }
    }
};
