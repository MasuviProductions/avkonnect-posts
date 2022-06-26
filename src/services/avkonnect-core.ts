import axios, { AxiosResponse } from 'axios';
import API_ENDPOINTS from '../constants/api';
import { IConnectionApiModel, IPatchUserApiRequest, IUserApiModel, IUserApiResponse } from '../interfaces/api';
import { HttpResponse } from '../interfaces/app';

const getAuthUser = async (bearerToken: string): Promise<HttpResponse<IUserApiResponse>> => {
    const userProfileResponse = await axios
        .get<HttpResponse<IUserApiResponse>>(API_ENDPOINTS.GET_AUTH_USER(), {
            headers: { authorization: `Bearer ${bearerToken}` },
        })
        .then((res) => res.data)
        .catch((err) => err);
    return userProfileResponse;
};

const getConnection = async (basicToken: string, connectionId: string): Promise<HttpResponse<IConnectionApiModel>> => {
    const connection = await axios
        .get<HttpResponse<IConnectionApiModel>>(API_ENDPOINTS.GET_CONNECTION(connectionId), {
            headers: { authorization: `Basic ${basicToken}` },
        })
        .then((res) => res.data)
        .catch((err) => err);
    return connection;
};

const getUsersInfo = async (
    basicToken: string,
    usersList: Array<string>
): Promise<HttpResponse<Array<Partial<IUserApiModel>>>> => {
    const usersInfo = await axios
        .post<HttpResponse<Array<Partial<IUserApiModel>>>>(API_ENDPOINTS.GET_USERS_INFO(), usersList, {
            headers: { authorization: `Basic ${basicToken}` },
        })
        .then((res) => res.data)
        .catch((err) => err);
    return usersInfo;
};

const getUser = async (basicToken: string, userId: string): Promise<HttpResponse<IUserApiModel>> => {
    const userProfileResponse = await axios
        .get<HttpResponse<IUserApiResponse>>(API_ENDPOINTS.GET_USER(userId), {
            headers: { authorization: `Basic ${basicToken}` },
        })
        .then((res) => res.data)
        .catch((err) => err);
    return userProfileResponse;
};

const patchUser = async (
    basicToken: string,
    userId: string,
    reqBody: IPatchUserApiRequest
): Promise<HttpResponse<IUserApiModel>> => {
    const userProfileResponse = await axios
        .patch<IPatchUserApiRequest, AxiosResponse<HttpResponse<IUserApiModel>>>(
            API_ENDPOINTS.PATCH_USER(userId),
            reqBody,
            {
                headers: { authorization: `Basic ${basicToken}` },
            }
        )
        .then((res) => res.data)
        .catch((err) => err);
    return userProfileResponse;
};

const AVKKONNECT_CORE_SERVICE = {
    getConnection,
    getUsersInfo,
    getUser,
    patchUser,
    getAuthUser,
};

export default AVKKONNECT_CORE_SERVICE;
