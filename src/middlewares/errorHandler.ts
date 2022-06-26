import { FastifyReply, FastifyRequest } from 'fastify';
import { ErrorCode, ErrorMessage } from '../constants/errors';
import { HttpResponse, HttpResponseError } from '../interfaces/app';
import { HttpError } from '../utils/error';

const errorHandler = (err: HttpError, _request: FastifyRequest, reply: FastifyReply) => {
    const error: HttpResponseError = {
        message: err.message || ErrorMessage.InternalServerError,
        code: err.errorCode || ErrorCode.InternalServerError,
    };
    const response: HttpResponse = {
        success: false,
        error: error,
    };
    reply.status(err.statusCode ?? 500).send(response);
};

export default errorHandler;
