export type RecordId = string;

export interface CollectionRecord {
  id: RecordId;
  collection: string;
  ownerId: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ListResponse<T> {
  items: T[];
  total: number;
}

export type ChangeEventType = "created" | "updated" | "deleted";

export interface ChangeEvent<T = Record<string, unknown>> {
  type: ChangeEventType;
  collection: string;
  record: T & { id: RecordId };
}
