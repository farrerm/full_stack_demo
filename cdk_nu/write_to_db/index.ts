import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';
import { nanoid } from 'nanoid';

const dynamoDB = new DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME!;

export const handler: APIGatewayProxyHandler = async (event) => {
  // TODO: Implement the logic to write to DynamoDB
  try {
    // Parse the incoming request body
    const body = JSON.parse(event.body || '{}');
    const { text, filepath } = body;

    if (!text || !filepath) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields: text and filepath' }),
      };
    }

    // Generate a unique ID
    const id = nanoid();

    // Prepare the item to be inserted into DynamoDB
    const item = {
      id,
      text,
      filepath,
      //timestamp: new Date().toISOString(),
    };

    // Write the item to DynamoDB
    await dynamoDB.put({
      TableName: TABLE_NAME,
      Item: item,
    }).promise();

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': 'http://localhost:3000', // Replace with your frontend URL
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({ message: 'Data successfully written to DynamoDB', id }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': 'http://localhost:3000', // Replace with your frontend URL
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({ error: 'Failed to write data to DynamoDB' }),
    };
  }
};