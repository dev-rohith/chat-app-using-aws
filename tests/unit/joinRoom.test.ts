import { handler } from '../../modules/joinRoom';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument, QueryCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';

jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');
jest.mock('@aws-sdk/client-apigatewaymanagementapi');

const sendMock = jest.fn();
const apiSendMock = jest.fn();

(DynamoDBDocument.from as jest.Mock).mockReturnValue({ send: sendMock });
(ApiGatewayManagementApiClient as jest.Mock).mockImplementation(() => ({ send: apiSendMock }));

describe('joinRoomHandler', () => {
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

  it('should return 500 on missing body', async () => {
    const event: any = { requestContext: { connectionId: 'conn1' } };
    const res = await handler(event);
    expect(res).toEqual({ statusCode: 500, body: 'Internal server error' });
  });

  it('should query messages, save member, and respond with messages', async () => {
    sendMock
      .mockResolvedValueOnce({ Items: [{ content: 'Hello' }] })
      .mockResolvedValueOnce({});
    apiSendMock.mockResolvedValue({});

    const event: any = {
      requestContext: { connectionId: 'conn1' },
      body: JSON.stringify({ roomId: 'room1', userId: 'user1' }),
    };

    const res = await handler(event);
    expect(sendMock).toHaveBeenCalledTimes(2);
    expect(apiSendMock).toHaveBeenCalledTimes(1);
    expect(apiSendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          ConnectionId: 'conn1',
        }),
      })
    );
    expect(res).toEqual({ statusCode: 200, body: 'Joined room and sent messages' });
  });

  it('should return 500 if dynamo fails', async () => {
    sendMock.mockRejectedValueOnce(new Error('Dynamo Error'));

    const event: any = {
      requestContext: { connectionId: 'conn1' },
      body: JSON.stringify({ roomId: 'room1', userId: 'user1' }),
    };

    const res = await handler(event);
    expect(res).toEqual({ statusCode: 500, body: 'Internal server error' });
  });
});
