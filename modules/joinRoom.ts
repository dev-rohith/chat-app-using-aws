import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { PutCommand, DynamoDBDocument, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';

const dynamo = DynamoDBDocument.from(new DynamoDBClient({}));
const TableName = process.env.TABLE_NAME!;
const endpoint = process.env.WEBSOCKET_ENDPOINT!;
const apiClient = new ApiGatewayManagementApiClient({ endpoint });

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Event:', JSON.stringify(event));

  try {
    const { connectionId } = event.requestContext;
    const { roomId, userId } = event.body ? JSON.parse(event.body) : {};

    const existingMessages = await dynamo.send(
      new QueryCommand({
        TableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `ROOM#${roomId}`,
          ':sk': 'MSG#',
        },
      })
    );

    await dynamo.send(
      new PutCommand({
        TableName,
        Item: {
          PK: `ROOM#${roomId}`,
          SK: `MEMBER#${connectionId}`,
          userId,
          joinedAt: Date.now(),
        },
      })
    );

    await apiClient.send(
      new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: Buffer.from(
          JSON.stringify({
            userAction: 'joinedRoom',
            roomId,
            messages: existingMessages.Items || [],
          })
        ),
      })
    );

    return { statusCode: 200, body: 'Joined room and sent messages' };
  } catch (err) {
    console.error('Error in joinRoom handler:', err);
    return { statusCode: 500, body: 'Internal server error' };
  }
};

