import { handler } from '../../modules/connect'; 
import { DynamoDBDocument, PutCommand } from '@aws-sdk/lib-dynamodb';

jest.mock('@aws-sdk/lib-dynamodb');
jest.mock('@aws-sdk/client-dynamodb');

const sendMock = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (DynamoDBDocument.from as jest.Mock).mockReturnValue({ send: sendMock });
});

describe('connectHandler', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV, TABLE_NAME: 'TestTable' };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('should store connection info and return 200', async () => {
    const event = {
      requestContext: {
        connectionId: 'abc123',
        connectedAt: 1715889000000,
      },
      queryStringParameters: {
        userId: 'USER456',
      },
    };

    sendMock.mockResolvedValue({}); 

    const res = await handler(event);

    expect(sendMock).toHaveBeenCalledWith(expect.any(PutCommand));
    const command = sendMock.mock.calls[0][0] as PutCommand;
    expect(command.input).toEqual({
      TableName: 'TestTable',
      Item: {
        PK: 'CONNECTION#abc123',
        SK: 'METADATA',
        userId: 'USER456',
        connectedAt: 1715889000000,
      },
    });

    expect(res).toEqual({ statusCode: 200, body: 'Connected' });
  });

  it('should handle missing userId gracefully', async () => {
    const event = {
      requestContext: {
        connectionId: 'xyz789',
        connectedAt: 1715889001000,
      },
      queryStringParameters: null,
    };

    sendMock.mockResolvedValue({});

    const res = await handler(event);

    expect(sendMock).toHaveBeenCalledWith(expect.any(PutCommand));
    expect(sendMock.mock.calls[0][0].input.Item.userId).toBeUndefined();

    expect(res).toEqual({ statusCode: 200, body: 'Connected' });
  });

  it('should throw error on DynamoDB failure', async () => {
    const event = {
      requestContext: {
        connectionId: 'fail456',
        connectedAt: 1715889002000,
      },
      queryStringParameters: {
        userId: 'userX',
      },
    };

    sendMock.mockRejectedValue(new Error('Dynamo error'));

    await expect(handler(event)).rejects.toThrow('Dynamo error');
  });
});
