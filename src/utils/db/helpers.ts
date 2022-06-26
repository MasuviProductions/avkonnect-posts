import { Query, Scan } from 'dynamoose/dist/DocumentRetriever';
import { ObjectType } from 'dynamoose/dist/General';
import { HttpDynamoDBResponsePagination, IDynamooseDocument } from '../../interfaces/app';

const DYNAMODB_USER_SEARCH_SCAN_LIMIT = 20;

const fetchDynamoDBPaginatedDocuments = async <T extends { id: string }>(
    initialQuery: Scan<IDynamooseDocument<T>> | Query<IDynamooseDocument<T>>,
    attributes: Array<string>,
    requestLimit: number,
    dDBAssistStartFromKeyFields: Array<keyof T>,
    dDBAssistStartFromKey?: ObjectType
): Promise<{
    documents: Partial<T>[];
    dDBPagination: HttpDynamoDBResponsePagination;
}> => {
    let startSearchFrom = dDBAssistStartFromKey;
    let documents: Array<Partial<T>> = [];
    do {
        const query = initialQuery;
        if (startSearchFrom) {
            query.startAt(startSearchFrom);
        }
        query.limit(DYNAMODB_USER_SEARCH_SCAN_LIMIT);
        if (attributes.length > 0) {
            query.attributes(attributes);
        }
        const searchedDocuments = await query.exec();

        startSearchFrom = searchedDocuments.lastKey;

        (searchedDocuments as Array<Partial<T>>).forEach((searchedDocument) => {
            documents.push(searchedDocument);
        });
    } while (documents.length < requestLimit && startSearchFrom);

    const nextSearchStartFromKey: ObjectType = {};

    if (startSearchFrom) {
        Object.entries(startSearchFrom).forEach(([key, value]) => {
            nextSearchStartFromKey[key] = value;
        });
    }

    if (requestLimit < documents.length) {
        documents = [...documents.slice(0, requestLimit)];
        dDBAssistStartFromKeyFields.forEach((key) => {
            nextSearchStartFromKey[key as string] = documents?.[documents.length - 1][key];
        });
    }
    const dDBPagination: HttpDynamoDBResponsePagination = {
        nextSearchStartFromKey: Object.keys(nextSearchStartFromKey).length > 0 ? nextSearchStartFromKey : undefined,
        count: documents.length,
    };
    return { documents, dDBPagination };
};

const DB_HELPERS = { fetchDynamoDBPaginatedDocuments };

export default DB_HELPERS;
