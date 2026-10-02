#!/bin/sh
set -eu

mc alias set storage "$MINIO_URL" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null
mc mb --ignore-existing "storage/$MINIO_BUCKET"
mc anonymous set none "storage/$MINIO_BUCKET"
cat > /tmp/runtime-policy.json <<EOF
{"Version":"2012-10-17","Statement":[
  {"Effect":"Allow","Action":["s3:ListBucket","s3:GetBucketLocation"],"Resource":["arn:aws:s3:::$MINIO_BUCKET"]},
  {"Effect":"Allow","Action":["s3:GetObject","s3:PutObject","s3:DeleteObject"],"Resource":["arn:aws:s3:::$MINIO_BUCKET/*"]}
]}
EOF
mc admin user add storage "$MINIO_APP_USER" "$MINIO_APP_PASSWORD"
mc admin policy create storage "$MINIO_BUCKET-runtime" /tmp/runtime-policy.json
mc admin policy attach storage "$MINIO_BUCKET-runtime" --user "$MINIO_APP_USER"
