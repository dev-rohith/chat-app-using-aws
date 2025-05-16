import { APIGatewayProxyEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ApiGatewayManagementApi, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { v4 as uuidv4 } from 'uuid';

const db = DynamoDBDocument.from(new DynamoDBClient({}));
const endpoint = process.env.WEBSOCKET_ENDPOINT!;;
const apiClient = new ApiGatewayManagementApi({ endpoint });

const TableName = process.env.TABLE_NAME!;


export const handler = async (event: APIGatewayProxyEvent) => {
  try {
    const { connectionId } = event.requestContext;

    if (!event.body) {
      return { statusCode: 400, body: 'Missing body' };
    }

    const { roomId, userId, content } = JSON.parse(event.body);

    if (!roomId || !userId || !content) {
      return { statusCode: 400, body: 'Missing required fields' };
    }

    const membersResult = await db.send(
      new QueryCommand({
        TableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': `ROOM#${roomId}`,
          ':skPrefix': 'MEMBER#',
        },
      })
    );

    const members = membersResult.Items || [];

    const isMember = members.some(item => item.SK === `MEMBER#${connectionId}`);
    if (!isMember) {
      return { statusCode: 403, body: 'Not a room member' };
    }

    const timestamp = Date.now();
    await db.send(
      new PutCommand({
        TableName,
        Item: {
          PK: `ROOM#${roomId}`,
          SK: `MSG#${uuidv4()}`,
          roomId,
          userId,
          content,
          timestamp,
        },
      })
    );

    const message = { userId, content, timestamp };

    const postCalls = members.map(async member => {
      const targetConnectionId = member.SK.split('#')[1];
      if (!targetConnectionId) return;
      try {
        await apiClient.send(
          new PostToConnectionCommand({
            ConnectionId: targetConnectionId,
            Data: Buffer.from(JSON.stringify(message)),
          })
        );
      } catch (err) {
        console.error(`Failed to send message to ${targetConnectionId}:`, err);
      }
    });

    await Promise.all(postCalls);

    return { statusCode: 200, body: 'Message sent successfully' };
  } catch (error) {
    console.error('Error sending message:', error);
    return { statusCode: 500, body: 'Internal server error' };
  }
};
