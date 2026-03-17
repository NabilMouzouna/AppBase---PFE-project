import type { AppBaseConfig } from "./appbase";
import type { AuthClient } from "./auth";
import type { FileRecord, BucketListResponse, UploadResponse } from "@appbase/types";

export class StorageClient {
  constructor(
    private config: AppBaseConfig,
    private auth: AuthClient
  ) {}

  private get baseUrl() {
    return `${this.config.endpoint}/storage`;
  }

  private headers(): Record<string, string> {
    const token = this.auth.getAccessToken();
    return {
      "x-api-key": this.config.apiKey,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  async upload(bucket: string, file: File | Blob, filename?: string): Promise<UploadResponse> {
    const form = new FormData();
    form.append("file", file, filename ?? (file instanceof File ? file.name : "upload"));
    const res = await fetch(`${this.baseUrl}/buckets/${bucket}/upload`, {
      method: "POST",
      headers: this.headers(),
      body: form,
    });
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json() as { data: UploadResponse };
    return json.data;
  }

  async getUrl(bucket: string, fileId: string): Promise<string> {
    return `${this.baseUrl}/buckets/${bucket}/${fileId}`;
  }

  async download(bucket: string, fileId: string): Promise<Blob> {
    const res = await fetch(`${this.baseUrl}/buckets/${bucket}/${fileId}`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.blob();
  }

  async delete(bucket: string, fileId: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/buckets/${bucket}/${fileId}`, {
      method: "DELETE",
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(await res.text());
  }

  async list(bucket: string): Promise<BucketListResponse> {
    const res = await fetch(`${this.baseUrl}/buckets/${bucket}`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json() as { data: BucketListResponse };
    return json.data;
  }

  async getFile(bucket: string, fileId: string): Promise<FileRecord> {
    const res = await fetch(`${this.baseUrl}/buckets/${bucket}/${fileId}/meta`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json() as { data: FileRecord };
    return json.data;
  }
}
