import { handler } from '../../modules/sendMessage'; 
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument, QueryCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { ApiGatewayManagementApi, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { v4 as uuidv4 } from 'uuid';

jest.mock('uuid', () => ({ v4: jest.fn(() => 'mock-uuid') }));
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');
jest.mock('@aws-sdk/client-apigatewaymanagementapi');

const sendMock = jest.fn();
const apiSendMock = jest.fn();

(DynamoDBDocument.from as jest.Mock).mockReturnValue({ send: sendMock });
(ApiGatewayManagementApi as jest.Mock).mockImplementation(() => ({ send: apiSendMock }));

describe('sendMessageHandler', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...OLD_ENV,
      TABLE_NAME: 'TestTable',
      WEBSOCKET_ENDPOINT: 'https://test.com',
    };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('should return 400 if body is missing', async () => {
    const event: any = { requestContext: { connectionId: 'conn1' } };
    const res = await handler(event);
    expect(res).toEqual({ statusCode: 400, body: 'Missing body' });
  });

  it('should return 400 if required fields are missing', async () => {
    const event: any = {
      requestContext: { connectionId: 'conn1' },
      body: JSON.stringify({}),
    };
    const res = await handler(event);
    expect(res).toEqual({ statusCode: 400, body: 'Missing required fields' });
  });

  it('should return 403 if not a room member', async () => {
    sendMock.mockResolvedValueOnce({ Items: [] });
    const event: any = {
      requestContext: { connectionId: 'conn1' },
      body: JSON.stringify({ roomId: 'room1', userId: 'user1', content: 'Hello' }),
    };
    const res = await handler(event);
    expect(res).toEqual({ statusCode: 403, body: 'Not a room member' });
  });

  it('should store and broadcast message', async () => {
    const members = [{ SK: 'MEMBER#conn1' }, { SK: 'MEMBER#conn2' }];
    sendMock.mockResolvedValueOnce({ Items: members });
    sendMock.mockResolvedValueOnce({}); 
    apiSendMock.mockResolvedValue({});

    const event: any = {
      requestContext: { connectionId: 'conn1' },
      body: JSON.stringify({ roomId: 'room1', userId: 'user1', content: 'Hello' }),
    };

    const res = await handler(event);
    expect(sendMock).toHaveBeenCalledTimes(2);
    expect(apiSendMock).toHaveBeenCalledTimes(2);
    expect(res).toEqual({ statusCode: 200, body: 'Message sent successfully' });
  });

  it('should return 500 on error', async () => {
    sendMock.mockRejectedValueOnce(new Error('DB fail'));
    const event: any = {
      requestContext: { connectionId: 'conn1' },
      body: JSON.stringify({ roomId: 'room1', userId: 'user1', content: 'Hello' }),
    };
    const res = await handler(event);
    expect(res).toEqual({ statusCode: 500, body: 'Internal server error' });
  });
});
