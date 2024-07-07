import { APIGatewayProxyHandler } from 'aws-lambda';
import { S3 } from 'aws-sdk';

const s3 = new S3();
const BUCKET_NAME = process.env.BUCKET_NAME!;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';

export const handler: APIGatewayProxyHandler = async (event) => {
  const origin = event.headers.origin || event.headers.Origin;
  const allowedOrigin = origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN;
  
  const fileName = event.queryStringParameters?.fileName;
  const fileType = event.queryStringParameters?.fileType;

  if (!fileName || !fileType) {
    return {
      statusCode: 400,
      headers: {
        'Access-Control-Allow-Origin': allowedOrigin, // Restrict this in production
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify({ error: 'fileName and fileType are required query parameters' }),
    };
  }

  const params = {
    Bucket: BUCKET_NAME,
    Key: fileName,
    ContentType: fileType,
    Expires: 300, // URL expires in 5 minutes
  };

  try {
    const signedUrl = await s3.getSignedUrlPromise('putObject', params);
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': allowedOrigin, // Update this for production
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify({ signedUrl }),
    };
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': allowedOrigin, // Restrict this in production
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify({ error: 'Failed to generate presigned URL' }),
    };
  }
};
