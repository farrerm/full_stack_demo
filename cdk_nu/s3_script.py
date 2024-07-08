import boto3
import os
from urllib.parse import urlparse

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')
s3 = boto3.client('s3')

# Configuration (you may want to pass these as environment variables)
FILE_TABLE_NAME = 'fovus_table'
S3_BUCKET_NAME = 'nuufovus'
FILE_INDEX = 'BOzYHkeCsXHbSZ6k4SRI4'  # The key to retrieve the input file from DynamoDB

def main():
    file_table = dynamodb.Table(FILE_TABLE_NAME)

    print(f"Attempting to get item with index {FILE_INDEX} from table {FILE_TABLE_NAME}")
  
    # 1. Download an arbitrary entry from the FileTable
    response = file_table.get_item(Key={'id': FILE_INDEX})
    file_entry = response['Item']
    s3_filepath = file_entry['filepath']

    print(f"Retrieved S3 filepath: {s3_filepath}")
    
    # Parse the S3 URL properly
    parsed_url = urlparse(s3_filepath)
    bucket = parsed_url.netloc.split('.')[0]
    key = parsed_url.path.lstrip('/')

    print(f"Extracted bucket: {bucket}, key: {key}")

    # 2. Download the file from S3
    local_filename = os.path.basename(key)
    print(f"Attempting to download file {key} from bucket {bucket} to {local_filename}")
    s3.download_file(bucket, key, local_filename)

    # 3. Read the file content, count the length, and append it
    with open(local_filename, 'r') as file:
        content = file.read()
    
    content_length = len(content)
    modified_content = f"{content} : {content_length}"
    
    # 4. Save the modified content to a new file
    modified_filename = f"modified_{local_filename}"
    with open(modified_filename, 'w') as file:
        file.write(modified_content)

   # 5. Upload the modified file to S3
    new_key = f"{modified_filename}"
    s3.upload_file(modified_filename, S3_BUCKET_NAME, new_key)

    # 6. Write the modified file contents and new S3 path back to the FileTable
    new_s3_filepath = f"s3://{S3_BUCKET_NAME}/{new_key}"
    file_table.put_item(
        Item={
            'id': f"modified_{FILE_INDEX}",
            'filepath': new_s3_filepath,
            'text': modified_content
        }
    )

    print("Processing completed successfully.")

if __name__ == "__main__":
    main()
