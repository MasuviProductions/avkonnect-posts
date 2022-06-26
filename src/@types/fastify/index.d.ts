import { IUserApiModel } from '../../interfaces/api';

declare module 'fastify' {
    export interface FastifyRequest {
        authUser?: Readonly<Pick<IUserApiModel, 'id' | 'email'>>;
    }
}
