import { handler } from '../../modules/disconnect'; 
import { DynamoDBDocument, DeleteCommand } from '@aws-sdk/lib-dynamodb';

jest.mock('@aws-sdk/lib-dynamodb');
jest.mock('@aws-sdk/client-dynamodb');

const sendMock = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (DynamoDBDocument.from as jest.Mock).mockReturnValue({ send: sendMock });
});

describe('disconnectHandler', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV, TABLE_NAME: 'TestTable' };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('should delete connection info and return 200', async () => {
    const event = {
      requestContext: {
        connectionId: 'abc123',
      },
    };

    sendMock.mockResolvedValue({});

    const res = await handler(event);

    expect(sendMock).toHaveBeenCalledWith(expect.any(DeleteCommand));
    const command = sendMock.mock.calls[0][0] as DeleteCommand;
    expect(command.input).toEqual({
      TableName: 'TestTable',
      Key: {
        PK: 'CONNECTION#abc123',
        SK: 'METADATA',
      },
    });

    expect(res).toEqual({ statusCode: 200, body: 'Disconnected' });
  });

  it('should throw error on DynamoDB failure', async () => {
    const event = {
      requestContext: {
        connectionId: 'xyz789',
      },
    };

    sendMock.mockRejectedValue(new Error('DynamoDB error'));

    await expect(handler(event)).rejects.toThrow('DynamoDB error');
  });
});
