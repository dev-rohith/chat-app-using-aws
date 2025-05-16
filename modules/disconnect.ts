import {
  DynamoDBClient
} from '@aws-sdk/client-dynamodb';
import { DeleteCommand, DynamoDBDocument } from '@aws-sdk/lib-dynamodb';

const db = DynamoDBDocument.from(new DynamoDBClient({}));
const TableName = process.env.TABLE_NAME!;

export const handler = async (event: any) => {
  const connectionId = event.requestContext.connectionId;

   await db.send(new DeleteCommand({
     TableName,
     Key: {
       PK: `CONNECTION#${connectionId}`,
       SK: 'METADATA',
     },
   }));

  return { statusCode: 200, body: 'Disconnected' };
};
