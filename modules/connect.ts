import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { PutCommand, DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const db = DynamoDBDocument.from(new DynamoDBClient({}));
const TableName = process.env.TABLE_NAME!;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const { connectionId, connectedAt } = event.requestContext;
  const userId = event.queryStringParameters?.userId;

  await db.send(new PutCommand({
    TableName,
    Item: {
      PK: `CONNECTION#${connectionId}`,
      SK: 'METADATA',
      userId,
      connectedAt
    }
  }));

  return { statusCode: 200, body: 'Connected' };
};
