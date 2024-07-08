import boto3
import os
from urllib.parse import urlparse

# Initialize AWS clients
ec2 = boto3.client('ec2')
dynamodb = boto3.resource('dynamodb')
s3 = boto3.client('s3')

FILE_TABLE_NAME = 'fovus_table'
S3_BUCKET_NAME = 'nuufovus'

def get_instance_id():
    # Use EC2 instance metadata to get the instance ID
    import requests
    return requests.get('http://169.254.169.254/latest/meta-data/instance-id').text

def get_file_table_item_index(instance_id):
    response = ec2.describe_tags(
        Filters=[
            {'Name': 'resource-id', 'Values': [instance_id]},
            {'Name': 'key', 'Values': ['FileTableItemIndex']}
        ]
    )
    if response['Tags']:
        return response['Tags'][0]['Value']
    else:
        raise ValueError("FileTableItemIndex tag not found")

def main():

    # Get the instance ID
    instance_id = get_instance_id()
    print(f"Instance ID: {instance_id}")

    # Get the FileTable item index from the instance tag
    file_index = get_file_table_item_index(instance_id)
    print(f"FileTable Item Index: {file_index}")

    file_table = dynamodb.Table(FILE_TABLE_NAME)

    print(f"Attempting to get item with index {file_index} from table {FILE_TABLE_NAME}")
  
    response = file_table.get_item(Key={'id': file_index})
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
            'id': f"modified_{file_index}",
            'filepath': new_s3_filepath,
            'text': modified_content,
            'status': 'finished'  # This is the new attribute
        }
    )

    print("Processing completed successfully.")

if __name__ == "__main__":
    main()
