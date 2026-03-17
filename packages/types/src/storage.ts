export interface FileRecord {
  id: string;
  bucket: string;
  filename: string;
  mimeType: string;
  size: number;
  ownerId: string;
  createdAt: string;
}

export interface BucketListResponse {
  files: FileRecord[];
  total: number;
}

export interface UploadResponse {
  file: FileRecord;
  url: string;
}
